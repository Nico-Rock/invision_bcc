import { useEffect } from 'react';
import { useAudio } from './useAudio';
import { useNavigate } from 'react-router-dom';

export const useKeyboardShortcuts = ({ onFocusSearch, onFocusGenres, onToggleHelp }) => {
  const {
    isPlaying,
    currentBook,
    togglePlayback,
    skipSeconds,
    announceText,
    playCue,
  } = useAudio();

  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput = 
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable;

      // Global ESC key (always active)
      if (e.key === 'Escape') {
        if (onToggleHelp) {
          onToggleHelp(false);
        }
      }

      // If typing in input, ignore shortcuts below
      if (isInput) return;

      // Shift + S or S: Focus Search Box
      if ((e.shiftKey && e.key.toLowerCase() === 's') || (e.key.toLowerCase() === 's')) {
        e.preventDefault();
        if (onFocusSearch) {
          onFocusSearch();
        }
      }

      // Space: Toggle playback
      if (e.key === ' ' && currentBook) {
        e.preventDefault();
        togglePlayback();
      }

      // Left Arrow: Skip backward 15s
      if (e.key === 'ArrowLeft' && currentBook) {
        e.preventDefault();
        skipSeconds(-15);
      }

      // Right Arrow: Skip forward 15s
      if (e.key === 'ArrowRight' && currentBook) {
        e.preventDefault();
        skipSeconds(15);
      }

      // Navigation shortcuts
      if (e.key === '1') {
        e.preventDefault();
        navigate('/perfil');
        announceText('Navegando a la sección Perfil');
        playCue('action');
      } else if (e.key === '2') {
        e.preventDefault();
        navigate('/');
        announceText('Navegando al catálogo de audiolibros');
        playCue('action');
      } else if (e.key === '3') {
        e.preventDefault();
        navigate('/admin/import');
        announceText('Navegando al Panel de Administración e Ingesta');
        playCue('action');
      }

      // 4 or G: Focus Genres
      if (e.key === '4' || e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (onFocusGenres) {
          onFocusGenres();
        }
      }

      // ? or H: Announce help shortcuts
      if (e.key === '?' || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (onToggleHelp) {
          onToggleHelp(true);
        } else {
          announceText(
            'Atajos disponibles: 1 para perfil, 2 para catálogo principal, 3 para panel de administración, 4 o G para géneros, S para buscar, Espacio para pausar, Flechas para adelantar o retroceder quince segundos, y Escape para cerrar ventanas de ayuda.'
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentBook, isPlaying, onFocusSearch, onFocusGenres, onToggleHelp, navigate, togglePlayback, skipSeconds, announceText, playCue]);
};
