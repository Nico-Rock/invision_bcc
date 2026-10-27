import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { crearDictado } from '../lib/dictado';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';
import { API_BASE_URL } from '../config';
import { indiceDestino, textoPosicion } from '../lib/listaLibros';
import { aAriaGlobal, textoTecla } from '../lib/atajosGlobales';
import { SELECTOR_REPRODUCTOR, debeRecargar, yaSeEstaCargando } from '../lib/reproductor';
import {
  leerProgreso, hayProgreso, listaContinuar, nombreBotonContinuar, textoPosicionHablada,
  debeRefrescarContinuar, EVENTO_PROGRESO_GUARDADO,
} from '../lib/progreso';

// Lleva el foco al botón de reproducir y pausar del reproductor ("Pausar
// audiolibro" mientras suena). Espera a que el reproductor exista.
const enfocarReproductor = (intentos = 30) => {
  const boton = document.getElementById('playerPlayBtn');
  if (boton) boton.focus();
  else if (intentos > 0) requestAnimationFrame(() => enfocarReproductor(intentos - 1));
};

export const Home = () => {
  const { authenticatedFetch, user } = useAuth();
  const { playChapter, libroCargadoId, announceText, playCue, vozActiva, currentBook } = useAudio();
  // "Continuar escuchando": estado 'cargando' | 'listo' | 'vacio' | 'error'
  const [continuar, setContinuar] = useState({ estado: 'cargando', items: [] });
  // Consulta con la que se pidió el listado actual (la sección se oculta al buscar)
  const [consultaActiva, setConsultaActiva] = useState('');
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
  // Tarjeta con tabIndex 0 (tabulador itinerante)
  const [activa, setActiva] = useState(0);

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
      setConsultaActiva(genre ? '' : query);
      setCurrentPage(1);
      setActiva(0);
      
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

  // "Continuar escuchando": se pide al entrar al catálogo, cuando cambia el
  // libro cargado y tras los guardados de progreso exitosos (con límite de
  // frecuencia). Si falla, queda un aviso discreto y el catálogo sigue. Los
  // refrescos no anuncian nada, no mueven el foco y conservan la lista
  // anterior hasta tener la nueva; con el foco dentro de la sección, el
  // repintado espera a que el foco salga.
  const continuarRef = useRef(null);
  const pendienteRef = useRef(null);
  const peticionRef = useRef(0);
  const refrescoRef = useRef({ ultimo: null, previo: null });

  const aplicarContinuar = (nuevo) => {
    const seccion = continuarRef.current;
    if (seccion && seccion.contains(document.activeElement)) {
      pendienteRef.current = nuevo;
      return;
    }
    pendienteRef.current = null;
    setContinuar(nuevo);
  };

  const pedirContinuar = ({ inicial = false } = {}) => {
    if (!user?.id) return;
    const id = ++peticionRef.current;
    authenticatedFetch(`${API_BASE_URL}/mis-audiolibros/${user.id}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => {
        if (id !== peticionRef.current) return;
        const items = listaContinuar(data);
        aplicarContinuar({ estado: items.length ? 'listo' : 'vacio', items });
      })
      .catch(() => {
        if (id !== peticionRef.current) return;
        // Un refresco fallido no borra la lista que ya se mostraba
        if (inicial) setContinuar({ estado: 'error', items: [] });
      });
  };
  const pedirRef = useRef(pedirContinuar);
  useEffect(() => { pedirRef.current = pedirContinuar; });

  useEffect(() => {
    if (!user?.id) return undefined;
    pedirRef.current({ inicial: true });
    return () => { peticionRef.current += 1; };
  }, [user?.id]);

  // Cambio del libro cargado
  const libroActualId = currentBook?.id ?? null;
  const primerLibroRef = useRef(true);
  useEffect(() => {
    if (primerLibroRef.current) { primerLibroRef.current = false; return; }
    if (libroActualId != null) pedirRef.current();
  }, [libroActualId]);

  // Guardado de progreso confirmado por la API (AudioContext)
  useEffect(() => {
    const alGuardar = (ev) => {
      const evento = ev.detail || null;
      const ahora = Date.now();
      const { ultimo, previo } = refrescoRef.current;
      if (!debeRefrescarContinuar({ ahora, ultimo, evento, previo })) return;
      refrescoRef.current = { ultimo: ahora, previo: { libroId: evento.libroId, capitulo: evento.capitulo } };
      pedirRef.current();
    };
    window.addEventListener(EVENTO_PROGRESO_GUARDADO, alGuardar);
    return () => window.removeEventListener(EVENTO_PROGRESO_GUARDADO, alGuardar);
  }, []);

  // Al salir el foco de la sección se aplica el refresco aplazado
  const alSalirFocoContinuar = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    const nuevo = pendienteRef.current;
    if (nuevo) {
      pendienteRef.current = null;
      setContinuar(nuevo);
    }
  };

  // Alt+0 (useAtajosGlobales): con una búsqueda activa, se limpia para que la sección aparezca
  useEffect(() => {
    const alPedir = () => {
      if (consultaActiva) {
        setSearchQuery('');
        fetchBooks('');
      }
    };
    window.addEventListener('invision:continuar', alPedir);
    return () => window.removeEventListener('invision:continuar', alPedir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaActiva]);

  const mostrarContinuar = !selectedGenre && !consultaActiva;

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

  // Copia de libroCargadoId para leerla después de cargar, fuera del render
  const cargadoRef = useRef(libroCargadoId);
  // Libro cuya descarga está en vuelo: una segunda activación no la repite
  const enCursoRef = useRef(null);
  useEffect(() => { cargadoRef.current = libroCargadoId; }, [libroCargadoId]);

  // Tras cargar, el foco pasa a "Pausar" solo si la pista quedó cargada y la
  // persona no movió el foco a otra parte mientras cargaba. Si la carga falló,
  // el foco sigue en la tarjeta y elegirla otra vez reintenta.
  const enfocarSiCargo = (libro, origen, intentos = 30) => {
    requestAnimationFrame(() => {
      if (debeRecargar({ libroCargadoId: cargadoRef.current, libro })) {
        if (intentos > 0) enfocarSiCargo(libro, origen, intentos - 1);
        return;
      }
      const foco = document.activeElement;
      if (!foco || foco === document.body || foco === origen || foco.closest?.(SELECTOR_REPRODUCTOR)) {
        enfocarReproductor();
      }
    });
  };

  // Elegir un libro: trae los capítulos, reproduce el 1 y lleva el foco a
  // "Pausar" (S3). Si el libro elegido ya es el cargado, no se recarga: antes,
  // Espacio sobre la tarjeta recién elegida (ahí quedaba el foco) lo volvía a
  // empezar desde 0:00. Ahora solo se lleva el foco al reproductor.
  // Progreso guardado de un libro; ante cualquier falla, sin progreso (empieza como siempre)
  const obtenerProgreso = async (book) => {
    if (!user?.id) return null;
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/obtener-progreso/${user.id}/${book.id}`);
      if (!r.ok) return null;
      const p = leerProgreso(await r.json());
      return hayProgreso(p) ? p : null;
    } catch {
      return null;
    }
  };

  const handlePlayBook = async (book, origen) => {
    if (!debeRecargar({ libroCargadoId, libro: book })) {
      enfocarReproductor();
      return;
    }
    if (yaSeEstaCargando({ enCursoId: enCursoRef.current, libro: book })) return;
    enCursoRef.current = book.id;
    try {
      const progreso = await obtenerProgreso(book);
      // Con progreso, el único aviso es "Continuando …" al empezar a sonar
      if (!progreso) announceText(`Obteniendo capítulos de ${book.title}...`);
      const response = await authenticatedFetch(`${API_BASE_URL}/audio-by-id/${book.id}`);
      if (!response.ok) {
        throw new Error('No se pudieron recuperar los capítulos del libro.');
      }
      const data = await response.json();
      const chaptersList = data.capitulos || [];
      if (chaptersList.length === 0) {
        throw new Error('Este audiolibro no tiene capítulos grabados.');
      }
      
      const total = chaptersList.length;
      if (progreso && progreso.capitulo <= total) {
        await playChapter(book, progreso.capitulo, { segundos: progreso.segundos, total, reanuda: true });
      } else {
        // Sin progreso, o progreso más allá del último capítulo (terminado): desde el inicio
        await playChapter(book, 1, { total });
      }
      enfocarSiCargo(book, origen);
    } catch (err) {
      announceText(`Error: ${err.message}`, { urgente: true });
      playCue('error');
    } finally {
      enCursoRef.current = null;
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

  // Tabulador itinerante: una sola parada de Tab para la lista; flechas entre tarjetas
  const gridRef = useRef(null);
  const alTeclaTarjeta = (e, i) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const d = indiceDestino(e.key, i, currentBooks.length);
    if (d === null) return;
    e.preventDefault();
    setActiva(d);
    gridRef.current?.querySelectorAll('.book-card')[d]?.focus();
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    setActiva(0);
    announceText(`Página ${pageNumber} de ${totalPages}.`);
    playCue('action');
    document.getElementById('results-title-header')?.focus({ preventScroll: true });
    // Scroll window to results heading
    const header = document.getElementById('results-title-header');
    if (header) {
      // Respeta la preferencia de movimiento reducido (R17)
      const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      header.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="home-container" data-continuar={mostrarContinuar ? continuar.estado : 'oculto'}>
      {/* Buscador Hero */}
      <section className="search-hero" aria-label="Buscador de audiolibros">
        <div>
          <h1 className="brand-title">Invision</h1>
          <p className="brand-subtitle">Biblioteca de audiolibros accesible</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="search-wrapper" role="search" noValidate>
          <span className="search-icon-decor" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </span>
          <input
            id="buscador"
            type="search"
            className="search-input"
            placeholder="Busca tu próximo audiolibro…"
            aria-label="Buscar audiolibro por título o autor"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-keyshortcuts={aAriaGlobal('buscador')}
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
        <p className="search-atajo" aria-hidden="true">Atajo para llegar acá: <kbd className="nav-kbd">{textoTecla('buscador')}</kbd></p>

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

      {/* Continuar escuchando: antes de los resultados, solo sin búsqueda ni género */}
      {mostrarContinuar && continuar.estado === 'listo' && (
        <section className="continuar-section" aria-labelledby="continuar-heading" ref={continuarRef} onBlur={alSalirFocoContinuar}>
          <h2 className="continuar-heading" id="continuar-heading" tabIndex={-1}>
            <span>Continuar escuchando</span>{' '}
            <kbd className="nav-kbd" aria-hidden="true">{textoTecla('continuar')}</kbd>
          </h2>
          <ul className="continuar-lista">
            {continuar.items.map((libro) => (
              <li key={libro.id} className="continuar-item">
                <span className="continuar-texto" aria-hidden="true">
                  <span className="continuar-titulo">{libro.title}</span>
                  <span className="continuar-meta">{libro.author} · {textoPosicionHablada(libro.capitulo, libro.segundos)}</span>
                </span>
                <button
                  type="button"
                  className="btn-submit-search continuar-btn"
                  aria-label={nombreBotonContinuar(libro.title, libro.capitulo, libro.segundos)}
                  aria-keyshortcuts={continuar.items[0] === libro ? aAriaGlobal('continuar') : undefined}
                  onClick={(e) => handlePlayBook(libro, e.currentTarget)}
                  onFocus={() => playCue('focus')}
                >
                  Continuar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mostrarContinuar && continuar.estado === 'cargando' && (
        <p className="continuar-estado">Buscando tus libros en curso…</p>
      )}
      {mostrarContinuar && continuar.estado === 'error' && (
        <p className="continuar-estado">No se pudo cargar «Continuar escuchando». El catálogo sigue disponible.</p>
      )}

      {/* Categorías / Sidebar para visualización */}
      <section className="results-section" aria-labelledby="results-title-header">
        {/* tabIndex -1: recibe el foco al elegir un género, al ingresar y al volver al Catálogo (S3) */}
        <h2 className="results-heading" id="results-title-header" tabIndex={-1}>
          <span>
            {selectedGenre ? `Categoría: ${selectedGenre.toUpperCase()}` : 'Audiolibros Disponibles'}
          </span>
          <span className="results-count">
            {loading ? 'Cargando catálogo...' : totalPages > 1
              ? textoPosicion(currentPage, totalPages, currentBooks.length, books.length)
              : `${books.length} libros en catálogo`}
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
          <ul className="results-grid" aria-label="Resultados de libros" ref={gridRef}>
            {currentBooks.map((book, i) => (
              <li key={book.id}>
                <button
                  type="button"
                  className="book-card"
                  tabIndex={i === activa ? 0 : -1}
                  onKeyDown={(e) => alTeclaTarjeta(e, i)}
                  onClick={(e) => handlePlayBook(book, e.currentTarget)}
                  onFocus={() => { setActiva(i); playCue('focus'); }}
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
              data-pagina="anterior"
              aria-keyshortcuts={currentPage === 1 ? undefined : aAriaGlobal('paginaAnterior')}
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              onFocus={() => playCue('focus')}
            >
              Página Anterior <kbd className="nav-kbd" aria-hidden="true">{textoTecla('paginaAnterior')}</kbd>
            </button>
            <span className="pagination-info">
              {textoPosicion(currentPage, totalPages, currentBooks.length, books.length)}
            </span>
            <button
              className="pagination-btn"
              data-pagina="siguiente"
              aria-keyshortcuts={currentPage === totalPages ? undefined : aAriaGlobal('paginaSiguiente')}
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              onFocus={() => playCue('focus')}
            >
              Página Siguiente <kbd className="nav-kbd" aria-hidden="true">{textoTecla('paginaSiguiente')}</kbd>
            </button>
          </nav>
        )}
      </section>

    </div>
  );
};
export default Home;
