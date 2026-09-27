// Auditoría legible (spec 005, R12): quién, qué y cuándo en una tabla con
// encabezados. Antes era una región viva (role="log", la tercera de la página)
// con filas enfocables que decían "Usuario ID: 5".
export const AuditLogs = ({ auditLogs, loadingAudit }) => (
  <section className="admin-card" aria-labelledby="audit-title">
    <h2 id="audit-title">Auditoría de accesos ({auditLogs.length})</h2>

    {loadingAudit ? (
      <p className="estado-carga-admin">Cargando eventos de acceso…</p>
    ) : auditLogs.length === 0 ? (
      <p className="estado-carga-admin">No hay eventos de inicio o cierre de sesión registrados.</p>
    ) : (
      <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="audit-title">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Correo</th>
              <th scope="col">Evento</th>
              <th scope="col">Fecha y hora</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => {
              const fecha = log.timestamp ? new Date(log.timestamp) : null;
              return (
                <tr key={log.id}>
                  <td>{log.usuario?.username || `Cuenta ${log.usuario_id}`}</td>
                  <td>{log.usuario?.email || 'Sin correo'}</td>
                  <td>{log.tipo_evento === 'LOGIN' ? 'Inició sesión' : 'Cerró sesión'}</td>
                  <td>{fecha ? `${fecha.toLocaleDateString('es-AR')} a las ${fecha.toLocaleTimeString('es-AR')}` : 'Sin fecha'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default AuditLogs;
