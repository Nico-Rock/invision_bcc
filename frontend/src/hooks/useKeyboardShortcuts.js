import { useEffect } from 'react';
import { useAudio } from './useAudio';
import { useNavigate } from 'react-router-dom';

/**
 * Atajos del sitio (spec 002, R29, R15). Guardas, iguales a las del panel:
 * nunca con modificadores ni teclas mantenidas; nunca mientras se escribe
 * (incluido Esc); nunca con el foco en un audio o dentro de un diálogo; y
 * Espacio nunca se secuestra sobre un botón o enlace (antes bloqueaba todos
 * los botones cuando había un libro cargado).
 */
const escribiendo = (el) =>
  !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

const sobreControl = (el) =>
  !!el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button');

export const useKeyboardShortcuts = ({ onFocusSearch, onFocusGenres, onToggleHelp }) => {
  const {
    currentBook,
    togglePlayback,
    skipSeconds,
    stepVolume,
    toggleMute,
    neighborChapter,
    announceText,
    playCue,
  } = useAudio();

  const navigate = useNavigate();

  useEffect(() => {
    const irA = (ruta, texto) => {
      navigate(ruta);
      announceText(texto);
      playCue('action');
    };

    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = document.activeElement;
      if (el && el.closest && el.closest('dialog')) return;  // el diálogo nativo maneja Esc y Tab
      if (escribiendo(el)) return;
      if (el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO')) return;

      const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const conLibro = !!currentBook;

      switch (tecla) {
        case 's':
          e.preventDefault();
          onFocusSearch?.();
          break;
        case '1':
          e.preventDefault();
          irA('/perfil', 'Sección Perfil.');
          break;
        case '2':
          e.preventDefault();
          irA('/', 'Catálogo de audiolibros.');
          break;
        case '3':
          e.preventDefault();
          irA('/admin/import', 'Panel de administración e ingesta.');
          break;
        case '4':
        case 'g':
          e.preventDefault();
          onFocusGenres?.();
          break;
        case '?':
        case 'h':
          e.preventDefault();
          onToggleHelp?.(true);
          break;
        case ' ':
          if (conLibro && !sobreControl(el)) {
            e.preventDefault();
            togglePlayback();
          }
          break;
        // Las flechas sí funcionan sobre un botón (ahí queda el foco al elegir
        // un libro); los campos de rango y selectores ya quedan afuera arriba.
        case 'ArrowLeft':
        case 'ArrowRight':
          if (conLibro) {
            e.preventDefault();
            skipSeconds(tecla === 'ArrowRight' ? 15 : -15);
          }
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          if (conLibro) {
            e.preventDefault();
            stepVolume(tecla === 'ArrowUp' ? 1 : -1);
          }
          break;
        case 'n':
        case 'p':
          if (conLibro) {
            e.preventDefault();
            neighborChapter(tecla === 'n' ? 1 : -1);
          }
          break;
        case 'm':
          if (conLibro) {
            e.preventDefault();
            toggleMute();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBook, onFocusSearch, onFocusGenres, onToggleHelp, navigate, togglePlayback, skipSeconds, stepVolume, toggleMute, neighborChapter, announceText, playCue]);
};

// Fuente única de la tabla de ayuda (R39): la ventana y el resumen hablado salen de acá.
export const ATAJOS_SITIO = [
  { teclas: ['S'], accion: 'Ir al buscador' },
  { teclas: ['1', '2', '3'], accion: 'Ir a Perfil, Catálogo o Admin' },
  { teclas: ['4', 'G'], accion: 'Ir a los géneros' },
  { teclas: ['Espacio'], accion: 'Reproducir o pausar', reproductor: true },
  { teclas: ['←', '→'], accion: 'Retroceder o adelantar 15 segundos', reproductor: true },
  { teclas: ['↑', '↓'], accion: 'Subir o bajar el volumen de a 10 %', reproductor: true },
  { teclas: ['N', 'P'], accion: 'Capítulo siguiente o anterior', reproductor: true },
  { teclas: ['M'], accion: 'Silenciar o restaurar el sonido', reproductor: true },
  { teclas: ['Esc'], accion: 'Cerrar esta ayuda' },
  { teclas: ['H', '?'], accion: 'Abrir esta ayuda' },
];

export const RESUMEN_ATAJOS =
  'Atajos disponibles: S para buscar, 1, 2 y 3 para Perfil, Catálogo y Admin, 4 o G para los géneros, '
  + 'y con un libro sonando: Espacio para pausar, flechas izquierda y derecha para moverte 15 segundos, '
  + 'flechas arriba y abajo para el volumen, N y P para cambiar de capítulo y M para silenciar.';
