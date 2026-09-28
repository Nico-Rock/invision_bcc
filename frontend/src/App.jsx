import { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AudioProvider } from './context/AudioContext';
import { useAudio } from './hooks/useAudio';
import { A11yBar } from './components/A11yBar';
import { useKeyboardShortcuts, ATAJOS_SITIO, RESUMEN_ATAJOS } from './hooks/useKeyboardShortcuts';
import { Dialogo } from './components/Dialogo';
import { API_BASE_URL } from './config';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { AudioPlayer } from './components/AudioPlayer';
import { AdminPanel } from './pages/Admin/AdminPanel';

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

// Géneros reales del catálogo (spec 002, R20): antes la barra mostraba dos
// categorías fijas que no filtraban nada y los reales estaban ocultos.
const GenerosNav = ({ generos, error, navRef }) => {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const activo = pathname === '/' ? params.get('genero') : null;
  return (
    <nav className="sidebar-section" aria-labelledby="genres-heading" ref={navRef}>
      <h2 className="sidebar-title" id="genres-heading">Géneros [4]</h2>
      {error ? (
        <p className="texto-error">{error}</p>
      ) : (
        <ul className="genres-list">
          <li>
            <Link to="/" className="genre-btn" aria-current={pathname === '/' && !activo ? 'page' : undefined}>
              Todos
            </Link>
          </li>
          {generos.map((g) => (
            <li key={g}>
              <Link
                to={`/?genero=${encodeURIComponent(g)}`}
                className="genre-btn"
                aria-current={activo === g ? 'page' : undefined}
              >
                {g}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

// Main App Wrapper to bind routing, state, and shortcuts
const AppContent = () => {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { announceText, playCue, esPrimerUso, vozActiva } = useAudio();
  const [showHelp, setShowHelp] = useState(false);
  const [generos, setGeneros] = useState([]);
  const [errorGeneros, setErrorGeneros] = useState('');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const searchInputRef = useRef(null);
  const genresNavRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let vigente = true;
    fetch(`${API_BASE_URL}/genres`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (vigente) { setGeneros(Array.isArray(data) ? data : []); setErrorGeneros(''); }
      })
      .catch((e) => {
        console.error('Error cargando géneros:', e);
        if (!vigente) return;
        const texto = 'No se pudieron cargar los géneros. El buscador sigue funcionando.';
        setErrorGeneros(texto);
        announceText(texto, { urgente: true });
        playCue('error');
      });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Bienvenida una sola vez, por el canal cortés
  useEffect(() => {
    if (esPrimerUso() && vozActiva) {
      announceText('La lectura en voz está encendida. Si usás lector de pantalla, apagala con el botón Lectura en voz de la barra superior.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirAyuda = () => {
    setShowHelp(true);
    announceText(`Ventana de atajos abierta. ${RESUMEN_ATAJOS}`);
    playCue('action');
  };

  // Bind Keyboard Shortcuts hook
  useKeyboardShortcuts({
    // S funciona desde cualquier sección: vuelve al catálogo y enfoca el buscador
    onFocusSearch: () => {
      const enfocar = (intentos = 10) => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          announceText('Buscador de audiolibros.');
          playCue('focus');
        } else if (intentos > 0) {
          requestAnimationFrame(() => enfocar(intentos - 1));
        }
      };
      if (pathname !== '/') navigate('/');
      enfocar();
    },
    onFocusGenres: () => {
      const primero = genresNavRef.current?.querySelector('a');
      if (primero) {
        primero.focus();
        announceText('Géneros.');
      }
    },
    onToggleHelp: (show) => {
      if (show) abrirAyuda();
      else setShowHelp(false);
    }
  });

  const handleLogout = async () => {
    await logout();
    announceText('Sesión cerrada correctamente. Volviendo a la pantalla de ingreso.');
    playCue('action');
  };

  return (
    <div className="app-shell">
      <A11yBar />

      {!isAuthenticated ? (
        <main id="main-content-section" className="main-content main-login" tabIndex="-1">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      ) : (
        <div className="app-layout">
          <aside className="sidebar" aria-label="Menú principal y géneros">
            <nav className="sidebar-section" aria-labelledby="menu-heading">
              <h2 className="sidebar-title" id="menu-heading">Menú</h2>
              <ul className="nav-menu">
                <li>
                  <NavLink to="/perfil" aria-keyshortcuts="1" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>[1] Perfil</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/" aria-keyshortcuts="2" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span>[2] Catálogo</span>
                  </NavLink>
                </li>
                {isAdmin && (
                  <li>
                    <NavLink to="/admin/import" aria-keyshortcuts="3" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>[3] Administración</span>
                    </NavLink>
                  </li>
                )}
              </ul>
            </nav>

            {/* En la consola los géneros de los socios no tienen uso y se leían
                antes del título principal (spec 005, R13) */}
            {!pathname.startsWith('/admin') && (
              <GenerosNav generos={generos} error={errorGeneros} navRef={genresNavRef} />
            )}
          </aside>

          <main id="main-content-section" className="main-content" tabIndex="-1">
            <div className="top-bar">
              <button
                type="button"
                className="shortcuts-help-btn"
                onClick={abrirAyuda}
                aria-keyshortcuts="H Shift+Slash"
              >
                <span aria-hidden="true">❓</span> Ayuda de Atajos
              </button>

              <button type="button" className="btn-logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Salir
              </button>
            </div>

            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home searchInputRef={searchInputRef} />
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
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      )}

      <AudioPlayer />

      {/* Ayuda: <dialog> nativo que retiene y devuelve el foco (R30) */}
      <Dialogo
        abierto={showHelp}
        tituloId="modal-title"
        onClose={() => {
          setShowHelp(false);
          announceText('Ayuda de atajos cerrada.');
        }}
      >
        <h2 className="modal-title" id="modal-title">Atajos de Teclado Disponibles</h2>
        <table className="shortcuts-table">
          <thead>
            <tr><th scope="col">Tecla</th><th scope="col">Acción</th></tr>
          </thead>
          <tbody>
            {ATAJOS_SITIO.map((a) => (
              <tr key={a.accion}>
                <td>
                  {a.teclas.map((t, i) => (
                    <span key={t}>{i > 0 && ' o '}<kbd className="kbd-tag">{t}</kbd></span>
                  ))}
                  {a.reproductor && ' (con un libro sonando)'}
                </td>
                <td>{a.accion}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-submit-search"
          style={{ width: '100%' }}
          onClick={(e) => e.currentTarget.closest('dialog').close()}
        >
          Entendido
        </button>
      </Dialogo>
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
