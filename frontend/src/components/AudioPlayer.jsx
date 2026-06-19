import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../hooks/useAudio';
import { API_BASE_URL } from '../config';

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
  } = useAudio();

  const [chapters, setChapters] = useState([]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <footer 
      className="player-dock active" 
      role="region" 
      aria-label="Reproductor de audiolibros"
    >
      {/* Información del libro */}
      <div className="player-info">
        <div 
          className="player-book-title" 
          id="playerTitle"
          tabIndex="0"
          onFocus={() => playCue('focus')}
          aria-label={`Audiolibro activo: ${currentBook.title || currentBook.nombre}`}
        >
          {currentBook.title || currentBook.nombre}
        </div>
        <div className="player-chapter-title" id="playerChapter">
          Capítulo {currentChapterIndex} de {chapters.length || 1}
        </div>
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
            <svg viewBox="0 0 24 24" role="img" aria-label="Anterior"><polygon points="19 20 9 12 19 4 19 20" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon><line x1="5" y1="4" x2="5" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
          </button>

          {/* Retroceder 15s */}
          <button 
            className="player-btn" 
            onClick={() => skipSeconds(-15)} 
            aria-label="Retroceder 15 segundos"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" role="img" aria-label="Retroceder"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
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
              <svg viewBox="0 0 24 24" role="img" aria-label="Pausa"><line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="2.5"></line><line x1="18" y1="4" x2="18" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
            ) : (
              <svg viewBox="0 0 24 24" role="img" aria-label="Reproducir"><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon></svg>
            )}
          </button>

          {/* Adelantar 15s */}
          <button 
            className="player-btn" 
            onClick={() => skipSeconds(15)} 
            aria-label="Adelantar 15 segundos"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" role="img" aria-label="Adelantar"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" stroke="currentColor" fill="none" strokeWidth="2.5"></path></svg>
          </button>

          {/* Capítulo siguiente */}
          <button
            className="player-btn"
            onClick={handleNextChapter}
            disabled={currentChapterIndex >= chapters.length}
            aria-label="Capítulo siguiente"
            onFocus={() => playCue('focus')}
          >
            <svg viewBox="0 0 24 24" role="img" aria-label="Siguiente"><polygon points="5 4 15 12 5 20 5 4" stroke="currentColor" fill="none" strokeWidth="2.5"></polygon><line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth="2.5"></line></svg>
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
      </div>

      {/* Volumen y velocidad */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
        {/* Control de Velocidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="speed-select" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Velocidad:</label>
          <select
            id="speed-select"
            value={playbackRate}
            onChange={(e) => changeSpeed(parseFloat(e.target.value))}
            onFocus={() => playCue('focus')}
            style={{
              backgroundColor: '#1F2937',
              color: '#FFFFFF',
              border: '2px solid #4B5563',
              borderRadius: '6px',
              padding: '0.2rem 0.5rem',
              fontWeight: 'bold',
            }}
          >
            <option value="0.75">0.75x</option>
            <option value="1.0">1.0x (Normal)</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="1.75">1.75x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>

        {/* Control de Volumen */}
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
              announceText(`Volumen al ${Math.round(val * 100)} por ciento`, false);
            }}
            onFocus={() => playCue('focus')}
            aria-label="Control de volumen"
            style={{
              flex: 1,
              cursor: 'pointer',
            }}
          />
        </div>
      </div>
    </footer>
  );
};
export default AudioPlayer;
