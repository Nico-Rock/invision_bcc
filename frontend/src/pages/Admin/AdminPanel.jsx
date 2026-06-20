import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../hooks/useAudio';
import { API_BASE_URL } from '../../config';
import { ExcelImporter } from './components/ExcelImporter';
import { AuditLogs } from './components/AuditLogs';
import { UserManagement } from './components/UserManagement';
import { ContentManagement } from './components/ContentManagement';

export const AdminPanel = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [activeTab, setActiveTab] = useState('import');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const tabRefs = {
    import: useRef(null),
    users: useRef(null),
    content: useRef(null),
    audit: useRef(null)
  };

  const tabsList = ['import', 'users', 'content', 'audit'];

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/auditoria/sesiones/`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (tabName) => {
    setActiveTab(tabName);
    
    // Announce active tab verbally
    let verbalName = '';
    if (tabName === 'import') verbalName = 'Ingesta Masiva';
    else if (tabName === 'users') verbalName = 'Gestión de Usuarios';
    else if (tabName === 'content') verbalName = 'Gestión de Contenido';
    else if (tabName === 'audit') verbalName = 'Auditoría de Accesos';

    announceText(`Mostrando pestaña de ${verbalName}`);
    playCue('action');

    // Set focus on the selected tab button for keyboard users
    setTimeout(() => {
      if (tabRefs[tabName].current) {
        tabRefs[tabName].current.focus();
      }
    }, 50);
  };

  const handleTabKeyDown = (e, index) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % tabsList.length;
      e.preventDefault();
      changeTab(tabsList[newIndex]);
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabsList.length) % tabsList.length;
      e.preventDefault();
      changeTab(tabsList[newIndex]);
    }
  };

  return (
    <div className="admin-panel-container">
      <header className="admin-header">
        <h1 className="admin-title">Panel de Administración e Ingesta</h1>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>
          Gestión del patrimonio digital de la Biblioteca Central para Ciegos
        </p>
      </header>

      {/* ARIA Accessible Tablist */}
      <div 
        role="tablist" 
        aria-label="Panel de Administración" 
        className="tabs-header"
      >
        <button
          ref={tabRefs.import}
          role="tab"
          id="tab-import"
          aria-selected={activeTab === 'import'}
          aria-controls="panel-import"
          className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          tabIndex={activeTab === 'import' ? 0 : -1}
          onClick={() => changeTab('import')}
          onKeyDown={(e) => handleTabKeyDown(e, 0)}
          onFocus={() => playCue('focus')}
        >
          Ingesta Masiva
        </button>

        <button
          ref={tabRefs.users}
          role="tab"
          id="tab-users"
          aria-selected={activeTab === 'users'}
          aria-controls="panel-users"
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          tabIndex={activeTab === 'users' ? 0 : -1}
          onClick={() => changeTab('users')}
          onKeyDown={(e) => handleTabKeyDown(e, 1)}
          onFocus={() => playCue('focus')}
        >
          Usuarios
        </button>

        <button
          ref={tabRefs.content}
          role="tab"
          id="tab-content"
          aria-selected={activeTab === 'content'}
          aria-controls="panel-content"
          className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          tabIndex={activeTab === 'content' ? 0 : -1}
          onClick={() => changeTab('content')}
          onKeyDown={(e) => handleTabKeyDown(e, 2)}
          onFocus={() => playCue('focus')}
        >
          Libros
        </button>

        <button
          ref={tabRefs.audit}
          role="tab"
          id="tab-audit"
          aria-selected={activeTab === 'audit'}
          aria-controls="panel-audit"
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          tabIndex={activeTab === 'audit' ? 0 : -1}
          onClick={() => changeTab('audit')}
          onKeyDown={(e) => handleTabKeyDown(e, 3)}
          onFocus={() => playCue('focus')}
        >
          Auditoría
        </button>
      </div>

      {/* Tab Panels */}
      <div 
        id="panel-import" 
        role="tabpanel" 
        aria-labelledby="tab-import" 
        hidden={activeTab !== 'import'}
      >
        {activeTab === 'import' && (
          <ExcelImporter fetchAuditLogs={fetchAuditLogs} />
        )}
      </div>

      <div 
        id="panel-users" 
        role="tabpanel" 
        aria-labelledby="tab-users" 
        hidden={activeTab !== 'users'}
      >
        {activeTab === 'users' && (
          <UserManagement />
        )}
      </div>

      <div 
        id="panel-content" 
        role="tabpanel" 
        aria-labelledby="tab-content" 
        hidden={activeTab !== 'content'}
      >
        {activeTab === 'content' && (
          <ContentManagement />
        )}
      </div>

      <div 
        id="panel-audit" 
        role="tabpanel" 
        aria-labelledby="tab-audit" 
        hidden={activeTab !== 'audit'}
      >
        {activeTab === 'audit' && (
          <AuditLogs auditLogs={auditLogs} loadingAudit={loadingAudit} />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
