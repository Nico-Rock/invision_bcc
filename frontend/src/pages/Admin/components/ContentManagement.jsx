import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';

export const ContentManagement = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // Form states
  const [newBook, setNewBook] = useState({
    nombre: '',
    descripcion: '',
    genero: '',
    autor: '',
    categoria_id: '',
    clasificacionesStr: '' // comma-separated classifications string
  });
  
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    genero: '',
    autor: '',
    categoria_id: '',
    clasificacionesStr: ''
  });

  // Refs for accessibility focus control
  const createButtonRef = useRef(null);
  const editButtonRefs = useRef({});
  const modalFirstInputRef = useRef(null);
  const editModalFirstInputRef = useRef(null);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros`);
      if (response.ok) {
        const data = await response.json();
        setBooks(data);
      } else {
        setError('Error al obtener la lista de audiolibros');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión al obtener audiolibros');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/categorias`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
    fetchCategories();
    announceText('Sección de Gestión de Contenido cargada.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal event handlers for Esc key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showCreateModal) closeCreateModal();
        if (showEditModal) closeEditModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, showEditModal]);

  const openCreateModal = () => {
    setShowCreateModal(true);
    setNewBook({
      nombre: '',
      descripcion: '',
      genero: '',
      autor: '',
      categoria_id: '',
      clasificacionesStr: ''
    });
    announceText('Formulario para registrar nuevo audiolibro abierto.');
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

  const openEditModal = (book) => {
    setSelectedBook(book);
    setEditForm({
      nombre: book.nombre || '',
      descripcion: book.descripcion || '',
      genero: book.genero || '',
      autor: book.autor || '',
      categoria_id: book.categoria_id || '',
      clasificacionesStr: book.clasificaciones ? book.clasificaciones.join(', ') : ''
    });
    setShowEditModal(true);
    announceText(`Formulario de edición para el audiolibro ${book.nombre} abierto.`);
    playCue('action');
    setTimeout(() => {
      if (editModalFirstInputRef.current) editModalFirstInputRef.current.focus();
    }, 50);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedBook(null);
    announceText('Formulario de edición cerrado.');
    playCue('action');
    if (selectedBook && editButtonRefs.current[selectedBook.id]) {
      editButtonRefs.current[selectedBook.id].focus();
    }
  };

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!newBook.nombre) {
      announceText('El título del audiolibro es obligatorio.');
      playCue('error');
      return;
    }

    const payload = {
      nombre: newBook.nombre,
      descripcion: newBook.descripcion,
      genero: newBook.genero,
      autor: newBook.autor,
      categoria_id: newBook.categoria_id ? parseInt(newBook.categoria_id) : null,
      clasificaciones: newBook.clasificacionesStr
        ? newBook.clasificacionesStr.split(',').map(s => s.trim()).filter(Boolean)
        : []
    };

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        announceText('Audiolibro registrado con éxito.');
        playCue('success');
        setShowCreateModal(false);
        fetchBooks();
      } else {
        const errorData = await response.json();
        announceText(`Error al registrar audiolibro: ${errorData.detail || 'datos inválidos'}`);
        playCue('error');
      }
    } catch (err) {
      console.error(err);
      announceText('Error de conexión al registrar audiolibro.');
      playCue('error');
    }
  };

  const handleUpdateBook = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: editForm.nombre,
      descripcion: editForm.descripcion,
      genero: editForm.genero,
      autor: editForm.autor,
      categoria_id: editForm.categoria_id ? parseInt(editForm.categoria_id) : null,
      clasificaciones: editForm.clasificacionesStr
        ? editForm.clasificacionesStr.split(',').map(s => s.trim()).filter(Boolean)
        : []
    };

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${selectedBook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        announceText('Audiolibro actualizado con éxito.');
        playCue('success');
        setShowEditModal(false);
        fetchBooks();
      } else {
        const errorData = await response.json();
        announceText(`Error al actualizar audiolibro: ${errorData.detail || 'datos inválidos'}`);
        playCue('error');
      }
    } catch (err) {
      console.error(err);
      announceText('Error de conexión al actualizar audiolibro.');
      playCue('error');
    }
  };

  const handleDeleteBook = async (bookId, nombre) => {
    const confirmDelete = window.confirm(`¿Está seguro de que desea eliminar el audiolibro "${nombre}"?`);
    if (!confirmDelete) return;

    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${bookId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        announceText(`Audiolibro "${nombre}" eliminado correctamente.`);
        playCue('success');
        fetchBooks();
      } else {
        announceText('Error al eliminar el audiolibro.');
        playCue('error');
      }
    } catch (err) {
      console.error(err);
      announceText('Error de conexión al eliminar audiolibro.');
      playCue('error');
    }
  };

  const filteredBooks = books.filter(b => 
    b.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.autor && b.autor.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (b.genero && b.genero.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      <div className="admin-actions-bar">
        <input
          type="text"
          placeholder="Buscar audiolibros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
          aria-label="Buscar audiolibros por título, autor o género"
        />

        <button
          ref={createButtonRef}
          type="button"
          onClick={openCreateModal}
          className="btn-submit"
          style={{ width: 'auto', marginTop: 0 }}
          onFocus={() => playCue('focus')}
        >
          ➕ Registrar Audiolibro
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', fontWeight: 'bold' }}>Cargando audiolibros...</div>
      ) : error ? (
        <div className="login-error">{error}</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Título</th>
              <th scope="col">Autor</th>
              <th scope="col">Género</th>
              <th scope="col">Categoría</th>
              <th scope="col">Clasificaciones</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book.id}>
                <td style={{ fontWeight: 'bold' }}>{book.nombre}</td>
                <td>{book.autor || '—'}</td>
                <td>{book.genero || '—'}</td>
                <td>{book.categoria || 'Sin Categoría'}</td>
                <td>
                  {book.clasificaciones && book.clasificaciones.length > 0 ? (
                    book.clasificaciones.map((cl, idx) => (
                      <span key={idx} className="role-badge custom">
                        {cl}
                      </span>
                    ))
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <button
                    ref={el => editButtonRefs.current[book.id] = el}
                    type="button"
                    onClick={() => openEditModal(book)}
                    className="btn-action-edit"
                    aria-label={`Editar metadatos de ${book.nombre}`}
                    onFocus={() => playCue('focus')}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBook(book.id, book.nombre)}
                    className="btn-action-delete"
                    aria-label={`Eliminar audiolibro ${book.nombre}`}
                    onFocus={() => playCue('focus')}
                  >
                    🗑️ Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Registrar Audiolibro */}
      {showCreateModal && (
        <div 
          className="modal-overlay active" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="create-book-title"
          onClick={(e) => { if (e.target.className.includes('modal-overlay')) closeCreateModal(); }}
        >
          <div className="modal-card" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 id="create-book-title" className="modal-title">Registrar Nuevo Audiolibro</h2>
            
            <form onSubmit={handleCreateBook}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-book-title">Título del Audiolibro *</label>
                <input
                  ref={modalFirstInputRef}
                  id="new-book-title"
                  type="text"
                  required
                  value={newBook.nombre}
                  onChange={(e) => setNewBook({ ...newBook, nombre: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-book-author">Autor</label>
                <input
                  id="new-book-author"
                  type="text"
                  value={newBook.autor}
                  onChange={(e) => setNewBook({ ...newBook, autor: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="admin-form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-book-genre">Género</label>
                  <input
                    id="new-book-genre"
                    type="text"
                    value={newBook.genero}
                    onChange={(e) => setNewBook({ ...newBook, genero: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-book-category">Categoría</label>
                  <select
                    id="new-book-category"
                    value={newBook.categoria_id}
                    onChange={(e) => setNewBook({ ...newBook, categoria_id: e.target.value })}
                    className="form-input"
                    style={{ height: '48px', padding: '0 1rem' }}
                  >
                    <option value="">Seleccionar Categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-book-desc">Descripción</label>
                <textarea
                  id="new-book-desc"
                  rows="3"
                  value={newBook.descripcion}
                  onChange={(e) => setNewBook({ ...newBook, descripcion: e.target.value })}
                  className="form-input"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-book-tags">Clasificaciones (Separadas por comas)</label>
                <input
                  id="new-book-tags"
                  type="text"
                  placeholder="Ej. BCC, Patrimonio, Histórico"
                  value={newBook.clasificacionesStr}
                  onChange={(e) => setNewBook({ ...newBook, clasificacionesStr: e.target.value })}
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
          </div>
        </div>
      )}

      {/* Modal Editar Audiolibro */}
      {showEditModal && selectedBook && (
        <div 
          className="modal-overlay active" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="edit-book-title"
          onClick={(e) => { if (e.target.className.includes('modal-overlay')) closeEditModal(); }}
        >
          <div className="modal-card" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 id="edit-book-title" className="modal-title">Editar Audiolibro: {selectedBook.nombre}</h2>
            
            <form onSubmit={handleUpdateBook}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-book-name">Título del Audiolibro *</label>
                <input
                  ref={editModalFirstInputRef}
                  id="edit-book-name"
                  type="text"
                  required
                  value={editForm.nombre}
                  onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-book-author">Autor</label>
                <input
                  id="edit-book-author"
                  type="text"
                  value={editForm.autor}
                  onChange={(e) => setEditForm({ ...editForm, autor: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="admin-form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-book-genre">Género</label>
                  <input
                    id="edit-book-genre"
                    type="text"
                    value={editForm.genero}
                    onChange={(e) => setEditForm({ ...editForm, genero: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-book-category">Categoría</label>
                  <select
                    id="edit-book-category"
                    value={editForm.categoria_id}
                    onChange={(e) => setEditForm({ ...editForm, categoria_id: e.target.value })}
                    className="form-input"
                    style={{ height: '48px', padding: '0 1rem' }}
                  >
                    <option value="">Seleccionar Categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-book-desc">Descripción</label>
                <textarea
                  id="edit-book-desc"
                  rows="3"
                  value={editForm.descripcion}
                  onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
                  className="form-input"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-book-tags">Clasificaciones (Separadas por comas)</label>
                <input
                  id="edit-book-tags"
                  type="text"
                  placeholder="Ej. BCC, Patrimonio, Histórico"
                  value={editForm.clasificacionesStr}
                  onChange={(e) => setEditForm({ ...editForm, clasificacionesStr: e.target.value })}
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
          </div>
        </div>
      )}
    </div>
  );
};
export default ContentManagement;
