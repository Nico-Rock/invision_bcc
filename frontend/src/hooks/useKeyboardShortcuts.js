import { useEffect } from 'react';
import { useAudio } from './useAudio';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { accionReproductor, describirFoco } from '../lib/reproductor';
import { accionGlobal } from '../lib/atajosGlobales';
import { ESTADO_FOCO, enfocarDestino } from '../lib/navegacion';

/**
 * Teclas del reproductor (spec 003, R10 y D10; variante S3). No hay atajos
 * globales de una tecla: no llegan a quien usa NVDA o JAWS, no existen en el
 * iPhone y a la persona mayor solo le provocan disparos accidentales
 * (WCAG 2.1.4). Espacio, flechas, N, P y M actúan solo con el foco dentro del
 * reproductor; fuera de él no se toca el comportamiento nativo. La decisión
 * vive en `lib/reproductor.js`, que tiene sus pruebas.
 */
export const useKeyboardShortcuts = () => {
  const {
    currentBook,
    togglePlayback,
    skipSeconds,
    stepVolume,
    toggleMute,
    neighborChapter,
  } = useAudio();

  useEffect(() => {
    if (!currentBook) return undefined;

    const handleKeyDown = (e) => {
      const accion = accionReproductor(e, describirFoco(document.activeElement));
      if (!accion) return;
      e.preventDefault();
      switch (accion.id) {
        case 'alternar':
          togglePlayback();
          break;
        case 'saltar':
          skipSeconds(accion.valor);
          break;
        case 'volumen':
          stepVolume(accion.valor);
          break;
        case 'capitulo':
          neighborChapter(accion.valor);
          break;
        case 'silencio':
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBook, togglePlayback, skipSeconds, stepVolume, toggleMute, neighborChapter]);
};

// Enfoca un destino que puede tardar en aparecer (cambio de vista)
const enfocarCuando = (selector, intentos = 120) => {
  const destino = document.querySelector(selector);
  if (destino) { enfocarDestino(destino); return; }
  if (intentos > 0) requestAnimationFrame(() => enfocarCuando(selector, intentos - 1));
};

/**
 * Atajos globales con Alt (Alt+1…7) y, dentro de Administración, Alt+Mayús+1…7
 * para las pestañas. Funcionan desde cualquier vista y con el foco en un campo
 * de texto (llevan modificador, no escriben nada). La decisión vive en
 * `lib/atajosGlobales.js`. Cada acción produce un solo aviso cortés.
 */
export const useAtajosGlobales = ({ abrirAyuda }) => {
  const { currentBook, announceText, playCue } = useAudio();
  const { isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    // Compartida por Alt+0 y por la entrada «Continuar escuchando» del menú
    const continuar = () => {
      // Lleva al catálogo si hace falta y pide a la vista que muestre la
      // sección (limpia una búsqueda activa). Foco al primer "Continuar";
      // sin nada que continuar, un único aviso y el foco no se mueve.
      const enCatalogoSinFiltro = pathname === '/' && !window.location.search;
      if (!enCatalogoSinFiltro) navigate('/');
      const pedir = () => window.dispatchEvent(new CustomEvent('invision:continuar'));
      if (enCatalogoSinFiltro) pedir(); else requestAnimationFrame(pedir);
      const esperar = (intentos) => {
        const boton = document.querySelector('.continuar-btn');
        if (boton) { boton.focus(); return; }
        const estado = document.querySelector('[data-continuar]')?.getAttribute('data-continuar');
        if (estado === 'vacio' || estado === 'error' || intentos <= 0) {
          announceText('No tienes libros para continuar.');
          playCue('error');
          return;
        }
        requestAnimationFrame(() => esperar(intentos - 1));
      };
      esperar(180);
    };

    const handleKeyDown = (e) => {
      const accion = accionGlobal(e, {
        esAdmin: isAdmin,
        hayLibro: !!currentBook,
        enAdmin: pathname.startsWith('/admin'),
        dialogoAbierto: !!document.querySelector('dialog[open]'),
        paginas: pathname === '/'
          ? {
            anterior: !!document.querySelector('[data-pagina="anterior"]:not(:disabled)'),
            siguiente: !!document.querySelector('[data-pagina="siguiente"]:not(:disabled)'),
          }
          : null,
        escribiendo: describirFoco(document.activeElement).escribiendo,
      });
      if (!accion) return;
      e.preventDefault();
      const avisar = (texto) => { announceText(texto); playCue('action'); };
      if (accion.tipo === 'pestana') {
        // AdminPanel anuncia y enfoca la pestaña
        window.dispatchEvent(new CustomEvent('invision:pestana', { detail: { id: accion.id } }));
        return;
      }
      switch (accion.id) {
        case 'perfil':
          navigate('/perfil', { state: ESTADO_FOCO });
          avisar('Perfil.');
          break;
        case 'catalogo':
          navigate('/', { state: ESTADO_FOCO });
          // Al entrar al catálogo, la vista ya anuncia cuántos libros hay
          if (pathname === '/') avisar('Catálogo.');
          break;
        case 'admin':
          navigate('/admin/import', { state: ESTADO_FOCO });
          avisar('Administración.');
          break;
        case 'buscador':
          if (pathname !== '/') navigate('/');
          enfocarCuando('#buscador');
          if (pathname === '/') avisar('Buscador.');
          break;
        case 'generos':
          if (!document.getElementById('genres-heading')) break;
          enfocarDestino(document.getElementById('genres-heading'));
          avisar('Géneros.');
          break;
        case 'reproductor':
          enfocarDestino(document.getElementById('reproductor'));
          avisar('Reproductor.');
          break;
        case 'ayuda':
          abrirAyuda();
          break;
        case 'paginaAnterior':
        case 'paginaSiguiente':
          // El botón de paginación cambia de página, anuncia y enfoca el título
          document.querySelector(`[data-pagina="${accion.id === 'paginaAnterior' ? 'anterior' : 'siguiente'}"]`)?.click();
          break;
        case 'continuar':
          continuar();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('invision:ir-continuar', continuar);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('invision:ir-continuar', continuar);
    };
  }, [isAuthenticated, isAdmin, currentBook, pathname, navigate, announceText, playCue, abrirAyuda]);
};
