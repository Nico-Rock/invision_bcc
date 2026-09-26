import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';

export const UserManagement = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [newUser, setNewUser] = useState({ email: '', username: '', password: '' });
  const [editForm, setEditForm] = useState({ email: '', username: '', first_name: '', last_name: '', phone_number: '' });
  const [newPassword, setNewPassword] = useState('');

  // Refs for accessibility focus control
  const createButtonRef = useRef(null);
  const editButtonRefs = useRef({});
  const modalFirstInputRef = useRef(null);
  const editModalFirstInputRef = useRef(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Error al obtener la lista de usuarios');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al obtener usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/roles/`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    announceText('Sección de Gestión de Usuarios cargada.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc lo maneja el <dialog> nativo (Dialogo): cierra y devuelve el foco.

  const openCreateModal = () => {
    setShowCreateModal(true);
    setNewUser({ email: '', username: '', password: '' });
    announceText('Formulario para registrar nuevo usuario abierto.');
    playCue('action');
    setTimeout(() => {
      if (modalFirstInputRef.current) modalFirstInputRef.current.focus();
    }, 50);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    announceText('Formulario cerrado.');
    playCue('action');
    if (createButtonRef.current) createButtonRef.current.focus();
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email || '',
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || ''
    });
    setNewPassword('');
    setShowEditModal(true);
    announceText(`Formulario de edición para usuario ${user.username} abierto.`);
    playCue('action');
    setTimeout(() => {
      if (editModalFirstInputRef.current) editModalFirstInputRef.current.focus();
    }, 50);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    announceText('Formulario de edición cerrado.');
    playCue('action');
    if (selectedUser && editButtonRefs.current[selectedUser.id]) {
      editButtonRefs.current[selectedUser.id].focus();
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.email || !newUser.username || !newUser.password) {
      announceText('Por favor, rellene todos los campos.');
      playCue('error');
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        announceText('Usuario registrado con éxito.');
        playCue('success');
        setShowCreateModal(false);
        fetchUsers();
      } else {
        const errorData = await response.json();
        announceText(`Error al crear usuario: ${errorData.detail || 'datos inválidos'}`);
        playCue('error');
      }
    } catch (err) {
      console.error(err);
      announceText('Error de conexión al registrar usuario.');
      playCue('error');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      // 1. Update basic info (using our new PUT /users/{id}/admin route)
      const response = await authenticatedFetch(`${API_BASE_URL}/users/${selectedUser.id}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al actualizar detalles de usuario.');
      }

      // 2. Optional password update
      if (newPassword) {
        const pwdResponse = await authenticatedFetch(`${API_BASE_URL}/user/change-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: '',
            new_password: newPassword,
            user_id: selectedUser.id
          })
        });
        if (!pwdResponse.ok) {
          throw new Error('Detalles actualizados, pero el cambio de contraseña falló.');
        }
      }

      announceText('Usuario actualizado con éxito.');
      playCue('success');
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      announceText(err.message);
      playCue('error');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    const confirmDelete = window.confirm(`¿Está seguro de que desea eliminar al usuario "${username}"?`);
    if (!confirmDelete) return;

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/users/${userId}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        announceText(`Usuario ${username} eliminado correctamente.`);
        playCue('success');
        fetchUsers();
      } else {
        announceText('Error al eliminar el usuario.');
        playCue('error');
      }
    } catch (err) {
      console.error(err);
      announceText('Error de conexión al eliminar usuario.');
      playCue('error');
    }
  };

  const handleRoleToggle = async (userId, roleId, roleName, isAssigned) => {
    try {
      if (isAssigned) {
        // Revoke role
        const response = await authenticatedFetch(`${API_BASE_URL}/users/${userId}/roles/${roleId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          announceText(`Rol ${roleName} revocado.`);
          playCue('success');
          fetchUsers();
          // Update local state roles list inside selectedUser if open
          if (selectedUser && selectedUser.id === userId) {
            const updatedRoles = selectedUser.roles.filter(r => r.id !== roleId);
            setSelectedUser({ ...selectedUser, roles: updatedRoles });
          }
        }
      } else {
        // Assign role
        const response = await authenticatedFetch(`${API_BASE_URL}/users/add_roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, role_id: roleId })
        });
        if (response.status === 204 || response.ok) {
          announceText(`Rol ${roleName} asignado.`);
          playCue('success');
          fetchUsers();
          // Update local state roles list inside selectedUser if open
          if (selectedUser && selectedUser.id === userId) {
            const targetRole = roles.find(r => r.id === roleId);
            setSelectedUser({ ...selectedUser, roles: [...selectedUser.roles, targetRole] });
          }
        }
      }
    } catch (err) {
      console.error(err);
      announceText('Error al modificar roles.');
      playCue('error');
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="admin-actions-bar">
        <input
          type="text"
          placeholder="Buscar usuarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
          aria-label="Buscar usuarios por nombre o correo electrónico"
        />

        <button
          ref={createButtonRef}
          type="button"
          onClick={openCreateModal}
          className="btn-submit"
          style={{ width: 'auto', marginTop: 0 }}
          onFocus={() => playCue('focus')}
        >
          ➕ Registrar Usuario
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', fontWeight: 'bold' }}>Cargando usuarios...</div>
      ) : error ? (
        <div className="login-error">{error}</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Usuario</th>
              <th scope="col">Correo</th>
              <th scope="col">Roles</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const isAdminUser = user.roles?.some(r => r.name === 'Admin');
              return (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td style={{ fontWeight: 'bold' }}>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map(r => (
                        <span 
                          key={r.id} 
                          className={`role-badge ${r.name.toLowerCase() === 'admin' ? 'admin' : r.name.toLowerCase() === 'user' ? 'user' : 'custom'}`}
                        >
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="role-badge user">Sin Rol</span>
                    )}
                  </td>
                  <td>
                    <button
                      ref={el => editButtonRefs.current[user.id] = el}
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="btn-action-edit"
                      aria-label={`Editar detalles de ${user.username}`}
                      onFocus={() => playCue('focus')}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                      className="btn-action-delete"
                      aria-label={`Eliminar usuario ${user.username}`}
                      onFocus={() => playCue('focus')}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modal Registrar Usuario */}
      {showCreateModal && (
        <Dialogo
          abierto={showCreateModal}
          tituloId="create-modal-title"
          className="modal-card modal-angosto"
          onClose={() => { if (showCreateModal) closeCreateModal(); }}
        >
            <h2 id="create-modal-title" className="modal-title">Registrar Nuevo Usuario</h2>
            
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-email">Correo Electrónico *</label>
                <input
                  ref={modalFirstInputRef}
                  id="new-email"
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-username">Nombre de Usuario *</label>
                <input
                  id="new-username"
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">Contraseña (Mín. 8 caracteres) *</label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="btn-submit"
                  style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)', marginTop: 0 }}
                  onFocus={() => playCue('focus')}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ marginTop: 0 }}
                  onFocus={() => playCue('focus')}
                >
                  Registrar
                </button>
              </div>
            </form>
        </Dialogo>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && selectedUser && (
        <Dialogo
          abierto={showEditModal}
          tituloId="edit-modal-title"
          className="modal-card modal-mediano"
          onClose={() => { if (showEditModal) closeEditModal(); }}
        >
            <h2 id="edit-modal-title" className="modal-title">Editar Usuario: {selectedUser.username}</h2>
            
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-email">Correo Electrónico *</label>
                <input
                  ref={editModalFirstInputRef}
                  id="edit-email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-username">Nombre de Usuario *</label>
                <input
                  id="edit-username"
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="admin-form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-first-name">Nombre</label>
                  <input
                    id="edit-first-name"
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-last-name">Apellido</label>
                  <input
                    id="edit-last-name"
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-phone">Teléfono</label>
                <input
                  id="edit-phone"
                  type="text"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Roles Section */}
              <div className="form-group" style={{ border: '2px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
                <span className="form-label" style={{ display: 'block', marginBottom: '0.8rem' }}>Asignación de Roles</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {roles.map((role) => {
                    const isAssigned = selectedUser.roles?.some(r => r.id === role.id) || false;
                    return (
                      <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleRoleToggle(selectedUser.id, role.id, role.name, isAssigned)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <span>{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Reset Password Section */}
              <div className="form-group" style={{ border: '2px solid var(--border-color)', borderRadius: '8px', padding: '1rem', marginTop: '1rem' }}>
                <label className="form-label" htmlFor="reset-password" style={{ display: 'block', marginBottom: '0.5rem' }}>Restablecer Contraseña</label>
                <input
                  id="reset-password"
                  type="password"
                  placeholder="Nueva contraseña (dejar vacío si no cambia)"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="btn-submit"
                  style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)', marginTop: 0 }}
                  onFocus={() => playCue('focus')}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ marginTop: 0 }}
                  onFocus={() => playCue('focus')}
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
        </Dialogo>
      )}
    </div>
  );
};
export default UserManagement;
