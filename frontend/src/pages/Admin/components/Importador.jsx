import { useState, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { plural } from '../../../lib/consola';

const CAMPOS = ['nombre', 'autor', 'narrador', 'genero', 'descripcion', 'categoria', 'clasificaciones'];

/**
 * Importar fichas desde CSV (spec 005, R22). Reemplaza la "ingesta" que
 * adivinaba columnas y anunciaba éxitos inventados: acá se analiza sin
 * escribir, se dice qué columna se tomó para qué, se lista cada problema y
 * recién después se confirma. Las fichas nacen en borrador.
 */
export const Importador = ({ irA }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [texto, setTexto] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [analisis, setAnalisis] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [enviando, setEnviando] = useState(false);
  const resumenRef = useRef(null);

  const fallar = (t) => {
    playCue('error');
    announceText(t, { urgente: true });
  };

  const analizar = async (contenido, mapeoElegido) => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/importador/analizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: contenido, mapeo: mapeoElegido || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'el servidor no pudo leer el archivo');
      setAnalisis(d);
      setMapeo(d.mapeo);
      const s = d.resumen;
      const columnas = Object.entries(d.mapeo).map(([col, campo]) => `${col} como ${d.nombres_campos[campo]}`).join(', ');
      if (s.bloqueante) {
        fallar(`No se puede importar: ${s.bloqueante}`);
      } else {
        playCue(s.bloqueadas ? 'error' : 'success');
        announceText(`${plural(s.filas, 'fila', 'filas')}: ${plural(s.listas, 'lista para importar', 'listas para importar')}${s.con_avisos ? `, de las cuales ${plural(s.con_avisos, 'tiene un aviso', 'tienen avisos')}` : ''}, ${plural(s.bloqueadas, 'bloqueada', 'bloqueadas')}. Columnas: ${columnas}.${d.ignoradas.length ? ` Se ignoran: ${d.ignoradas.join(', ')}.` : ''}`);
      }
      setTimeout(() => resumenRef.current?.focus(), 0);
    } catch (err) {
      fallar(`No se pudo analizar el archivo: ${err.message}.`);
    }
  };

  const elegir = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      fallar('Elegí un archivo CSV. Desde una planilla: Archivo, Descargar o Guardar como, CSV.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setTexto(lector.result);
      setNombreArchivo(archivo.name);
      analizar(lector.result, null);
    };
    lector.onerror = () => fallar('No se pudo leer el archivo.');
    lector.readAsText(archivo, 'utf-8');
  };

  const cambiarMapeo = (columna, campo) => {
    const nuevo = { ...mapeo };
    // Un campo va a una sola columna: si otra lo tenía, queda sin importar
    for (const [c, v] of Object.entries(nuevo)) if (v === campo && c !== columna) delete nuevo[c];
    if (campo) nuevo[columna] = campo; else delete nuevo[columna];
    setMapeo(nuevo);
  };

  const importar = async () => {
    setEnviando(true);
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/importador/ejecutar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, mapeo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      playCue('action');
      announceText(`Importación en curso: ${plural(d.total, 'ficha', 'fichas')}. Te aviso cuando termine; el avance está en la pestaña Tareas.`);
      setAnalisis(null);
      setTexto('');
      setNombreArchivo('');
    } catch (err) {
      fallar(`No se pudo iniciar la importación: ${err.message}.`);
    } finally {
      setEnviando(false);
    }
  };

  const s = analisis?.resumen;
  const cambioMapeo = analisis && JSON.stringify(mapeo) !== JSON.stringify(analisis.mapeo);

  return (
    <section className="admin-card" aria-labelledby="import-title">
      <h2 id="import-title">Importar fichas desde CSV</h2>
      <p>
        Crea fichas <strong>en borrador</strong> a partir de una planilla guardada como CSV. Primero se analiza y se
        te dice qué pasa con cada fila; nada se escribe hasta que confirmes. El audio se sube después, desde cada ficha.
      </p>
      <p className="nota-campo">La transferencia de audio desde SharePoint sigue deshabilitada: la versión anterior anunciaba cargas que no ocurrían.</p>

      <label className="form-label" htmlFor="archivo-csv">Elegí el archivo CSV</label>
      <input id="archivo-csv" type="file" accept=".csv,text/csv" className="form-input" onChange={elegir} />

      {analisis && (
        <>
          <h3 id="resumen-importacion" tabIndex="-1" ref={resumenRef}>Resumen de {nombreArchivo}</h3>
          {s.bloqueante ? <p className="texto-error">{s.bloqueante}</p> : (
            <p>{plural(s.filas, 'fila', 'filas')}: {plural(s.listas, 'lista', 'listas')} para importar{s.con_avisos ? ` (${plural(s.con_avisos, 'con aviso', 'con avisos')})` : ''} y {plural(s.bloqueadas, 'bloqueada', 'bloqueadas')}.</p>
          )}

          <fieldset className="form-group">
            <legend className="form-label">Qué columna es cada dato</legend>
            {analisis.columnas.map((col, i) => (
              <div key={col} className="form-group">
                <label className="form-label" htmlFor={`col-${i}`}>Columna «{col}»</label>
                <select id={`col-${i}`} className="form-input" value={mapeo[col] || ''} onChange={(e) => cambiarMapeo(col, e.target.value)}>
                  <option value="">No importar</option>
                  {CAMPOS.map((c) => <option key={c} value={c}>{analisis.nombres_campos[c]}</option>)}
                </select>
              </div>
            ))}
            {cambioMapeo && (
              <button type="button" className="btn-submit btn-secundario" onClick={() => analizar(texto, mapeo)}>Volver a analizar con estas columnas</button>
            )}
          </fieldset>

          {analisis.problemas.length > 0 && (
            <>
              <h3 id="problemas-importacion">Filas con problemas o avisos ({analisis.problemas.length})</h3>
              <ol className="orden-pistas" aria-labelledby="problemas-importacion">
                {analisis.problemas.map((p) => (
                  <li key={p.fila}>
                    Fila {p.fila}{p.titulo ? `, ${p.titulo}` : ''}: {p.bloquea ? 'no se importa' : 'se importa'} — {p.motivos.join('; ')}.
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="acciones-dialogo">
            <button type="button" className="btn-submit" onClick={importar} disabled={enviando || !!s.bloqueante || s.listas === 0 || cambioMapeo}>
              Importar {plural(s.listas, 'ficha', 'fichas')} en borrador
            </button>
            <button type="button" className="btn-submit btn-secundario" onClick={() => irA('tareas')}>Ir a Tareas</button>
          </div>
        </>
      )}
    </section>
  );
};

export default Importador;
