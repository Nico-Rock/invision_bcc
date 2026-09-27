import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { ordenarPistas, validarNombrePista } from '../../../lib/capitulos';

const ESTADOS = { pendiente: 'pendiente', subiendo: 'subiendo', subida: 'subida', existe: 'ya existía, no se pisó', fallo: 'falló' };

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

  useEffect(() => {
    // Carga inicial desde la API (mismo patrón que Home.jsx)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    contarCargados();
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
    return 'subida';
  };

  const subir = async () => {
    setSubiendo(true);
    const estado = pistas.map((p) => ({ ...p }));
    const total = estado.length;
    announceText(`Subiendo ${estado.filter((p) => p.estado !== 'subida' && p.estado !== 'existe').length} pistas, una por una.`);
    for (let i = 0; i < total; i++) {
      if (estado[i].estado === 'subida' || estado[i].estado === 'existe') continue;
      estado[i].estado = 'subiendo';
      setPistas([...estado]);
      try {
        estado[i].estado = await subirUna(estado[i].file);
        playCue(estado[i].estado === 'subida' ? 'success' : 'action');
        announceText(estado[i].estado === 'subida'
          ? `Pista ${i + 1} de ${total} subida: ${estado[i].file.name}.`
          : `Pista ${i + 1} de ${total} ya existía, no se pisó: ${estado[i].file.name}.`);
      } catch (err) {
        console.error(err);
        estado[i].estado = 'fallo';
        playCue('error');
        announceText(`No se pudo subir ${estado[i].file.name}: ${err.message}.`, { urgente: true });
      }
      setPistas([...estado]);
    }
    setSubiendo(false);
    const subidas = estado.filter((p) => p.estado === 'subida').length;
    const existian = estado.filter((p) => p.estado === 'existe').length;
    const fallidas = estado.filter((p) => p.estado === 'fallo');
    const resumen = `${subidas === 1 ? '1 subida' : `${subidas} subidas`}, ${existian === 1 ? '1 ya existía' : `${existian} ya existían`}`;
    if (fallidas.length) {
      announceText(`${fallidas.length === 1 ? '1 pista no se pudo subir' : `${fallidas.length} pistas no se pudieron subir`}: ${fallidas.map((p) => p.file.name).join(', ')}. ${resumen}. Presioná Reintentar.`, { urgente: true });
    } else {
      announceText(`Carga completa: todas las pistas están en el almacenamiento. ${resumen}.`);
      contarCargados();
      // El botón desaparece: el foco va al título de la sección, nunca a la nada
      setTimeout(() => tituloRef.current?.focus(), 0);
      return;
    }
    setTimeout(() => accionRef.current?.focus(), 0);
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
              <li key={p.file.name}>{p.file.name} — {ESTADOS[p.estado]}</li>
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
