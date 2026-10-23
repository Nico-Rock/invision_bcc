/**
 * Navegación por estructura (variante S3): enlaces de salto según la vista y
 * destino del foco tras un cambio de vista. Módulo puro, sin React.
 */

/** Estado de navegación que pide mover el foco al encabezado de la vista nueva. */
export const ESTADO_FOCO = { foco: 'encabezado' };

/** Pestaña activa de la consola: destino del salto «Saltar a las secciones». */
const PESTANA_ACTIVA = '[role="tab"][aria-selected="true"]';

/**
 * Enlaces de salto de la vista actual, en orden. Cada uno apunta a un
 * elemento que existe en esa vista; si no existe, el enlace no se ofrece.
 * Cada enlace trae `destino` (id), `href` y, si el destino cambia con el
 * estado de la página, `destinoSelector`: el selector se resuelve al activar
 * el enlace y el `href` (un ancla que siempre existe) queda de respaldo.
 * - contenido: el <main> está en todas las vistas;
 * - menú: con sesión, en todas las vistas (segundo lugar);
 * - secciones: solo en Administración, la pestaña activa;
 * - buscador: solo en el catálogo, cuando ya se muestra (no mientras se carga la sesión);
 * - géneros: en la barra lateral, con sesión y fuera de Administración;
 * - reproductor: solo con un libro cargado.
 */
export const enlacesDeSalto = ({ pathname = '', autenticado = false, cargando = false, hayLibro = false } = {}) => {
  const enlace = (destino, texto, extra = {}) => ({ destino, texto, href: `#${destino}`, ...extra });
  const enlaces = [enlace('main-content-section', 'Saltar al contenido principal')];
  const enAdmin = pathname.startsWith('/admin');
  if (autenticado) enlaces.push(enlace('menu-heading', 'Saltar al menú'));
  if (autenticado && enAdmin) {
    enlaces.push(enlace('secciones-admin', 'Saltar a las secciones', { destinoSelector: PESTANA_ACTIVA, href: '#tab-inicio' }));
  }
  if (autenticado && !cargando && pathname === '/') {
    enlaces.push(enlace('buscador', 'Saltar al buscador'));
  }
  if (autenticado && !enAdmin) {
    enlaces.push(enlace('genres-heading', 'Saltar a los géneros'));
  }
  if (hayLibro) {
    enlaces.push(enlace('reproductor', 'Saltar al reproductor'));
  }
  return enlaces;
};

/**
 * Lleva el foco a un destino y comprueba que llegó. Si el elemento no puede
 * recibir foco (no es nativamente enfocable), le pone tabindex="-1" y lo
 * intenta una vez más. Devuelve false si tampoco así lo recibe: el llamador
 * deja entonces que el ancla nativa actúe.
 */
export const enfocarDestino = (destino, documento = globalThis.document) => {
  if (!destino) return false;
  destino.focus();
  if (documento.activeElement === destino) return true;
  if (destino.getAttribute('tabindex') === null) destino.setAttribute('tabindex', '-1');
  destino.focus();
  return documento.activeElement === destino;
};

/**
 * Selector del elemento que recibe el foco al llegar a una vista: su
 * encabezado principal (en el catálogo, el de resultados) y, en
 * Administración, la pestaña activa.
 */
export const destinoDeFoco = (pathname = '') => {
  if (pathname === '/') return '#results-title-header';
  if (pathname === '/perfil') return '#profile-title';
  if (pathname.startsWith('/admin')) return PESTANA_ACTIVA;
  return null;
};

/**
 * El foco se mueve solo tras una acción de la persona: la navegación lo pide
 * con ESTADO_FOCO y no es la carga inicial (al recargar, el navegador
 * conserva el estado; por eso se compara con la clave de la primera vista).
 */
export const pideFoco = (location, claveInicial) =>
  !!location && location.key !== claveInicial && location.state?.foco === ESTADO_FOCO.foco;

/**
 * Decide, en cada cambio de ruta o de sesión, si se mueve el foco y adónde.
 * Devuelve { selector, pendiente }. Al ingresar, la sesión cambia antes que
 * la ruta y la redirección de /login a / no conserva ESTADO_FOCO: por eso
 * "acaba de ingresar" se detecta por el cambio de sesión y el pedido queda
 * pendiente hasta que aparece una vista con destino. Sin sesión no hay pedido.
 */
export const decidirFoco = ({ location, claveInicial, pendiente = false, autenticadoAntes, autenticado }) => {
  if (!autenticado) return { selector: null, pendiente: false };
  const acabaDeIngresar = autenticadoAntes === false;
  if (!pendiente && !acabaDeIngresar && !pideFoco(location, claveInicial)) return { selector: null, pendiente: false };
  const selector = destinoDeFoco(location?.pathname);
  return selector ? { selector, pendiente: false } : { selector: null, pendiente: true };
};
