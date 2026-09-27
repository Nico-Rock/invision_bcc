import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';
import { fechaHablada, plural } from '../../../lib/consola';

/** Papelera (spec 005, R23): 30 días para arrepentirse; borrar ya pide confirmación. */
export const Papelera = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/papelera`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      setItems(d);
      setError('');
    } catch (err) {
      setItems([]);
      setError(err.message);
      announceText(`Papelera: ${err.message}`, { urgente: true });
      playCue('error');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restaurar = async (item) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/admin/papelera/${item.audiolibro_id}/restaurar`, { method: 'POST' });
    if (r.ok) {
      playCue('success');
      announceText(`${item.nombre} restaurado: vuelve a estar en Libros.`);
    } else {
      playCue('error');
      announceText(`No se pudo restaurar ${item.nombre}.`, { urgente: true });
    }
    await cargar();
    document.getElementById('papelera-titulo')?.focus();
  };

  const borrar = async () => {
    const item = aBorrar;
    const r = await authenticatedFetch(`${API_BASE_URL}/admin/papelera/${item.audiolibro_id}`, { method: 'DELETE' });
    if (r.ok) {
      playCue('success');
      announceText(`${item.nombre} eliminado definitivamente.`);
    } else {
      playCue('error');
      announceText(`No se pudo eliminar ${item.nombre}.`, { urgente: true });
    }
    await cargar();
    setABorrar(null);
  };

  return (
    <section className="admin-card" aria-labelledby="papelera-titulo">
      <h2 id="papelera-titulo" tabIndex="-1">Papelera ({items ? items.length : '…'})</h2>
      <p>Las fichas eliminadas se pueden restaurar durante 30 días. Los socios no las ven. El audio en el almacenamiento no se borra.</p>
      {error && <p className="texto-error">{error}</p>}
      {items === null ? <p className="estado-carga-admin">Cargando la papelera…</p> : items.length === 0 ? (
        !error && <p>La papelera está vacía.</p>
      ) : (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="papelera-titulo">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Título</th><th scope="col">Eliminado</th><th scope="col">Días para restaurar</th><th scope="col">Acciones</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.audiolibro_id}>
                  <td>{item.nombre}</td>
                  <td>{fechaHablada(item.eliminado_en)}</td>
                  <td>{plural(item.dias_restantes, 'día', 'días')}</td>
                  <td>
                    <div className="acciones-campo">
                      <button type="button" className="btn-action-edit" onClick={() => restaurar(item)}>
                        Restaurar<span className="sr-only"> {item.nombre}</span>
                      </button>
                      <button type="button" className="btn-action-delete" onClick={() => setABorrar(item)}>
                        Eliminar definitivamente<span className="sr-only"> {item.nombre}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={!!aBorrar} tituloId="borrar-titulo" className="modal-card modal-mediano" onClose={() => setABorrar(null)}>
        {aBorrar && (
          <>
            <h2 id="borrar-titulo" className="modal-title">¿Eliminar definitivamente {aBorrar.nombre}?</h2>
            <p>Se borra la ficha con su narrador, su historial y su estado. <strong>No se puede deshacer.</strong> El audio en el almacenamiento no se toca.</p>
            <div className="acciones-dialogo">
              <button type="button" className="btn-submit btn-secundario" autoFocus onClick={(e) => e.currentTarget.closest('dialog').close()}>Cancelar</button>
              <button type="button" className="btn-action-delete" onClick={borrar}>Eliminar definitivamente</button>
            </div>
          </>
        )}
      </Dialogo>
    </section>
  );
};

export default Papelera;
