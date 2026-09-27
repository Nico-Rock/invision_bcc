import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';
import { plural } from '../../../lib/consola';

const NOMBRE_CAMPO = { generos: 'género', autores: 'autor', narradores: 'narrador' };
const CAMPO_API = { generos: 'genero', autores: 'autor', narradores: 'narrador' };

/** Unir variantes de un mismo valor, con vista previa hablada (R24). */
const UnirVariantes = ({ grupo, onHecho }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [destino, setDestino] = useState(grupo.valores[grupo.valores.length - 1]);
  const [fichas, setFichas] = useState(null);
  const campo = CAMPO_API[grupo.clave];
  const origen = grupo.valores.filter((v) => v !== destino);

  useEffect(() => {
    let vigente = true;
    const q = new URLSearchParams({ campo, destino });
    origen.forEach((o) => q.append('origen', o));
    authenticatedFetch(`${API_BASE_URL}/admin/vocabulario/vista-previa?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vigente) return;
        setFichas(d.fichas);
        announceText(`Unir en ${destino}: ${plural(d.fichas, 'ficha cambia', 'fichas cambian')}.`);
      })
      .catch(() => {});
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  const unir = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/vocabulario/fusionar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campo, origen, destino }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      playCue('success');
      announceText(`Listo: ${plural(d.fichas, 'ficha usa', 'fichas usan')} ahora ${destino}. Cada cambio quedó en el historial y se puede deshacer.`);
      onHecho();
    } catch (err) {
      playCue('error');
      announceText(`No se pudo unir: ${err.message}.`, { urgente: true });
    }
  };

  return (
    <>
      <h2 id="unir-titulo" className="modal-title">Unir variantes de {NOMBRE_CAMPO[grupo.clave]}</h2>
      <fieldset className="form-group">
        <legend className="form-label">¿Cuál es la forma correcta?</legend>
        {grupo.valores.map((v, i) => (
          <div key={v} className="campo-casilla">
            <input type="radio" id={`destino-${i}`} name="destino" checked={destino === v} onChange={() => setDestino(v)} />
            <label htmlFor={`destino-${i}`}>{v}</label>
          </div>
        ))}
      </fieldset>
      <p>{fichas === null ? 'Calculando cuántas fichas cambian…' : `${plural(fichas, 'ficha cambia', 'fichas cambian')} a ${destino}.`}</p>
      <div className="acciones-dialogo">
        <button type="button" className="btn-submit" onClick={unir} disabled={fichas === null}>Unir en {destino}</button>
        <button type="button" className="btn-submit btn-secundario" onClick={(e) => e.currentTarget.closest('dialog').close()}>Cancelar</button>
      </div>
    </>
  );
};

/**
 * Inicio (spec 005, R18 y R27): lo primero que escucha el administrador es qué
 * necesita atención, y cada pendiente lleva a su lista.
 */
export const Inicio = ({ irA }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [grupo, setGrupo] = useState(null);
  const anunciado = useRef(false);

  const cargar = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/pendientes`);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setDatos(d);
      setError('');
      return d;
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los pendientes.');
      announceText('No se pudieron cargar los pendientes del Inicio.', { urgente: true });
      playCue('error');
      return null;
    }
  };

  useEffect(() => {
    let vigente = true;
    let espera;
    const ciclo = async () => {
      const d = await cargar();
      if (!vigente || !d) return;
      if (!anunciado.current) {
        anunciado.current = true;
        announceText(resumenHablado(d));
      }
      // Mientras se arma el índice de audio, se vuelve a consultar solo
      if (d.sin_audio.calculando) espera = setTimeout(ciclo, 5000);
    };
    ciclo();
    return () => { vigente = false; clearTimeout(espera); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !datos) return <section className="admin-card"><h2>Inicio</h2><p className="texto-error">{error}</p></section>;
  if (!datos) return <section className="admin-card"><h2>Inicio</h2><p className="estado-carga-admin">Consultando qué necesita atención…</p></section>;

  const grupos = Object.entries(datos.parecidos).flatMap(([clave, lista]) => lista.map((valores) => ({ clave, valores })));
  const inf = datos.informe;

  return (
    <section className="admin-card" aria-labelledby="inicio-titulo">
      <h2 id="inicio-titulo">Inicio</h2>

      <h3 id="pendientes-titulo">Qué necesita atención</h3>
      <ul className="lista-pendientes" aria-labelledby="pendientes-titulo">
        <li>
          {datos.sin_audio.calculando ? (
            <span>Calculando qué fichas no tienen audio (se revisa el almacenamiento en segundo plano)…</span>
          ) : datos.sin_audio.cantidad ? (
            <button type="button" className="btn-submit btn-secundario" onClick={() => irA('content', { filtro: { tipo: 'ids', nombre: 'sin audio', ids: datos.sin_audio.libros.map((l) => l.id) } })}>
              Ver {plural(datos.sin_audio.cantidad, 'ficha sin audio', 'fichas sin audio')}
            </button>
          ) : <span>Todas las fichas tienen audio.</span>}
        </li>
        <li>
          {!datos.sin_narrador.habilitado ? <span>El narrador todavía no está habilitado en esta base.</span>
            : datos.sin_narrador.cantidad ? (
              <button type="button" className="btn-submit btn-secundario" onClick={() => irA('content', { filtro: { tipo: 'sin_narrador', nombre: 'sin narrador' } })}>
                Ver {plural(datos.sin_narrador.cantidad, 'ficha sin narrador', 'fichas sin narrador')}
              </button>
            ) : <span>Todas las fichas tienen narrador.</span>}
        </li>
        <li>
          {!datos.borradores.habilitado ? <span>El estado de publicación todavía no está habilitado en esta base.</span>
            : datos.borradores.cantidad ? (
              <button type="button" className="btn-submit btn-secundario" onClick={() => irA('content', { filtro: { tipo: 'borrador', nombre: 'borradores' } })}>
                Ver {plural(datos.borradores.cantidad, 'borrador sin publicar', 'borradores sin publicar')}
              </button>
            ) : <span>No hay borradores pendientes.</span>}
        </li>
        <li>
          {datos.tareas_con_errores.length ? (
            <button type="button" className="btn-submit btn-secundario" onClick={() => irA('tareas')}>
              Ver {plural(datos.tareas_con_errores.length, 'tarea con errores', 'tareas con errores')}
            </button>
          ) : <span>Ninguna tarea con errores.</span>}
        </li>
        {datos.papelera.habilitado && datos.papelera.cantidad > 0 && (
          <li>
            <button type="button" className="btn-submit btn-secundario" onClick={() => irA('papelera')}>
              Ver {plural(datos.papelera.cantidad, 'ficha en la papelera', 'fichas en la papelera')}
            </button>
          </li>
        )}
      </ul>

      <h3 id="parecidos-titulo">Valores parecidos ({grupos.length})</h3>
      {grupos.length === 0 ? <p>No hay valores parecidos entre sí.</p> : (
        <ul className="lista-pendientes" aria-labelledby="parecidos-titulo">
          {grupos.map((g) => (
            <li key={`${g.clave}-${g.valores.join('|')}`}>
              <button type="button" className="btn-submit btn-secundario" onClick={() => setGrupo(g)}>
                Unir {NOMBRE_CAMPO[g.clave]}: {g.valores.join(' y ')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="informe-dia" aria-labelledby="informe-titulo">
        <h3 id="informe-titulo">Informe del día {new Date(`${inf.fecha}T12:00:00`).toLocaleDateString('es-AR')}</h3>
        {inf.habilitado === false ? <p>El registro de operaciones todavía no está habilitado en esta base.</p> : (
          <ul>
            <li>{plural(inf.creados, 'ficha creada', 'fichas creadas')}</li>
            <li>{plural(inf.importados, 'ficha importada', 'fichas importadas')}</li>
            <li>{plural(inf.publicados, 'libro publicado', 'libros publicados')}</li>
            <li>{plural(inf.pistas_subidas, 'pista subida', 'pistas subidas')}</li>
            <li>{plural(inf.eliminados, 'ficha enviada a la papelera', 'fichas enviadas a la papelera')}</li>
          </ul>
        )}
        <button type="button" className="btn-submit btn-secundario no-imprimir" onClick={() => window.print()}>Imprimir el informe</button>
      </section>

      <Dialogo abierto={!!grupo} tituloId="unir-titulo" className="modal-card modal-mediano" onClose={() => setGrupo(null)}>
        {grupo && <UnirVariantes grupo={grupo} onHecho={async () => { await cargar(); setGrupo(null); }} />}
      </Dialogo>
    </section>
  );
};

function resumenHablado(d) {
  const partes = [];
  if (d.sin_audio.calculando) partes.push('se está calculando qué fichas no tienen audio');
  else partes.push(plural(d.sin_audio.cantidad, 'ficha sin audio', 'fichas sin audio'));
  if (d.sin_narrador.habilitado) partes.push(plural(d.sin_narrador.cantidad, 'sin narrador', 'sin narrador'));
  if (d.borradores.habilitado) partes.push(plural(d.borradores.cantidad, 'borrador', 'borradores'));
  const grupos = Object.values(d.parecidos).reduce((n, l) => n + l.length, 0);
  partes.push(plural(grupos, 'grupo de valores parecidos', 'grupos de valores parecidos'));
  if (d.tareas_con_errores.length) partes.push(plural(d.tareas_con_errores.length, 'tarea con errores', 'tareas con errores'));
  return `Inicio. Pendientes: ${partes.join(', ')}.`;
}

export default Inicio;
