/**
 * Progreso de escucha ("Continuar escuchando"). Módulo puro, sin React ni
 * navegador; se prueba con `node --test`.
 *
 * Contrato de la API (InvisionAPI-main/audiobooks/routes.py y crud.py):
 * - POST /guardar-progreso, con token: { usuario_id, audiolibro_id,
 *   chapter_index, progreso }. `chapter_index` es entero y empieza en 1;
 *   `progreso` es un Float sin unidad definida por la API. El frontend lo
 *   guarda en SEGUNDOS dentro del capítulo (no en milisegundos ni en %).
 * - GET /obtener-progreso/{usuario_id}/{audiolibro_id}, con token: devuelve
 *   { chapter_index, progreso }; sin registro, { chapter_index: 1, progreso: 0 }.
 * - GET /mis-audiolibros/{usuario_id}, con token: { results: [{ id, nombre,
 *   descripcion, genero, autor, progreso, ultima_reproduccion,
 *   chapter_index }] }, ya ordenado por última reproducción descendente.
 */

/** Intervalo entre guardados mientras suena, en milisegundos. */
export const INTERVALO_GUARDADO_MS = 15000;
/** Segundos antes del final que cuentan como capítulo terminado. */
export const MARGEN_FIN_S = 5;
/** Cantidad máxima de libros en "Continuar escuchando". */
export const MAX_CONTINUAR = 5;

const entero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

/** Segundos válidos: número finito y no negativo; si no, 0. */
export const segundosValidos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Capítulo válido: entero desde 1; si no, 1. */
export const capituloValido = (v) => {
  const n = entero(v);
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

/**
 * Cuerpo de POST /guardar-progreso. Devuelve null si falta el usuario o el
 * libro (la API respondería 400). La posición se redondea a décimas de segundo.
 */
export const payloadProgreso = ({ usuarioId, libroId, capitulo, segundos } = {}) => {
  const u = entero(usuarioId);
  const l = entero(libroId);
  if (!(u >= 1) || !(l >= 1)) return null;
  return {
    usuario_id: u,
    audiolibro_id: l,
    chapter_index: capituloValido(capitulo),
    progreso: Math.round(segundosValidos(segundos) * 10) / 10,
  };
};

/** Lee la respuesta de la API ({ chapter_index, progreso }) como { capitulo, segundos }. */
export const leerProgreso = (raw) => ({
  capitulo: capituloValido(raw && raw.chapter_index),
  segundos: segundosValidos(raw && raw.progreso),
});

/** ¿Hay algo que continuar? Capítulo 1 en el segundo 0 equivale a no tener progreso. */
export const hayProgreso = ({ capitulo, segundos } = {}) => capituloValido(capitulo) > 1 || segundosValidos(segundos) >= 1;

/**
 * Dónde empezar a partir del progreso guardado.
 * - Sin progreso: capítulo 1, segundo 0, reanuda false.
 * - Capítulo más allá del último, o el último a menos de MARGEN_FIN_S del
 *   final (si se conoce la duración): libro terminado, empieza de nuevo.
 * - Otro capítulo a menos de MARGEN_FIN_S del final: el siguiente, desde 0.
 * Devuelve { capitulo, segundos, reanuda, terminado }.
 */
export const posicionInicial = ({ capitulo, segundos, totalCapitulos = 0, duracion = 0 } = {}) => {
  const cap = capituloValido(capitulo);
  const seg = segundosValidos(segundos);
  const total = entero(totalCapitulos) >= 1 ? entero(totalCapitulos) : 0;
  const dur = segundosValidos(duracion);
  const desdeCero = { capitulo: 1, segundos: 0, reanuda: false, terminado: false };
  if (!hayProgreso({ capitulo: cap, segundos: seg })) return desdeCero;
  if (total && cap > total) return { ...desdeCero, terminado: true };
  const alFinal = dur > 0 && seg >= dur - MARGEN_FIN_S;
  if (alFinal) {
    if (!total || cap >= total) return { ...desdeCero, terminado: true };
    return { capitulo: cap + 1, segundos: 0, reanuda: true, terminado: false };
  }
  const acotado = dur > 0 ? Math.min(seg, dur) : seg;
  return { capitulo: cap, segundos: acotado, reanuda: true, terminado: false };
};

/** "capítulo 2, minuto 14" (minutos completos). */
export const textoPosicionHablada = (capitulo, segundos) => `capítulo ${capituloValido(capitulo)}, minuto ${Math.floor(segundosValidos(segundos) / 60)}`;

/** Aviso único al reanudar: 'Continuando «Título», capítulo 2, minuto 14.' */
export const avisoContinuar = (titulo, capitulo, segundos) => `Continuando «${titulo}», ${textoPosicionHablada(capitulo, segundos)}.`;

/** Nombre accesible del botón: 'Continuar «Título», capítulo 2, minuto 14' */
export const nombreBotonContinuar = (titulo, capitulo, segundos) => `Continuar «${titulo}», ${textoPosicionHablada(capitulo, segundos)}`;

/** Throttle: ¿toca guardar? Sí si nunca se guardó o pasó el intervalo. */
export const debeGuardar = ({ ahora, ultimo = null, intervalo = INTERVALO_GUARDADO_MS } = {}) => {
  if (!Number.isFinite(ahora)) return false;
  if (ultimo == null || !Number.isFinite(ultimo)) return true;
  return ahora - ultimo >= intervalo;
};

/**
 * Lista de "Continuar escuchando" desde GET /mis-audiolibros: hasta
 * MAX_CONTINUAR libros, el más reciente primero, sin entradas inválidas.
 */
export const listaContinuar = (data, max = MAX_CONTINUAR) => {
  const filas = Array.isArray(data) ? data : (data && Array.isArray(data.results) ? data.results : []);
  const fecha = (f) => {
    const t = Date.parse(f && f.ultima_reproduccion);
    return Number.isFinite(t) ? t : 0;
  };
  return filas
    .filter((f) => f && entero(f.id) >= 1)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (fecha(b.f) - fecha(a.f)) || (a.i - b.i))
    .slice(0, max)
    .map(({ f }) => ({
      id: f.id,
      title: f.nombre || 'Título desconocido',
      author: f.autor || 'Autor desconocido',
      genre: f.genero || 'General',
      description: f.descripcion || 'Sin descripción disponible',
      capitulo: capituloValido(f.chapter_index),
      segundos: segundosValidos(f.progreso),
    }));
};

/** Evento de ventana que AudioContext despacha tras un POST /guardar-progreso con 200. */
export const EVENTO_PROGRESO_GUARDADO = 'invision:progreso-guardado';
export const INTERVALO_REFRESCO_CONTINUAR_MS = 10000;

/**
 * ¿Hay que volver a pedir "Continuar escuchando" tras un guardado exitoso?
 * Siempre en el primer guardado de un libro, al cambiar de capítulo y al
 * pausar; en los guardados periódicos, a lo más una vez por `intervalo`.
 * `evento`: { libroId, capitulo, motivo }; `previo`: el del último refresco.
 */
export const debeRefrescarContinuar = ({
  ahora, ultimo = null, evento = null, previo = null, intervalo = INTERVALO_REFRESCO_CONTINUAR_MS,
} = {}) => {
  if (!Number.isFinite(ahora) || !evento || evento.libroId == null) return false;
  if (!previo || String(previo.libroId) !== String(evento.libroId)) return true;
  if (Number(previo.capitulo) !== Number(evento.capitulo)) return true;
  if (evento.motivo === 'pausa') return true;
  if (ultimo == null || !Number.isFinite(ultimo)) return true;
  return ahora - ultimo >= intervalo;
};
