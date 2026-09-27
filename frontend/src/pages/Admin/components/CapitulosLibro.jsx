import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { ordenarPistas, validarNombrePista } from '../../../lib/capitulos';

const ESTADOS = { pendiente: 'pendiente', subiendo: 'subiendo', subida: 'subida', problemas: 'subida con problemas', existe: 'ya existía, no se pisó', fallo: 'falló' };

/**
 * Capítulos de un libro, desde su ficha (spec 005, R5). Mismo modelo que la
 * carga guiada del panel (admin-dashboard/static/carga.js): orden de
 * reproducción visible y anunciado, una pista por vez con aviso de resultado,
 * las que ya existen se saltean (el permiso es de solo creación, R3) y se
 * reintentan solo las que fallaron.
 */
export const CapitulosLibro = ({ libro }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [cargados, setCargados] = useState(null);
  const [pistas, setPistas] = useState([]); // [{ file, estado }]
  const [subiendo, setSubiendo] = useState(false);
  const [verificacion, setVerificacion] = useState(null); // resumen del servidor o { nota }
  const [verificando, setVerificando] = useState(false);
  const inputRef = useRef(null);
  const accionRef = useRef(null);
  const tituloRef = useRef(null);

  const contarCargados = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/audio-by-id/${libro.id}`);
      const data = r.ok ? await r.json() : {};
      setCargados((data.capitulos || []).length);
    } catch {
      setCargados(null);
    }
  };

  // Resumen de la verificación guardada (spec 005, R20)
  const cargarVerificacion = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${libro.id}/audio`);
      const d = await r.json().catch(() => ({}));
      setVerificacion(r.ok ? d : { nota: typeof d.detail === 'string' ? d.detail : 'No se pudo consultar la verificación.' });
    } catch {
      setVerificacion({ nota: 'No se pudo consultar la verificación.' });
    }
  };

  useEffect(() => {
    // Carga inicial desde la API (mismo patrón que Home.jsx)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    contarCargados();
    cargarVerificacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libro.id]);

  const elegir = (e) => {
    const archivos = [...e.target.files];
    const rechazados = archivos.filter((f) => validarNombrePista(f.name));
    const validos = ordenarPistas(archivos.filter((f) => !validarNombrePista(f.name)));
    setPistas(validos.map((file) => ({ file, estado: 'pendiente' })));
    if (rechazados.length) {
      playCue('error');
      announceText(`${rechazados.length === 1 ? 'Un archivo no se puede subir' : `${rechazados.length} archivos no se pueden subir`}: ${rechazados.map((f) => `${f.name}, ${validarNombrePista(f.name)}`).join('; ')}`, { urgente: true });
    }
    if (validos.length) {
      announceText(`${validos.length === 1 ? '1 pista elegida' : `${validos.length} pistas elegidas`}, en este orden de reproducción: ${validos.map((f, i) => `${i + 1}, ${f.name}`).join('; ')}. Presioná Subir.`);
      setTimeout(() => accionRef.current?.focus(), 0);
    }
  };

  const subirUna = async (file) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/audiolibros/${libro.id}/capitulos/presign-upload?filename=${encodeURIComponent(file.name)}`, { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'el servidor rechazó el permiso');
    if (data.estado === 'existe') return 'existe';
    const put = await fetch(data.sas_url, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'audio/mpeg' },
      body: file,
    });
    if (!put.ok) throw new Error(`el almacenamiento respondió ${put.status}`);
    // Confirmación: el servidor comprueba que la pista llegó y la analiza (R20)
    const c = await authenticatedFetch(`${API_BASE_URL}/audiolibros/${libro.id}/capitulos/confirmar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blob_path: data.blob_path }),
    });
    const v = await c.json().catch(() => ({}));
    if (!c.ok) throw new Error(typeof v.detail === 'string' ? v.detail : 'no se pudo confirmar la subida');
    return v.problemas && v.problemas.length ? { estado: 'problemas', v } : { estado: 'subida', v };
  };

  const subir = async () => {
    setSubiendo(true);
    const estado = pistas.map((p) => ({ ...p }));
    const total = estado.length;
    announceText(`Subiendo ${estado.filter((p) => !['subida', 'problemas', 'existe'].includes(p.estado)).length} pistas, una por una.`);
    for (let i = 0; i < total; i++) {
      if (['subida', 'problemas', 'existe'].includes(estado[i].estado)) continue;
      estado[i].estado = 'subiendo';
      setPistas([...estado]);
      try {
        const resultado = await subirUna(estado[i].file);
        const nombre = estado[i].file.name;
        if (resultado === 'existe') {
          estado[i].estado = 'existe';
          playCue('action');
          announceText(`Pista ${i + 1} de ${total} ya existía, no se pisó: ${nombre}.`);
        } else if (resultado.estado === 'problemas') {
          estado[i].estado = 'problemas';
          estado[i].detalle = resultado.v.descripcion;
          playCue('error');
          announceText(`Pista ${i + 1} de ${total} subida, pero con problemas: ${nombre} ${resultado.v.descripcion}.`, { urgente: true });
        } else {
          estado[i].estado = 'subida';
          estado[i].detalle = resultado.v.duracion_hablada;
          playCue('success');
          announceText(`Pista ${i + 1} de ${total} subida: ${nombre}, ${resultado.v.duracion_hablada}.`);
        }
      } catch (err) {
        console.error(err);
        estado[i].estado = 'fallo';
        playCue('error');
        announceText(`No se pudo subir ${estado[i].file.name}: ${err.message}.`, { urgente: true });
      }
      setPistas([...estado]);
    }
    setSubiendo(false);
    const subidas = estado.filter((p) => p.estado === 'subida' || p.estado === 'problemas').length;
    const existian = estado.filter((p) => p.estado === 'existe').length;
    const fallidas = estado.filter((p) => p.estado === 'fallo');
    const resumen = `${subidas === 1 ? '1 subida' : `${subidas} subidas`}, ${existian === 1 ? '1 ya existía' : `${existian} ya existían`}`;
    if (fallidas.length) {
      announceText(`${fallidas.length === 1 ? '1 pista no se pudo subir' : `${fallidas.length} pistas no se pudieron subir`}: ${fallidas.map((p) => p.file.name).join(', ')}. ${resumen}. Presioná Reintentar.`, { urgente: true });
    } else {
      announceText(`Carga completa: todas las pistas están en el almacenamiento. ${resumen}.`);
      contarCargados();
      cargarVerificacion();
      // El botón desaparece: el foco va al título de la sección, nunca a la nada
      setTimeout(() => tituloRef.current?.focus(), 0);
      return;
    }
    setTimeout(() => accionRef.current?.focus(), 0);
  };

  // Verificar todas las pistas como tarea (R20, R21): el aviso al terminar lo da la consola
  const verificarTodo = async () => {
    setVerificando(true);
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${libro.id}/verificar`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      playCue('action');
      announceText(`Verificando ${d.total === 1 ? '1 pista' : `${d.total} pistas`} en segundo plano. Te aviso cuando termine.`);
      const esperar = async () => {
        const t = await authenticatedFetch(`${API_BASE_URL}/admin/tareas/${d.tarea_id}`).then((x) => x.json()).catch(() => null);
        if (t && (t.estado === 'encolada' || t.estado === 'en_curso')) return setTimeout(esperar, 2000);
        setVerificando(false);
        cargarVerificacion();
      };
      esperar();
    } catch (err) {
      setVerificando(false);
      playCue('error');
      announceText(`No se pudo verificar el audio: ${err.message}.`, { urgente: true });
    }
  };

  const pendientes = pistas.filter((p) => p.estado === 'pendiente').length;
  const fallidas = pistas.filter((p) => p.estado === 'fallo').length;
  const textoAccion = fallidas
    ? `Reintentar ${fallidas === 1 ? '1 pista' : `${fallidas} pistas`}`
    : `Subir ${pendientes === 1 ? '1 pista' : `${pendientes} pistas`}`;

  return (
    <section className="capitulos-libro" aria-labelledby="capitulos-titulo">
      <h3 id="capitulos-titulo" tabIndex="-1" ref={tituloRef}>Capítulos</h3>
      <p>
        {cargados === null ? 'No se pudo consultar cuántos capítulos tiene.'
          : cargados === 0 ? 'Este libro todavía no tiene audio.'
          : `Tiene ${cargados === 1 ? '1 capítulo cargado' : `${cargados} capítulos cargados`}.`}
      </p>
      <p className="nota-campo">Las pistas se suben al almacenamiento real de la biblioteca. Una pista que ya existe nunca se reemplaza.</p>

      <h4 id={`verificacion-${libro.id}`}>Verificación del audio</h4>
      {verificacion === null ? <p>Consultando la verificación…</p> : verificacion.nota ? <p className="nota-campo">{verificacion.nota}</p> : (
        <>
          <p>
            {verificacion.verificadas === 0 ? 'Todavía no se verificó ninguna pista.'
              : `${verificacion.verificadas === 1 ? '1 pista verificada' : `${verificacion.verificadas} pistas verificadas`}, duración total ${verificacion.duracion_total_hablada}.`}
            {' '}{verificacion.pistas.filter((p) => p.problemas.length).length > 0
              && `Con problemas: ${verificacion.pistas.filter((p) => p.problemas.length).map((p) => `${p.nombre} (${p.descripcion})`).join('; ')}.`}
          </p>
          <p className="nota-campo">Se mide la duración y se detectan archivos vacíos, dañados o cortados. Los silencios largos todavía no se detectan.</p>
          <button type="button" className="btn-submit btn-secundario" disabled={verificando} aria-busy={verificando} onClick={verificarTodo}>
            Verificar todo el audio del libro
          </button>
        </>
      )}


      <label className="form-label" htmlFor={`pistas-${libro.id}`}>Elegí los archivos MP3 (podés elegir varios)</label>
      <input
        ref={inputRef}
        id={`pistas-${libro.id}`}
        type="file"
        accept=".mp3,audio/mpeg"
        multiple
        className="form-input"
        onChange={elegir}
        disabled={subiendo}
      />

      {pistas.length > 0 && (
        <>
          <p className="form-label" id="orden-titulo">Orden de reproducción</p>
          <ol className="orden-pistas" aria-labelledby="orden-titulo">
            {pistas.map((p) => (
              <li key={p.file.name}>{p.file.name} — {ESTADOS[p.estado]}{p.detalle ? `: ${p.detalle}` : ''}</li>
            ))}
          </ol>
          {(pendientes > 0 || fallidas > 0) && (
            <button ref={accionRef} type="button" className="btn-submit" onClick={subir} disabled={subiendo} aria-busy={subiendo}>
              {subiendo ? 'Subiendo…' : textoAccion}
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default CapitulosLibro;
