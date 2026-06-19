import { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AudioProvider } from './context/AudioContext';
import { useAudio } from './hooks/useAudio';
import { A11yBar } from './components/A11yBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { AudioPlayer } from './components/AudioPlayer';

// View Placeholders (Profile and AdminImport placeholders remain here for now)
const ProfileView = () => {
  const { user } = useAuth();
  return (
    <section aria-labelledby="profile-title">
      <h2 id="profile-title" className="results-heading">Mi Perfil</h2>
      <div style={{ padding: '2rem 0', fontWeight: 'bold' }}>
        <p>Usuario: {user?.email || 'Cargando...'}</p>
        <p>Roles: {user?.roles?.join(', ') || 'Usuario'}</p>
      </div>
    </section>
  );
};

const AdminImportView = () => {
  return (
    <section aria-labelledby="admin-title">
      <h2 id="admin-title" className="results-heading">Panel de Administración - Ingesta de Lotes</h2>
      <div style={{ padding: '2rem 0', fontWeight: 'bold' }}>
        Vista de carga masiva desde Excel y SharePoint.
      </div>
    </section>
  );
};

// Protected Route Wrapper
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', fontWeight: 'bold' }}>Cargando sesión...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Main App Wrapper to bind routing, state, and shortcuts
const AppContent = () => {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { announceText, playCue } = useAudio();
  const [showHelp, setShowHelp] = useState(false);
  
  const searchInputRef = useRef(null);
  const genresBoxRef = useRef(null);

  // Bind Keyboard Shortcuts hook
  useKeyboardShortcuts({
    onFocusSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    },
    onFocusGenres: () => {
      if (genresBoxRef.current) {
        genresBoxRef.current.focus();
      }
    },
    onToggleHelp: (show) => {
      setShowHelp(show);
      if (show) {
        announceText('Ayuda de atajos de teclado abierta.');
        playCue('action');
      } else {
        announceText('Ayuda de atajos de teclado cerrada.');
        playCue('action');
      }
    }
  });

  const handleLogout = async () => {
    await logout();
    announceText('Sesión cerrada correctamente. Volviendo a la pantalla de ingreso.');
    playCue('action');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <A11yBar />

      <div className="app-layout">
        {isAuthenticated && (
          <aside className="sidebar" role="complementary" aria-label="Menú principal y categorías">
            <nav className="sidebar-section" aria-label="Navegación del sistema">
              <h2 className="sidebar-title">Menú</h2>
              <ul className="nav-menu">
                <li>
                  <NavLink to="/perfil" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>[1] Perfil</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span>[2] Catálogo</span>
                  </NavLink>
                </li>
                {isAdmin && (
                  <li>
                    <NavLink to="/admin/import" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>[3] Admin Ingesta</span>
                    </NavLink>
                  </li>
                )}
              </ul>
            </nav>

            <div className="sidebar-section">
              <h2 className="sidebar-title" id="genres-heading">Categorías [4]</h2>
              <div 
                ref={genresBoxRef} 
                className="genres-box" 
                tabIndex="0" 
                aria-labelledby="genres-heading"
                onFocus={() => playCue('focus')}
              >
                <ul className="genres-list" role="menu">
                  <li role="none">
                    <button className="genre-btn" role="menuitem" onClick={() => announceText('Filtrando Biografías')}>
                      BIOGRAFÍAS
                    </button>
                  </li>
                  <li role="none">
                    <button className="genre-btn" role="menuitem" onClick={() => announceText('Filtrando Literatura')}>
                      LITERATURA
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        )}

        <main id="main-content-section" className="main-content" role="main">
          {isAuthenticated && (
            <div className="top-bar">
              <button 
                className="shortcuts-help-btn" 
                onClick={() => {
                  setShowHelp(true);
                  announceText('Atajos de teclado abiertos.');
                  playCue('action');
                }}
                aria-label="Ver atajos de teclado y ayuda"
              >
                <span>❓ Ayuda de Atajos</span>
              </button>
              
              <button 
                className="btn-logout" 
                onClick={handleLogout}
                aria-label="Cerrar sesión"
              >
                <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Salir
              </button>
            </div>
          )}

          <Routes>
            <Route 
              path="/login" 
              element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/perfil" 
              element={
                <ProtectedRoute>
                  <ProfileView />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/import" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminImportView />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <AudioPlayer />

      {/* Shortcuts modal dialog */}
      <div 
        className={`modal-overlay ${showHelp ? 'active' : ''}`} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="modal-title"
      >
        <div className="modal-card">
          <h2 className="modal-title" id="modal-title">Atajos de Teclado Disponibles</h2>
          <table className="shortcuts-table">
            <tbody>
              <tr>
                <td><kbd className="kbd-tag">Shift + S</kbd> o <kbd className="kbd-tag">S</kbd></td>
                <td>Ir al buscador</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">Espacio</kbd> (en reproductor)</td>
                <td>Reproducir / Pausar</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">Flecha Izquierda / Derecha</kbd></td>
                <td>Retroceder / Adelantar 15s</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">1</kbd> / <kbd className="kbd-tag">2</kbd> / <kbd className="kbd-tag">3</kbd></td>
                <td>Ir a Perfil / Catálogo / Admin</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">4</kbd> o <kbd className="kbd-tag">G</kbd></td>
                <td>Ir al listado de Categorías</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">Esc</kbd></td>
                <td>Cerrar reproductor o ayuda</td>
              </tr>
              <tr>
                <td><kbd className="kbd-tag">?</kbd> o <kbd className="kbd-tag">H</kbd></td>
                <td>Escuchar ayuda de teclado</td>
              </tr>
            </tbody>
          </table>
          <button 
            className="btn-submit-search" 
            style={{ width: '100%' }} 
            onClick={() => {
              setShowHelp(false);
              announceText('Ayuda de atajos de teclado cerrada.');
              playCue('action');
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AudioProvider>
          <AppContent />
        </AudioProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
