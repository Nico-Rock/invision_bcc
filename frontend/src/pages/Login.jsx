import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';

export const Login = () => {
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
      const errMsg = err.message || 'Credenciales incorrectas o error en el servidor';
      setError(errMsg);
      announceText(`Error al iniciar sesión: ${errMsg}`);
      playCue('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <main className="login-card" role="main">
        <h1 className="brand-title" style={{ fontSize: '3rem', margin: '0 0 0.5rem 0' }}>Invision</h1>
        <p className="login-subtitle">Biblioteca Central para Ciegos</p>
        
        {error && (
          <div 
            className="login-error" 
            role="alert" 
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
              placeholder="nombre@ejemplo.com"
              onFocus={() => playCue('focus')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
              placeholder="••••••••"
              onFocus={() => playCue('focus')}
            />
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
            aria-busy={loading}
            onFocus={() => playCue('focus')}
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>
      </main>
    </div>
  );
};
export default Login;
