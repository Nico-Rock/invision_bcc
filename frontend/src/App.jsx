import { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AudioProvider } from './context/AudioContext';
import { useAudio } from './hooks/useAudio';
import { A11yBar } from './components/A11yBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Views Placeholders (to be implemented in next tasks)
const LoginView = () => {
  const { login } = useAuth();
  const { announceText, playCue } = useAudio();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      announceText('Inicio de sesión exitoso. Redirigiendo al catálogo.');
      playCue('success');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
      announceText(`Error al iniciar sesión: ${err.message || 'Credenciales incorrectas'}`);
      playCue('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" role="main">
        <h1>Invision</h1>
        <p className="login-subtitle">Biblioteca Central para Ciegos</p>
        {error && <div className="login-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const CatalogView = () => {
  return (
    <section aria-labelledby="catalog-title">
      <h2 id="catalog-title" className="results-heading">Catálogo de Audiolibros</h2>
      <div style={{ padding: '2rem 0', fontWeight: 'bold' }}>
        Vista del catálogo. El usuario administrador puede gestionar el contenido aquí.
      </div>
    </section>
  );
};

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

// Floating Global Player Component
const GlobalPlayer = () => {
  const {
    currentBook,
    currentChapterIndex,
    isPlaying,
    currentTime,
    duration,
    togglePlayback,
    skipSeconds,
    seekTime,
  } = useAudio();

  if (!currentBook) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="player-dock active" role="region" aria-label="Reproductor de audiolibros">
      <div className="player-info">
        <div className="player-book-title" id="playerTitle">
          {currentBook.nombre || currentBook.title}
        </div>
        <div className="player-chapter-title" id="playerChapter">
          Capítulo {currentChapterIndex} (Streaming desde Azure Storage)
        </div>
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button 
            className="player-btn" 
            onClick={() => skipSeconds(-15)} 
            aria-label="Retroceder 15 segundos"
          >
            <svg viewBox="0 0 24 24" role="img" aria-label="Retroceder"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
          </button>
          
          <button 
            className="player-btn btn-play-toggle" 
            id="playerPlayBtn" 
            onClick={togglePlayback} 
            aria-label={isPlaying ? "Pausar audiolibro" : "Reproducir audiolibro"}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" role="img" aria-label="Pausa"><line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="2.5"></line><line x1="18" y1="4" x2="18" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
            ) : (
              <svg viewBox="0 0 24 24" role="img" aria-label="Reproducir"><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon></svg>
            )}
          </button>

          <button 
            className="player-btn" 
            onClick={() => skipSeconds(15)} 
            aria-label="Adelantar 15 segundos"
          >
            <svg viewBox="0 0 24 24" role="img" aria-label="Adelantar"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
          </button>
        </div>

        <div className="progress-bar-container">
          <span aria-hidden="true" style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            {formatTime(currentTime)}
          </span>
          <input 
            type="range" 
            className="progress-slider" 
            min="0" 
            max="100" 
            value={progressPercent} 
            aria-label="Posición de reproducción"
            onChange={(e) => seekTime(parseFloat(e.target.value))}
          />
          <span aria-hidden="true" style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        {/* Simple spacing block or custom action */}
      </div>
    </footer>
  );
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
              element={!isAuthenticated ? <LoginView /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <CatalogView />
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

      <GlobalPlayer />

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
