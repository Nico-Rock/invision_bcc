import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../hooks/useAudio';
import { API_BASE_URL } from '../../config';
import { ExcelImporter } from './components/ExcelImporter';
import { AuditLogs } from './components/AuditLogs';
import { UserManagement } from './components/UserManagement';
import { ContentManagement } from './components/ContentManagement';

// Orden y nombres visibles de las pestañas (spec 005, R13 y R14). La consola abre
// en Libros: es la tarea principal y la ingesta está deshabilitada.
const PESTANAS = [
  { id: 'content', nombre: 'Libros' },
  { id: 'users', nombre: 'Usuarios' },
  { id: 'audit', nombre: 'Auditoría' },
  { id: 'import', nombre: 'Ingesta Masiva' },
];

export const AdminPanel = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [activeTab, setActiveTab] = useState('content');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const tabRefs = useRef({});

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/auditoria/sesiones/`);
      if (!response.ok) throw new Error(String(response.status));
      setAuditLogs(await response.json());
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      announceText('No se pudo cargar la auditoría de accesos.', { urgente: true });
      playCue('error');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    // Carga inicial desde la API (mismo patrón que Home.jsx)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un solo aviso, con el nombre que se ve (antes: dos avisos y otro nombre)
  const changeTab = (id) => {
    setActiveTab(id);
    const pestana = PESTANAS.find((p) => p.id === id);
    announceText(`${pestana.nombre}.`);
    playCue('action');
    setTimeout(() => tabRefs.current[id]?.focus(), 0);
  };

  // Patrón de pestañas ARIA completo: flechas, Inicio y Fin
  const handleTabKeyDown = (e, index) => {
    const ultimo = PESTANAS.length - 1;
    const destino = { ArrowRight: index === ultimo ? 0 : index + 1, ArrowLeft: index === 0 ? ultimo : index - 1, Home: 0, End: ultimo }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    changeTab(PESTANAS[destino].id);
  };

  return (
    <div className="admin-panel-container">
      <header className="admin-header">
        <h1 className="admin-title">Panel de Administración</h1>
        <p className="admin-subtitulo">
          Gestión del patrimonio digital de la Biblioteca Central para Ciegos
        </p>
      </header>

      <div role="tablist" aria-label="Secciones de administración" className="tabs-header">
        {PESTANAS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => { tabRefs.current[p.id] = el; }}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={activeTab === p.id}
            aria-controls={`panel-${p.id}`}
            className={`tab-btn ${activeTab === p.id ? 'active' : ''}`}
            tabIndex={activeTab === p.id ? 0 : -1}
            onClick={() => changeTab(p.id)}
            onKeyDown={(e) => handleTabKeyDown(e, i)}
            onFocus={() => playCue('focus')}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {PESTANAS.map((p) => (
        <div key={p.id} id={`panel-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} hidden={activeTab !== p.id}>
          {activeTab === 'content' && p.id === 'content' && <ContentManagement />}
          {activeTab === 'users' && p.id === 'users' && <UserManagement />}
          {activeTab === 'audit' && p.id === 'audit' && <AuditLogs auditLogs={auditLogs} loadingAudit={loadingAudit} />}
          {activeTab === 'import' && p.id === 'import' && <ExcelImporter onIrALibros={() => changeTab('content')} />}
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
