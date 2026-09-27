import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';
import { ESTADOS_TAREA, fechaHablada, tareaActiva } from '../../../lib/consola';

/**
 * Tareas largas con estado real (spec 005, R21): se consultan en cualquier
 * momento, con el avance y el resultado de cada ítem. El aviso al terminar lo
 * da el vigilante de la consola, desde cualquier pestaña.
 */
export const Tareas = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [tareas, setTareas] = useState(null);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);

  const cargar = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/tareas`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      setTareas(d);
      setError('');
      return d;
    } catch (err) {
      setTareas([]);
      setError(err.message);
      announceText(`Tareas: ${err.message}`, { urgente: true });
      playCue('error');
      return [];
    }
  };

  useEffect(() => {
    let vigente = true;
    let espera;
    const ciclo = async () => {
      const d = await cargar();
      if (vigente && d.some(tareaActiva)) espera = setTimeout(ciclo, 3000);
    };
    ciclo();
    return () => { vigente = false; clearTimeout(espera); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verDetalle = async (t) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/admin/tareas/${t.id}`);
    if (r.ok) setDetalle(await r.json());
  };

  return (
    <section className="admin-card" aria-labelledby="tareas-titulo">
      <h2 id="tareas-titulo">Tareas ({tareas ? tareas.length : '…'})</h2>
      <p>Las tareas largas siguen aunque cambies de pestaña. Te aviso cuando terminan.</p>
      {error && <p className="texto-error">{error}</p>}
      {tareas === null ? <p className="estado-carga-admin">Cargando tareas…</p> : tareas.length === 0 ? (
        !error && <p>No hay tareas.</p>
      ) : (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="tareas-titulo">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Tarea</th><th scope="col">Estado</th><th scope="col">Avance</th><th scope="col">Iniciada</th><th scope="col">Acciones</th></tr>
            </thead>
            <tbody>
              {tareas.map((t) => (
                <tr key={t.id}>
                  <td>{t.titulo}</td>
                  <td>{ESTADOS_TAREA[t.estado]}</td>
                  <td>{t.hechos} de {t.total}{t.fallidos ? `, ${t.fallidos} con problemas` : ''}</td>
                  <td>{fechaHablada(t.creada_en)}</td>
                  <td>
                    <button type="button" className="btn-action-edit" onClick={() => verDetalle(t)}>
                      Ver detalle<span className="sr-only"> de {t.titulo}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={!!detalle} tituloId="detalle-tarea-titulo" className="modal-card modal-ancho" onClose={() => setDetalle(null)}>
        {detalle && (
          <>
            <h2 id="detalle-tarea-titulo" className="modal-title">{detalle.titulo}</h2>
            <p>Estado: {ESTADOS_TAREA[detalle.estado]}. {detalle.hechos} de {detalle.total}{detalle.fallidos ? `, ${detalle.fallidos} con problemas` : ''}.</p>
            {detalle.detalle.length > 0 && (
              <ol className="orden-pistas">
                {detalle.detalle.map((item, i) => (
                  <li key={`${item.nombre}-${i}`}>{item.nombre}: {item.estado === 'ok' ? 'bien' : 'con problemas'}, {item.mensaje}</li>
                ))}
              </ol>
            )}
            <div className="acciones-dialogo">
              <button type="button" className="btn-submit btn-secundario" onClick={(e) => e.currentTarget.closest('dialog').close()}>Cerrar</button>
            </div>
          </>
        )}
      </Dialogo>
    </section>
  );
};

export default Tareas;
