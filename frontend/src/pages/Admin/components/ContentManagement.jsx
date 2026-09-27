import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { Dialogo } from '../../../components/Dialogo';
import { FichaLibro } from './FichaLibro';
import { valoresUnicos } from '../../../lib/vocabulario';

/**
 * Libros (spec 005, R8). Para quien administra con lector de pantalla: un solo
 * control por fila ("Gestionar"), total en el título y conteo anunciado al
 * buscar. Antes eran 1.077 botones en 538 filas y "Eliminar" al lado de "Editar".
 */
export const ContentManagement = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ficha, setFicha] = useState(null); // { modo: 'crear' | 'editar', libro }
  const avisoBusqueda = useRef(null);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros`);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setBooks(data);
      setError('');
      return data;
    } catch (err) {
      console.error(err);
      const texto = 'No se pudo cargar la lista de libros. Probá de nuevo en un momento.';
      setError(texto);
      announceText(texto, { urgente: true });
      playCue('error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/categorias`);
      if (response.ok) setCategories(await response.json());
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    // Carga inicial desde la API (mismo patrón que Home.jsx)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBooks();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vocabulario = useMemo(() => ({
    generos: valoresUnicos(books.map((b) => b.genero)),
    autores: valoresUnicos(books.map((b) => b.autor)),
    narradores: valoresUnicos(books.map((b) => b.narrador)),
  }), [books]);

  const q = searchQuery.trim().toLowerCase();
  const filteredBooks = q
    ? books.filter((b) => [b.nombre, b.autor, b.narrador, b.genero].some((v) => v && v.toLowerCase().includes(q)))
    : books;

  // El conteo se anuncia cuando se deja de escribir, no en cada tecla
  const alBuscar = (valor) => {
    setSearchQuery(valor);
    clearTimeout(avisoBusqueda.current);
    avisoBusqueda.current = setTimeout(() => {
      const t = valor.trim().toLowerCase();
      const n = t ? books.filter((b) => [b.nombre, b.autor, b.narrador, b.genero].some((v) => v && v.toLowerCase().includes(t))).length : books.length;
      announceText(n === 1 ? '1 libro encontrado.' : `${n} libros encontrados.`);
    }, 800);
  };

  // Después de guardar, la ficha se vuelve a abrir con los datos del servidor
  const alGuardar = async (id) => {
    const data = await fetchBooks();
    const libro = data && data.find((b) => b.id === id);
    if (libro) setFicha({ modo: 'editar', libro });
  };

  // Primero se refresca la lista: así la fila eliminada ya no existe cuando el
  // diálogo busca a quién devolver el foco, y cae en el contenido principal.
  const alEliminar = async () => {
    await fetchBooks();
    setFicha(null);
  };

  const narracionHabilitada = books.length ? books[0].narracion_habilitada !== false : true;

  return (
    <section className="admin-card" aria-labelledby="libros-titulo">
      <h2 id="libros-titulo">Libros ({filteredBooks.length}{q ? ` de ${books.length}` : ''})</h2>

      <div className="admin-controls-bar">
        <label className="sr-only" htmlFor="buscar-libros">Buscar libros por título, autor, narrador o género</label>
        <input
          id="buscar-libros"
          type="search"
          className="admin-search-input"
          placeholder="Buscar por título, autor, narrador o género"
          value={searchQuery}
          onChange={(e) => alBuscar(e.target.value)}
          onFocus={() => playCue('focus')}
        />
        <button type="button" className="btn-submit" onClick={() => setFicha({ modo: 'crear', libro: null })}>
          <span aria-hidden="true">➕ </span>Registrar audiolibro
        </button>
      </div>

      {error && <p className="texto-error">{error}</p>}

      {loading && books.length === 0 ? (
        <p className="estado-carga-admin">Cargando libros…</p>
      ) : (
        <div className="tabla-desplazable" tabIndex="0" role="region" aria-labelledby="libros-titulo">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Autor</th>
                <th scope="col">Narrador</th>
                <th scope="col">Género</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map((book) => (
                <tr key={book.id}>
                  <td>{book.nombre}</td>
                  <td>{book.autor || 'Sin autor'}</td>
                  <td>{book.narrador ? `${book.narrador}${book.en_memoria ? ' (En Memoria)' : ''}` : 'Sin narrador'}</td>
                  <td>{book.genero || 'Sin género'}</td>
                  <td>
                    <button type="button" className="btn-action-edit" onClick={() => setFicha({ modo: 'editar', libro: book })}>
                      Gestionar<span className="sr-only"> {book.nombre}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={!!ficha} tituloId="ficha-libro-titulo" className="modal-card modal-ancho" onClose={() => setFicha(null)}>
        {ficha && (
          <FichaLibro
            key={ficha.libro ? `${ficha.libro.id}-${ficha.libro.narrador}-${ficha.libro.en_memoria}` : 'nuevo'}
            modo={ficha.modo}
            libro={ficha.libro}
            categorias={categories}
            vocabulario={vocabulario}
            narracionHabilitada={narracionHabilitada}
            onGuardado={alGuardar}
            onEliminado={alEliminar}
          />
        )}
      </Dialogo>
    </section>
  );
};

export default ContentManagement;
