import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { OPERACIONES, fechaHablada } from '../../../lib/consola';
import { notaAccesos } from '../../../lib/pendientes';

const leer = async (fetcher, url) => {
  const r = await fetcher(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
    err.status = r.status;
    throw err;
  }
  return d;
};

/**
 * Auditoría (spec 005, R12 y R26): quién hizo qué con el contenido y quién
 * entró, en tablas con encabezados y en palabras, sin números sueltos.
 */
export const AuditLogs = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [operaciones, setOperaciones] = useState(null);
  const [errorOps, setErrorOps] = useState('');
  const [accesos, setAccesos] = useState(null);
  const [notaDeAccesos, setNotaDeAccesos] = useState(''); // base sin tabla de sesiones: no es una falla
  const [filtro, setFiltro] = useState('');

  const cargarOperaciones = async (operacion) => {
    try {
      const q = operacion ? `?operacion=${encodeURIComponent(operacion)}` : '';
      setOperaciones(await leer(authenticatedFetch, `${API_BASE_URL}/admin/operaciones${q}`));
      setErrorOps('');
    } catch (err) {
      setOperaciones([]);
      setErrorOps(err.message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarOperaciones('');
    leer(authenticatedFetch, `${API_BASE_URL}/admin/auditoria/sesiones/`)
      .then(setAccesos)
      .catch((err) => {
        setAccesos([]);
        const n = notaAccesos(err.status, err.message);
        if (n.tipo === 'nota') {
          // 503 por falta de la tabla de sesiones: se dice, sin alarma
          setNotaDeAccesos(n.texto);
          announceText(`Accesos: ${n.texto}`);
          return;
        }
        announceText(n.texto, { urgente: true });
        playCue('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrar = async (valor) => {
    setFiltro(valor);
    await cargarOperaciones(valor);
  };

  useEffect(() => {
    if (operaciones && filtro !== undefined) announceText(`${operaciones.length} ${operaciones.length === 1 ? 'cambio' : 'cambios'}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operaciones]);

  return (
    <section className="admin-card" aria-labelledby="audit-title">
      <h2 id="audit-title">Auditoría</h2>

      <h3 id="cambios-titulo">Cambios de contenido ({operaciones ? operaciones.length : '…'})</h3>
      <label className="form-label" htmlFor="filtro-operacion">Mostrar</label>
      <select id="filtro-operacion" className="form-input" value={filtro} onChange={(e) => filtrar(e.target.value)}>
        <option value="">Todos los cambios</option>
        {Object.entries(OPERACIONES).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
      </select>
      {errorOps && <p className="texto-error">{errorOps}</p>}
      {operaciones && operaciones.length > 0 && (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="cambios-titulo">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Persona</th><th scope="col">Qué hizo</th><th scope="col">Sobre qué</th><th scope="col">Detalle</th><th scope="col">Cuándo</th></tr>
            </thead>
            <tbody>
              {operaciones.map((o) => (
                <tr key={o.id}>
                  <td>{o.usuario?.username || 'Cuenta desconocida'}</td>
                  <td>{OPERACIONES[o.operacion] || o.operacion}</td>
                  <td>{o.objeto || 'Sin objeto'}</td>
                  <td>{o.detalle || 'Sin detalle'}</td>
                  <td>{fechaHablada(o.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {operaciones && operaciones.length === 0 && !errorOps && <p>No hay cambios registrados.</p>}

      <h3 id="accesos-titulo">Accesos ({notaDeAccesos ? 'sin registro' : accesos ? accesos.length : '…'})</h3>
      {notaDeAccesos ? (
        <p className="nota-campo">{notaDeAccesos}</p>
      ) : accesos === null ? (
        <p className="estado-carga-admin">Cargando eventos de acceso…</p>
      ) : accesos.length === 0 ? (
        <p className="estado-carga-admin">No hay eventos de inicio o cierre de sesión registrados.</p>
      ) : (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="accesos-titulo">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Persona</th><th scope="col">Correo</th><th scope="col">Evento</th><th scope="col">Fecha y hora</th></tr>
            </thead>
            <tbody>
              {accesos.map((log) => (
                <tr key={log.id}>
                  <td>{log.usuario?.username || `Cuenta ${log.usuario_id}`}</td>
                  <td>{log.usuario?.email || 'Sin correo'}</td>
                  <td>{log.tipo_evento === 'LOGIN' ? 'Inició sesión' : 'Cerró sesión'}</td>
                  <td>{fechaHablada(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AuditLogs;
