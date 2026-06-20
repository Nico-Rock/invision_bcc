import { useAudio } from '../../../hooks/useAudio';

export const AuditLogs = ({ auditLogs, loadingAudit }) => {
  const { playCue } = useAudio();

  return (
    <div className="admin-card" aria-labelledby="audit-title">
      <h2 id="audit-title">Auditoría de Sesiones y Accesos</h2>

      {loadingAudit ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', fontWeight: 'bold' }}>
          Cargando logs de acceso...
        </div>
      ) : auditLogs.length === 0 ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No se registran eventos de inicio o cierre de sesión.
        </div>
      ) : (
        <div className="audit-list" role="log" aria-label="Historial de inicios y cierres de sesión">
          {auditLogs.map((log) => {
            const date = new Date(log.timestamp);
            return (
              <div key={log.id} className="audit-item" tabIndex="0" onFocus={() => playCue('focus')}>
                <div>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Usuario ID: {log.usuario_id}</span>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {date.toLocaleDateString()} a las {date.toLocaleTimeString()}
                  </div>
                </div>
                <span className={`audit-badge ${log.tipo_evento.toLowerCase()}`}>
                  {log.tipo_evento === 'LOGIN' ? 'INICIO SESIÓN' : 'CERRÓ SESIÓN'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default AuditLogs;
