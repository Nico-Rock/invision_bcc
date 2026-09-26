import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { crearDictado } from '../lib/dictado';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';
import { API_BASE_URL } from '../config';

export const Home = ({ searchInputRef: refExterno }) => {
  const { authenticatedFetch } = useAuth();
  const { playChapter, announceText, playCue, vozActiva } = useAudio();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // El género sale de la URL (?genero=): lo elige la barra lateral (R20)
  const selectedGenre = params.get('genero') || '';

  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Voice search state
  const [estadoDictado, setEstadoDictado] = useState('inactivo');
  const dictadoRef = useRef(null);
  const vozRef = useRef(vozActiva);
  useEffect(() => { vozRef.current = vozActiva; }, [vozActiva]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const refInterno = useRef(null);
  const searchInputRef = refExterno || refInterno;

  const fetchBooks = async (query = '', genre = '') => {
    setLoading(true);
    setError('');
    try {
      let endpoint = `${API_BASE_URL}/search`;
      let options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      };

      if (genre) {
        // Encodear género para URL segura
        const encodedGenre = encodeURIComponent(genre);
        endpoint = `${API_BASE_URL}/books-by-genre/${encodedGenre}`;
        options = {
          method: 'GET',
          headers: {},
        };
      }

      const response = await authenticatedFetch(endpoint, options);
      if (!response.ok) {
        throw new Error('Error al conectar con el servidor.');
      }

      const data = await response.json();
      const resultsList = genre ? data : (data.results || []);
      
      // Adaptar formato si es necesario (el endpoint de géneros devuelve datos de libros directamente)
      const adaptedList = resultsList.map(item => ({
        id: item.id,
        title: item.nombre || item.name || 'Título Desconocido',
        author: item.autor || item.author || 'Autor Desconocido',
        genre: item.genero || item.genre || 'General',
        description: item.descripcion || item.description || 'Sin descripción disponible',
      }));

      setBooks(adaptedList);
      setCurrentPage(1);
      
      const countMsg = adaptedList.length === 1 ? '1 audiolibro encontrado.' : `${adaptedList.length} audiolibros encontrados.`;
      announceText(countMsg);
      if (adaptedList.length === 0) {
        playCue('error');
      } else {
        playCue('success');
      }
    } catch (err) {
      setError(err.message || 'Error al cargar libros.');
      announceText(`Error al cargar libros: ${err.message}`, { urgente: true });
      playCue('error');
    } finally {
      setLoading(false);
    }
  };

  // Libros iniciales y cada vez que cambia el género de la URL
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery('');
    fetchBooks('', selectedGenre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenre]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (selectedGenre) navigate('/');
    fetchBooks(searchQuery);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    if (selectedGenre) navigate('/');
    else fetchBooks('');
  };

  // Audiobook Play Trigger: Fetch chapters first, then play Chapter 1
  const handlePlayBook = async (book) => {
    try {
      announceText(`Obteniendo capítulos de ${book.title}...`);
      const response = await authenticatedFetch(`${API_BASE_URL}/audio-by-id/${book.id}`);
      if (!response.ok) {
        throw new Error('No se pudieron recuperar los capítulos del libro.');
      }
      const data = await response.json();
      const chaptersList = data.capitulos || [];
      if (chaptersList.length === 0) {
        throw new Error('Este audiolibro no tiene capítulos grabados.');
      }
      
      // Play chapter 1
      await playChapter(book, 1);
    } catch (err) {
      announceText(`Error: ${err.message}`, { urgente: true });
      playCue('error');
    }
  };

  // Dictado que no capta la voz del propio sitio (R34): primero avisa, espera
  // a que termine la voz y recién ahí abre el micrófono.
  const startVoiceSearch = () => {
    if (!dictadoRef.current) {
      dictadoRef.current = crearDictado({
        Reconocimiento: window.SpeechRecognition || window.webkitSpeechRecognition || null,
        vozActiva: () => vozRef.current,
        anunciar: (texto, op) => {
          if (op && op.urgente) playCue('error');
          announceText(texto, op);
        },
        alEstado: (estado) => {
          setEstadoDictado(estado);
          if (estado === 'escuchando') playCue('voiceStart');
        },
        alResultado: (voiceQuery) => {
          setSearchQuery(voiceQuery);
          if (selectedGenre) navigate('/');
          announceText(`Entendido: ${voiceQuery}.`);
          fetchBooks(voiceQuery);
        },
      });
    }
    dictadoRef.current.alternar();
  };

  // Client-Side Pagination calculations
  const totalPages = Math.ceil(books.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBooks = books.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    announceText(`Mostrando página ${pageNumber} de ${totalPages}.`);
    playCue('action');
    // Scroll window to results heading
    const header = document.getElementById('results-title-header');
    if (header) {
      // Respeta la preferencia de movimiento reducido (R17)
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      header.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="home-container">
      {/* Buscador Hero */}
      <section className="search-hero" aria-label="Buscador de audiolibros">
        <div>
          <h1 className="brand-title">Invision</h1>
          <p className="brand-subtitle">Biblioteca de audiolibros accesible</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="search-wrapper" noValidate>
          <span className="search-icon-decor" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            ref={searchInputRef}
            type="search"
            className="search-input"
            placeholder="Busca tu próximo audiolibro… (tecla S)"
            aria-label="Buscar audiolibro por título o autor"
            aria-keyshortcuts="S"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => playCue('focus')}
          />
          <button
            type="button"
            className={`btn-voice-search ${estadoDictado === 'escuchando' ? 'recording' : ''}`}
            onClick={startVoiceSearch}
            aria-pressed={estadoDictado !== 'inactivo'}
            onFocus={() => playCue('focus')}
          >
            <span className="texto-dictado">{estadoDictado === 'inactivo' ? 'Dictar' : 'Detener dictado'}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>
        </form>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            type="button" 
            className="btn-submit-search" 
            onClick={handleSearchSubmit}
            onFocus={() => playCue('focus')}
          >
            Buscar
          </button>
          {(searchQuery || selectedGenre) && (
            <button 
              type="button" 
              className="btn-submit-search btn-secundario" 
              onClick={handleClearFilters}
              onFocus={() => playCue('focus')}
            >
              Limpiar
            </button>
          )}
        </div>
      </section>

      {/* Categorías / Sidebar para visualización */}
      <section className="results-section" aria-labelledby="results-title-header">
        <h2 className="results-heading" id="results-title-header">
          <span>
            {selectedGenre ? `Categoría: ${selectedGenre.toUpperCase()}` : 'Audiolibros Disponibles'}
          </span>
          <span className="results-count">
            {loading ? 'Cargando catálogo...' : `${books.length} libros en catálogo`}
          </span>
        </h2>

        {error && (
          <div className="login-error" style={{ margin: '1rem 0' }}>
            {error}
          </div>
        )}

        {/* Listado Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', fontWeight: 'bold' }}>
            <span className="spinner" aria-hidden="true"></span>
            <span>Cargando audiolibros...</span>
          </div>
        ) : currentBooks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            No se encontraron audiolibros que coincidan con la búsqueda.
          </div>
        ) : (
          <ul className="results-grid" aria-label="Resultados de libros">
            {currentBooks.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  className="book-card"
                  onClick={() => handlePlayBook(book)}
                  onFocus={() => playCue('focus')}
                >
                  <span className="book-title">{book.title}</span>
                  <span className="book-meta">
                    <span aria-hidden="true">👤 </span>{book.author}
                    <span aria-hidden="true"> | 📁 </span><span className="sr-only">. Género: </span>{book.genre}
                  </span>
                  <span className="book-desc">{book.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <nav className="pagination" aria-label="Navegación de páginas">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              onFocus={() => playCue('focus')}
            >
              Página Anterior
            </button>
            <span className="pagination-info">
              Página {currentPage} de {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              onFocus={() => playCue('focus')}
            >
              Página Siguiente
            </button>
          </nav>
        )}
      </section>

    </div>
  );
};
export default Home;
