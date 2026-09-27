import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { parecidos } from '../../../lib/vocabulario';
import { CapitulosLibro } from './CapitulosLibro';

const vacio = { nombre: '', autor: '', narrador: '', en_memoria: false, genero: '', categoria_id: '', descripcion: '', clasificacionesStr: '' };

const desdeLibro = (libro) => (libro ? {
  nombre: libro.nombre || '',
  autor: libro.autor || '',
  narrador: libro.narrador || '',
  en_memoria: !!libro.en_memoria,
  genero: libro.genero || '',
  categoria_id: libro.categoria_id || '',
  descripcion: libro.descripcion || '',
  clasificacionesStr: (libro.clasificaciones || []).join(', '),
} : vacio);

const CAMPOS_VOCABULARIO = [
  { campo: 'genero', etiqueta: 'Género', lista: 'generos' },
  { campo: 'autor', etiqueta: 'Autor', lista: 'autores' },
  { campo: 'narrador', etiqueta: 'Narrador', lista: 'narradores' },
];

/**
 * Ficha de un libro (spec 005, R5, R6, R9, R15). Tres vistas dentro del mismo
 * diálogo (sin modal dentro de modal): el formulario, la pregunta "¿Es el
 * mismo?" ante un valor parecido a uno existente, y la confirmación de borrado,
 * que explica las consecuencias y arranca con el foco en "Cancelar".
 */
