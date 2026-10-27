import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';
import { API_BASE_URL } from '../config';
import { esIOS } from '../lib/plataforma';
import { textoTecla } from '../lib/atajosGlobales';
import { VELOCIDADES, valorVelocidad } from '../lib/velocidad';
import { TECLAS_REPRODUCTOR } from '../lib/reproductor';

// En iPhone y iPad el sistema ignora el volumen que fija la página: el control
// del sitio anunciaba un porcentaje que no se oía. Ahí se usan los botones del equipo.
const VOLUMEN_DEL_SISTEMA = typeof navigator !== 'undefined' && esIOS(navigator);

export const AudioPlayer = () => {
  const { authenticatedFetch } = useAuth();
  const {
    currentBook,
    currentChapterIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    playbackRate,
    changeSpeed,
    togglePlayback,
    skipSeconds,
    seekTime,
    playChapter,
    playCue,
    announceText,
    chapters,
    setChapters,
    anfitrionReproductor,
  } = useAudio();

  const fetchChapters = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/audio-by-id/${currentBook.id}`);
      if (response.ok) {
        const data = await response.json();
        setChapters(data.capitulos || []);
      }
    } catch (err) {
      console.error('Error loading book chapters:', err);
    }
  };

  // Fetch chapters list on book change
  useEffect(() => {
    if (currentBook) {
      fetchChapters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBook]);

  if (!currentBook) return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePrevChapter = () => {
    if (currentChapterIndex > 1) {
      playChapter(currentBook, currentChapterIndex - 1);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length) {
      playChapter(currentBook, currentChapterIndex + 1);
    }
  };

  const reproductor = (
    // id y tabIndex -1: destino del enlace "Saltar al reproductor". Con el foco
    // dentro, responden Espacio, flechas, N, P y M (useKeyboardShortcuts).
    <section id="reproductor" className="player-dock active" aria-labelledby="reproductor-titulo" tabIndex={-1}>
      <h2 id="reproductor-titulo" className="sr-only">Reproductor de audiolibros</h2>
      {/* Información del libro */}
      <div className="player-info">
        <div 
          className="player-book-title" 
          id="playerTitle"
          tabIndex="0"
          onFocus={() => playCue('focus')}
        >
          {currentBook.title || currentBook.nombre}
        </div>
        <div className="player-chapter-title" id="playerChapter">
          Capítulo {currentChapterIndex} de {chapters.length || 1}
        </div>
        <div className="player-atajo" aria-hidden="true"><kbd className="nav-kbd">{textoTecla('reproductor')}</kbd></div>
      </div>

      {/* Controles del Reproductor */}
      <div className="player-controls">
        <div className="player-buttons">
          {/* Capítulo anterior */}
          <button
            className="player-btn"
            onClick={handlePrevChapter}
            disabled={currentChapterIndex <= 1}
            aria-label="Capítulo anterior"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="19 20 9 12 19 4 19 20" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon><line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
          </button>

          {/* Retroceder 15s */}
          <button 
            className="player-btn" 
            onClick={() => skipSeconds(-15)} 
            aria-label="Retroceder 15 segundos"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
          </button>
          
          {/* Play / Pausa */}
          <button 
            className="player-btn btn-play-toggle" 
            id="playerPlayBtn" 
            onClick={togglePlayback} 
            aria-label={isPlaying ? "Pausar audiolibro" : "Reproducir audiolibro"}
            onFocus={() => playCue('focus')}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="2.5"></line><line x1="18" y1="4" x2="18" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon></svg>
            )}
          </button>

          {/* Adelantar 15s */}
          <button 
            className="player-btn" 
            onClick={() => skipSeconds(15)} 
            aria-label="Adelantar 15 segundos"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
          </button>

          {/* Capítulo siguiente */}
          <button
            className="player-btn"
            onClick={handleNextChapter}
            disabled={currentChapterIndex >= chapters.length}
            aria-label="Capítulo siguiente"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon points="5 4 15 12 5 20 5 4" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon><line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
          </button>
        </div>

        {/* Barra de progreso */}
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
            onFocus={() => playCue('focus')}
          />
          <span aria-hidden="true" style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
            {formatTime(duration)}
          </span>
        </div>
        {/* Teclas con el foco dentro del reproductor, desde TECLAS_REPRODUCTOR.
            aria-hidden: la ayuda ya las cuenta y así el lector no las repite
            cada vez que el foco pasa por aquí. No es enfocable: no cambia el Tab. */}
        <p className="player-teclas" aria-hidden="true">
          <span className="player-teclas-intro">Con el foco aquí:</span>
          {TECLAS_REPRODUCTOR.map((fila) => (
            <span key={fila.id} className="player-teclas-item">
              {fila.teclas.map((t) => <kbd key={t} className="player-kbd">{t}</kbd>)}
              <span>{fila.corto}</span>
            </span>
          ))}
        </p>
      </div>

      {/* Volumen y velocidad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
        {/* Control de Velocidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="speed-select" style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Velocidad:</label>
          <select
            id="speed-select"
            value={valorVelocidad(playbackRate)}
            onChange={(e) => changeSpeed(parseFloat(e.target.value))}
            onFocus={() => playCue('focus')}
            className="player-select"
          >
            {VELOCIDADES.map((o) => (
              <option key={o.valor} value={valorVelocidad(o.valor)}>{o.etiqueta}</option>
            ))}
          </select>
        </div>

        {/* Control de Volumen (no en iOS) */}
        {!VOLUMEN_DEL_SISTEMA && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '150px' }}>
          <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              announceText(`Volumen al ${Math.round(val * 100)} por ciento.`);
            }}
            onFocus={() => playCue('focus')}
            aria-label="Control de volumen"
            className="player-volumen"
            style={{
              flex: 1,
              cursor: 'pointer',
            }}
          />
        </div>
        )}
      </div>
    </section>
  );

  // Una sola instancia: dentro de la ficha abierta si esta la aloja, o al pie
  return anfitrionReproductor ? createPortal(reproductor, anfitrionReproductor) : reproductor;
};
export default AudioPlayer;
