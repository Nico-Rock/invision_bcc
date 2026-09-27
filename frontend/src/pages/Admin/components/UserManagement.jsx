import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';
import { generarContrasena, deletrear } from '../../../lib/contrasena';
import { PERFILES, nombrePerfil } from '../../../lib/consola';

/**
 * Contraseña que se puede escuchar (spec 005, R17): mostrar u ocultar con un
 * interruptor de texto fijo, y generar una fácil de dictar al socio.
 */
const CampoContrasena = ({ id, etiqueta, valor, onChange, error, requerido }) => {
  const { announceText } = useAudio();
  const [visible, setVisible] = useState(false);
  const generar = () => {
    const nueva = generarContrasena();
    onChange(nueva);
    setVisible(true);
    announceText(`Contraseña generada: ${deletrear(nueva)}.`);
  };
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="form-input"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-required={requerido ? 'true' : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="new-password"
      />
      {error && <p id={`${id}-error`} className="texto-error">{error}</p>}
      <div className="acciones-campo">
        <button type="button" className="btn-submit btn-secundario" aria-pressed={visible} onClick={() => setVisible(!visible)}>
          Mostrar contraseña
        </button>
        <button type="button" className="btn-submit btn-secundario" onClick={generar}>Generar contraseña</button>
      </div>
    </div>
  );
};

const vacioAlta = { email: '', username: '', password: '' };