export const FichaLibro = ({ modo, libro, categorias, vocabulario, narracionHabilitada, onGuardado, onEliminado }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [form, setForm] = useState(() => desdeLibro(libro));
  const [errorTitulo, setErrorTitulo] = useState('');
  const [vista, setVista] = useState('form'); // form | parecido | eliminar
  const [conflicto, setConflicto] = useState(null); // { campo, etiqueta, escrito, existentes }
  const [guardando, setGuardando] = useState(false);
  const [aceptados, setAceptados] = useState({}); // campo -> valor aceptado como nuevo
  const tituloRef = useRef(null);
  const tituloVistaRef = useRef(null);
  const cancelarRef = useRef(null);

  const titulo = modo === 'crear' ? 'Registrar audiolibro' : `Gestionar: ${libro.nombre}`;
  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (vista === 'eliminar') cancelarRef.current?.focus();
    else if (vista === 'parecido') tituloVistaRef.current?.focus();
  }, [vista]);

  const fallar = (texto) => {
    announceText(texto, { urgente: true });
    playCue('error');
  };

  const guardar = async (valores) => {
    setGuardando(true);
    const payload = {
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion,
      genero: valores.genero.trim() || null,
      autor: valores.autor.trim() || null,
      categoria_id: valores.categoria_id ? parseInt(valores.categoria_id, 10) : null,
      clasificaciones: valores.clasificacionesStr ? valores.clasificacionesStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      narrador: valores.narrador.trim(),
      en_memoria: valores.en_memoria,
    };
    try {
      const url = modo === 'crear' ? `${API_BASE_URL}/admin/audiolibros` : `${API_BASE_URL}/admin/audiolibros/${libro.id}`;
      const response = await authenticatedFetch(url, {
        method: modo === 'crear' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detalle = typeof data.detail === 'string' ? data.detail : 'revisá los datos';
        fallar(`No se pudo guardar el audiolibro: ${detalle}.`);
        return;
      }
      playCue('success');
      let texto = modo === 'crear'
        ? `Audiolibro ${payload.nombre} registrado. Ahora podés subir sus capítulos en esta misma ficha.`
        : `Audiolibro ${payload.nombre} actualizado.`;
      if (data.narracion === 'no_habilitada' && (payload.narrador || payload.en_memoria)) {
        texto += ' El narrador no se guardó: esta base todavía no lo tiene habilitado.';
      }
      announceText(texto);
      onGuardado(data.id || libro.id);
    } catch (err) {
      console.error(err);
      fallar('Error de conexión al guardar el audiolibro.');
    } finally {
      setGuardando(false);
    }
  };

  // Antes de guardar: título obligatorio y valores parecidos a los existentes
  const revisarYGuardar = (valores, yaAceptados) => {
    if (!valores.nombre.trim()) {
      const texto = 'El título del audiolibro es obligatorio.';
      setErrorTitulo(texto);
      fallar(texto);
      tituloRef.current?.focus();
      return;
    }
    setErrorTitulo('');
    for (const { campo, etiqueta, lista } of CAMPOS_VOCABULARIO) {
      const escrito = valores[campo].trim();
      if (!escrito || yaAceptados[campo] === escrito) continue;
      const existentes = parecidos(escrito, vocabulario[lista]);
      if (existentes.length) {
        setConflicto({ campo, etiqueta, escrito, existentes });
        setVista('parecido');
        announceText(`En ${etiqueta} escribiste ${escrito} y ya ${existentes.length === 1 ? 'existe' : 'existen'} ${existentes.join(' y ')}. ¿Es el mismo?`);
        return;
      }
    }
    setVista('form');
    guardar(valores);
  };

  const alEnviar = (e) => {
    e.preventDefault();
    revisarYGuardar(form, aceptados);
  };

  // usarExistente: el valor existente elegido, o null para guardar el escrito
  const resolverConflicto = (usarExistente) => {
    const { campo, escrito } = conflicto;
    const valores = usarExistente ? { ...form, [campo]: usarExistente } : form;
    const nuevosAceptados = usarExistente ? aceptados : { ...aceptados, [campo]: escrito };
    setForm(valores);
    setAceptados(nuevosAceptados);
    setConflicto(null);
    revisarYGuardar(valores, nuevosAceptados);
  };

  const eliminar = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${libro.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(String(response.status));
      playCue('success');
      announceText(`Audiolibro ${libro.nombre} eliminado.`);
      onEliminado();
    } catch (err) {
      console.error(err);
      fallar(`No se pudo eliminar ${libro.nombre}.`);
      setVista('form');
    }
  };

  if (vista === 'eliminar') {
    return (
      <>
        <h2 id="ficha-libro-titulo" className="modal-title">¿Eliminar {libro.nombre}?</h2>
        <p>El libro dejará de verse para los socios y se pierde su ficha, incluido el narrador. El audio que ya está en el almacenamiento no se borra.</p>
        <p><strong>Esta acción todavía no se puede deshacer.</strong></p>
        <div className="acciones-dialogo">
          <button ref={cancelarRef} type="button" className="btn-submit btn-secundario" onClick={() => setVista('form')}>Cancelar</button>
          <button type="button" className="btn-action-delete" onClick={eliminar}>Eliminar definitivamente</button>
        </div>
      </>
    );
  }

  if (vista === 'parecido' && conflicto) {
    return (
      <>
        <h2 id="ficha-libro-titulo" className="modal-title" tabIndex="-1" ref={tituloVistaRef}>¿Es el mismo {conflicto.etiqueta.toLowerCase()}?</h2>
        <p>
          En {conflicto.etiqueta} escribiste <strong>{conflicto.escrito}</strong> y ya {conflicto.existentes.length === 1 ? 'existe' : `existen ${conflicto.existentes.length} variantes`}:
          {' '}{conflicto.existentes.map((v, i) => <span key={v}>{i > 0 && ' y '}<strong>{v}</strong></span>)}.
          Usar uno existente evita sumar otra variante del mismo valor.
        </p>
        <div className="acciones-dialogo">
          {conflicto.existentes.map((v) => (
            <button key={v} type="button" className="btn-submit" onClick={() => resolverConflicto(v)}>Usar {v}</button>
          ))}
          <button type="button" className="btn-submit btn-secundario" onClick={() => resolverConflicto(null)}>Guardar como nuevo</button>
          <button type="button" className="btn-submit btn-secundario" onClick={() => { setVista('form'); setConflicto(null); }}>Volver</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 id="ficha-libro-titulo" className="modal-title">{titulo}</h2>
      <form onSubmit={alEnviar} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="libro-titulo">Título (obligatorio)</label>
          <input
            ref={tituloRef}
            id="libro-titulo"
            className="form-input"
            value={form.nombre}
            onChange={cambiar('nombre')}
            aria-required="true"
            aria-invalid={errorTitulo ? 'true' : undefined}
            aria-describedby={errorTitulo ? 'libro-titulo-error' : undefined}
            autoComplete="off"
          />
          {errorTitulo && <p id="libro-titulo-error" className="texto-error">{errorTitulo}</p>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-autor">Autor</label>
          <input id="libro-autor" className="form-input" list="lista-autores" value={form.autor} onChange={cambiar('autor')} autoComplete="off" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-narrador">Narrador</label>
          <input
            id="libro-narrador"
            className="form-input"
            list="lista-narradores"
            value={form.narrador}
            onChange={cambiar('narrador')}
            disabled={!narracionHabilitada}
            aria-describedby={!narracionHabilitada ? 'narrador-no-habilitado' : undefined}
            autoComplete="off"
          />
          {!narracionHabilitada && (
            <p id="narrador-no-habilitado" className="nota-campo">Esta base todavía no tiene habilitado el narrador (pendiente de aprobación de la BCC).</p>
          )}
        </div>

        <div className="form-group campo-casilla">
          <input
            id="libro-en-memoria"
            type="checkbox"
            checked={form.en_memoria}
            onChange={cambiar('en_memoria')}
            disabled={!narracionHabilitada}
          />
          <label htmlFor="libro-en-memoria">En Memoria (preservar el registro de quien narra)</label>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-genero">Género</label>
          <input id="libro-genero" className="form-input" list="lista-generos" value={form.genero} onChange={cambiar('genero')} autoComplete="off" />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-categoria">Categoría</label>
          <select id="libro-categoria" className="form-input" value={form.categoria_id} onChange={cambiar('categoria_id')}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-descripcion">Descripción</label>
          <textarea id="libro-descripcion" className="form-input" rows="3" value={form.descripcion} onChange={cambiar('descripcion')} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="libro-clasificaciones">Clasificaciones, separadas por comas</label>
          <input id="libro-clasificaciones" className="form-input" value={form.clasificacionesStr} onChange={cambiar('clasificacionesStr')} autoComplete="off" />
        </div>

        <datalist id="lista-autores">{vocabulario.autores.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="lista-narradores">{vocabulario.narradores.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="lista-generos">{vocabulario.generos.map((v) => <option key={v} value={v} />)}</datalist>

        <div className="acciones-dialogo">
          <button type="submit" className="btn-submit" disabled={guardando} aria-busy={guardando}>Guardar</button>
          <button type="button" className="btn-submit btn-secundario" onClick={(e) => e.currentTarget.closest('dialog').close()}>Cerrar</button>
          {modo === 'editar' && (
            <button type="button" className="btn-action-delete" onClick={() => setVista('eliminar')}>Eliminar libro</button>
          )}
        </div>
      </form>

      {modo === 'editar' && <CapitulosLibro libro={libro} />}
    </>
  );
};

export default FichaLibro;
