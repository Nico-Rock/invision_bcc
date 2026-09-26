import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';
import { API_BASE_URL } from '../config';

export const Home = () => {
  const { authenticatedFetch } = useAuth();
  const { playChapter, announceText, playCue } = useAudio();

  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Voice search state
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const searchInputRef = useRef(null);
  const genresBoxRef = useRef(null);

  const fetchGenres = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/genres`);
      if (response.ok) {
        const data = await response.json();
        setGenres(data);
      }
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

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
      
      const countMsg = `${adaptedList.length} audiolibros encontrados.`;
      announceText(countMsg);
      if (adaptedList.length === 0) {
        playCue('error');
      } else {
        playCue('success');
      }
    } catch (err) {
      setError(err.message || 'Error al cargar libros.');
      announceText(`Error al cargar libros: ${err.message}`);
      playCue('error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial books and genres list
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGenres();
    fetchBooks('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedGenre('');
    fetchBooks(searchQuery);
  };

  const handleGenreSelect = (genre) => {
    setSelectedGenre(genre);
    setSearchQuery('');
    fetchBooks('', genre);
  };

  const handleClearFilters = () => {
    setSelectedGenre('');
    setSearchQuery('');
    fetchBooks('');
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
      announceText(`Error: ${err.message}`);
      playCue('error');
    }
  };

  // Web Speech API Voice search
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      announceText('El dictado por voz no está soportado en este navegador. Recomiendo usar Google Chrome.');
      playCue('error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      playCue('voiceStart');
      announceText('Dicta tu búsqueda ahora.');
    };

    recognition.onresult = (event) => {
      const voiceQuery = event.results[0][0].transcript;
      setSearchQuery(voiceQuery);
      setSelectedGenre('');
      setIsRecording(false);
      announceText(`Buscando: ${voiceQuery}`);
      fetchBooks(voiceQuery);
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      console.error('Speech recognition error:', event.error);
      announceText('No logré entender el dictado. Por favor, intenta de nuevo.');
      playCue('error');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
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
      header.scrollIntoView({ behavior: 'smooth' });
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
            type="text"
            className="search-input"
            placeholder="Busca tu próximo audiolibro... [S]"
            aria-label="Buscar audiolibro por título o autor"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => playCue('focus')}
          />
          <button
            type="button"
            className={`btn-voice-search ${isRecording ? 'recording' : ''}`}
            onClick={startVoiceSearch}
            aria-label={isRecording ? "Grabando voz, presione para cancelar" : "Buscar usando la voz"}
            title="Buscar usando la voz"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>
        </form>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            type="button" 
            className="btn-submit-search" 
            onClick={() => {
              setSelectedGenre('');
              fetchBooks(searchQuery);
            }}
            onFocus={() => playCue('focus')}
          >
            Buscar
          </button>
          {(searchQuery || selectedGenre) && (
            <button 
              type="button" 
              className="btn-submit-search" 
              style={{ backgroundColor: '#4B5563' }}
              onClick={handleClearFilters}
              onFocus={() => playCue('focus')}
              aria-label="Limpiar filtros de búsqueda y mostrar todo"
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
          <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {loading ? 'Cargando catálogo...' : `${books.length} libros en catálogo`}
          </span>
        </h2>

        {error && (
          <div role="alert" className="login-error" style={{ margin: '1rem 0' }}>
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
          <div 
            className="results-grid" 
            role="listbox" 
            aria-label="Resultados de libros"
          >
            {currentBooks.map((book) => (
              <button
                key={book.id}
                className="book-card"
                role="option"
                aria-selected="false"
                aria-label={`${book.title}, de ${book.author}. Género: ${book.genre}. Descripción: ${book.description}`}
                onClick={() => handlePlayBook(book)}
                onFocus={() => playCue('focus')}
              >
                <div className="book-title">{book.title}</div>
                <div className="book-meta">👤 {book.author} | 📁 {book.genre}</div>
                <div className="book-desc">{book.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <nav className="pagination" aria-label="Navegación de páginas">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Ir a la página anterior"
              onFocus={() => playCue('focus')}
            >
              Página Anterior
            </button>
            <span className="pagination-info" aria-live="polite">
              Página {currentPage} de {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Ir a la página siguiente"
              onFocus={() => playCue('focus')}
            >
              Página Siguiente
            </button>
          </nav>
        )}
      </section>

      {/* Dynamic categories selector sidebar mockup helper */}
      <div className="sr-only">
        <div ref={genresBoxRef} tabIndex="-1">
          {genres.map(g => (
            <button key={g} onClick={() => handleGenreSelect(g)}>{g}</button>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Home;