/** Ficha de usuario: alta, edición, roles y borrado con confirmación (R8–R11, R17). */
const FichaUsuario = ({ modo, usuario, roles, onCambio, onCerrar }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [form, setForm] = useState(() => (usuario ? {
    email: usuario.email || '', username: usuario.username || '', first_name: usuario.first_name || '',
    last_name: usuario.last_name || '', phone_number: usuario.phone_number || '', password: '',
  } : vacioAlta));
  const [errores, setErrores] = useState({});
  const [vista, setVista] = useState('form');
  const [rolesUsuario, setRolesUsuario] = useState(() => (usuario?.roles || []).map((r) => r.id));
  const [perfil, setPerfil] = useState(usuario?.perfil || '');
  const cancelarRef = useRef(null);

  useEffect(() => {
    if (vista === 'eliminar') cancelarRef.current?.focus();
  }, [vista]);

  const fallar = (texto) => {
    announceText(texto, { urgente: true });
    playCue('error');
  };

  const validar = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'El correo es obligatorio.';
    if (!form.username.trim()) e.username = 'El nombre de usuario es obligatorio.';
    if (modo === 'crear' && form.password.length < 8) e.password = 'La contraseña necesita al menos 8 caracteres.';
    if (modo === 'editar' && form.password && form.password.length < 8) e.password = 'La contraseña nueva necesita al menos 8 caracteres.';
    setErrores(e);
    const primero = Object.keys(e)[0];
    if (primero) {
      fallar(e[primero]);
      document.getElementById(`usuario-${primero}`)?.focus();
      return false;
    }
    return true;
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    try {
      if (modo === 'crear') {
        const r = await authenticatedFetch(`${API_BASE_URL}/users/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.trim(), username: form.username.trim(), password: form.password }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(typeof d.detail === 'string' ? d.detail : 'revisá los datos');
        }
        playCue('success');
        announceText(`Usuario ${form.username} registrado.`);
      } else {
        const { password, ...datos } = form;
        const r = await authenticatedFetch(`${API_BASE_URL}/users/${usuario.id}/admin`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(typeof d.detail === 'string' ? d.detail : 'revisá los datos');
        }
        if (password) {
          const rp = await authenticatedFetch(`${API_BASE_URL}/user/change-password`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: '', new_password: password, user_id: usuario.id }),
          });
          if (!rp.ok) throw new Error('los datos se guardaron, pero el cambio de contraseña falló');
        }
        playCue('success');
        announceText(`Usuario ${form.username} actualizado.`);
      }
      onCambio();
      onCerrar();
    } catch (err) {
      console.error(err);
      fallar(`No se pudo guardar el usuario: ${err.message}.`);
    }
  };

  const alternarRol = async (rol, asignado) => {
    try {
      const r = asignado
        ? await authenticatedFetch(`${API_BASE_URL}/users/${usuario.id}/roles/${rol.id}`, { method: 'DELETE' })
        : await authenticatedFetch(`${API_BASE_URL}/users/add_roles`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: usuario.id, role_id: rol.id }),
        });
      if (!(r.ok || r.status === 204)) throw new Error(String(r.status));
      setRolesUsuario(asignado ? rolesUsuario.filter((id) => id !== rol.id) : [...rolesUsuario, rol.id]);
      playCue('success');
      announceText(asignado ? `Rol ${rol.name} quitado.` : `Rol ${rol.name} asignado.`);
      onCambio();
    } catch (err) {
      console.error(err);
      fallar(`No se pudo cambiar el rol ${rol.name}.`);
    }
  };

  // Perfil de accesibilidad (spec 005, R25): define la configuración del primer ingreso
  const cambiarPerfil = async (nuevo) => {
    setPerfil(nuevo);
    if (!nuevo) return;
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/usuarios/${usuario.id}/perfil`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: nuevo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      playCue('success');
      announceText(`Perfil de ${usuario.username}: ${nombrePerfil(nuevo)}. Se aplica en su próximo ingreso desde un dispositivo nuevo.`);
      onCambio();
    } catch (err) {
      setPerfil(usuario?.perfil || '');
      fallar(`No se pudo guardar el perfil: ${err.message}`);
    }
  };

  const eliminar = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/users/${usuario.id}/`, { method: 'DELETE' });
      if (!r.ok) throw new Error(String(r.status));
      playCue('success');
      announceText(`Usuario ${usuario.username} eliminado.`);
      await onCambio();
      onCerrar();
    } catch (err) {
      console.error(err);
      fallar(`No se pudo eliminar a ${usuario.username}.`);
      setVista('form');
    }
  };

  const campo = (nombre, etiqueta, tipo = 'text', requerido = false) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`usuario-${nombre}`}>{etiqueta}</label>
      <input
        id={`usuario-${nombre}`}
        type={tipo}
        className="form-input"
        value={form[nombre]}
        onChange={(e) => setForm({ ...form, [nombre]: e.target.value })}
        aria-required={requerido ? 'true' : undefined}
        aria-invalid={errores[nombre] ? 'true' : undefined}
        aria-describedby={errores[nombre] ? `usuario-${nombre}-error` : undefined}
        autoComplete="off"
      />
      {errores[nombre] && <p id={`usuario-${nombre}-error`} className="texto-error">{errores[nombre]}</p>}
    </div>
  );

  if (vista === 'eliminar') {
    return (
      <>
        <h2 id="ficha-usuario-titulo" className="modal-title">¿Eliminar a {usuario.username}?</h2>
        <p>La cuenta dejará de poder ingresar y se borra su progreso de escucha. <strong>Esta acción todavía no se puede deshacer.</strong></p>
        <div className="acciones-dialogo">
          <button ref={cancelarRef} type="button" className="btn-submit btn-secundario" onClick={() => setVista('form')}>Cancelar</button>
          <button type="button" className="btn-action-delete" onClick={eliminar}>Eliminar definitivamente</button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 id="ficha-usuario-titulo" className="modal-title">{modo === 'crear' ? 'Registrar usuario' : `Gestionar: ${usuario.username}`}</h2>
      <form onSubmit={guardar} noValidate>
        {campo('email', 'Correo electrónico (obligatorio)', 'email', true)}
        {campo('username', 'Nombre de usuario (obligatorio)', 'text', true)}
        {modo === 'editar' && campo('first_name', 'Nombre')}
        {modo === 'editar' && campo('last_name', 'Apellido')}
        {modo === 'editar' && campo('phone_number', 'Teléfono', 'tel')}
        <CampoContrasena
          id="usuario-password"
          etiqueta={modo === 'crear' ? 'Contraseña (obligatoria, mínimo 8 caracteres)' : 'Contraseña nueva (opcional, mínimo 8 caracteres)'}
          valor={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          error={errores.password}
          requerido={modo === 'crear'}
        />

        {modo === 'editar' && (
          <div className="form-group">
            <label className="form-label" htmlFor="usuario-perfil">Perfil de accesibilidad</label>
            <select id="usuario-perfil" className="form-input" value={perfil} onChange={(e) => cambiarPerfil(e.target.value)} aria-describedby="usuario-perfil-detalle">
              <option value="">Sin perfil</option>
              {PERFILES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <p id="usuario-perfil-detalle" className="nota-campo">
              {perfil ? PERFILES.find((p) => p.id === perfil)?.detalle : 'Sin perfil, el sitio arranca con la configuración estándar.'}
            </p>
          </div>
        )}

        {modo === 'editar' && (
          <fieldset className="form-group roles-usuario">
            <legend className="form-label">Roles</legend>
            {roles.map((rol) => {
              const asignado = rolesUsuario.includes(rol.id);
              return (
                <div key={rol.id} className="campo-casilla">
                  <input id={`rol-${rol.id}`} type="checkbox" checked={asignado} onChange={() => alternarRol(rol, asignado)} />
                  <label htmlFor={`rol-${rol.id}`}>{rol.name}</label>
                </div>
              );
            })}
          </fieldset>
        )}

        <div className="acciones-dialogo">
          <button type="submit" className="btn-submit">Guardar</button>
          <button type="button" className="btn-submit btn-secundario" onClick={onCerrar}>Cerrar</button>
          {modo === 'editar' && (
            <button type="button" className="btn-action-delete" onClick={() => setVista('eliminar')}>Eliminar usuario</button>
          )}
        </div>
      </form>
    </>
  );
};

/** Usuarios (spec 005, R8, R11): un control por fila, roles en texto, total en el título. */
export const UserManagement = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ficha, setFicha] = useState(null);
  const avisoBusqueda = useRef(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/users/`);
      if (!r.ok) throw new Error(String(r.status));
      setUsers(await r.json());
    } catch (err) {
      console.error(err);
      announceText('No se pudo cargar la lista de usuarios.', { urgente: true });
      playCue('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/roles/`);
      if (r.ok) setRoles(await r.json());
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  useEffect(() => {
    // Carga inicial desde la API (mismo patrón que Home.jsx)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coincide = (u, t) => [u.username, u.email, u.first_name, u.last_name].some((v) => v && v.toLowerCase().includes(t));
  const q = searchQuery.trim().toLowerCase();
  const filtrados = q ? users.filter((u) => coincide(u, q)) : users;

  const alBuscar = (valor) => {
    setSearchQuery(valor);
    clearTimeout(avisoBusqueda.current);
    avisoBusqueda.current = setTimeout(() => {
      const t = valor.trim().toLowerCase();
      const n = t ? users.filter((u) => coincide(u, t)).length : users.length;
      announceText(n === 1 ? '1 usuario encontrado.' : `${n} usuarios encontrados.`);
    }, 800);
  };

  const nombreRoles = (u) => (u.roles && u.roles.length ? u.roles.map((r) => r.name).join(', ') : 'Sin rol');

  return (
    <section className="admin-card" aria-labelledby="usuarios-titulo">
      <h2 id="usuarios-titulo">Usuarios ({filtrados.length}{q ? ` de ${users.length}` : ''})</h2>

      <div className="admin-controls-bar">
        <label className="sr-only" htmlFor="buscar-usuarios">Buscar usuarios por nombre o correo</label>
        <input
          id="buscar-usuarios"
          type="search"
          className="admin-search-input"
          placeholder="Buscar por nombre o correo"
          value={searchQuery}
          onChange={(e) => alBuscar(e.target.value)}
          onFocus={() => playCue('focus')}
        />
        <button type="button" className="btn-submit" onClick={() => setFicha({ modo: 'crear', usuario: null })}>
          <span aria-hidden="true">➕ </span>Registrar usuario
        </button>
      </div>

      {loading && users.length === 0 ? (
        <p className="estado-carga-admin">Cargando usuarios…</p>
      ) : (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="usuarios-titulo">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Usuario</th>
                <th scope="col">Correo</th>
                <th scope="col">Roles</th>
                <th scope="col">Perfil</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || 'Sin nombre'}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{nombreRoles(u)}</td>
                  <td>{nombrePerfil(u.perfil)}</td>
                  <td>
                    <button type="button" className="btn-action-edit" onClick={() => setFicha({ modo: 'editar', usuario: u })}>
                      Gestionar<span className="sr-only"> {u.username}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={!!ficha} tituloId="ficha-usuario-titulo" className="modal-card modal-mediano" onClose={() => setFicha(null)}>
        {ficha && (
          <FichaUsuario
            key={ficha.usuario ? ficha.usuario.id : 'nuevo'}
            modo={ficha.modo}
            usuario={ficha.usuario}
            roles={roles}
            onCambio={fetchUsers}
            onCerrar={() => setFicha(null)}
          />
        )}
      </Dialogo>
    </section>
  );
};

export default UserManagement;
