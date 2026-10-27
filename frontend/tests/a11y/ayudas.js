// Utilidades compartidas por las pruebas de accesibilidad del sitio.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const MEDIR = path.resolve(aqui, '../../../verificacion/a11y/medir.js');

export const EMAIL = process.env.INVISION_DEMO_EMAIL;
export const CLAVE = process.env.INVISION_DEMO_PASSWORD;
export const API = process.env.INVISION_API_URL || 'http://localhost:8000';

export async function apiDisponible() {
  try {
    const r = await fetch(`${API}/genres`);
    return r.ok;
  } catch {
    return false;
  }
}

// Preferencias antes de cargar: voz y señales apagadas salvo que el caso diga otra cosa.
export async function prefs(page, valores = {}) {
  // Sin transiciones: medir a mitad de un cambio de color da falsos negativos.
  // Además ejercita la regla de movimiento reducido (R17).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((v) => {
    const base = { 'a11y-cues': 'false', 'a11y-voz': 'false', ...v };
    for (const [k, val] of Object.entries(base)) localStorage.setItem(k, val);
  }, valores);
}

// Espía de la síntesis de voz: cuenta cada speak().
export async function espiarVoz(page) {
  await page.addInitScript(() => {
    window.__habla = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (u) => window.__habla.push(u.text);
    }
  });
}

export async function ingresar(page) {
  await page.goto('/login');
  await page.getByLabel('Correo Electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor();
}

export async function axe(page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`);
}

export async function medir(page) {
  await page.addScriptTag({ path: MEDIR });
  return page.evaluate(async () => ({
    // El barrido toma el valor de un <input> por texto: el número de un rango y el «on» de una
    // casilla (que no se dibujan) se exigen a 7:1. Son falsos positivos del barrido, no textos.
    contraste: window.Medir.barridoContraste().fallas.filter((f) => !/input\.progress-slider$/.test(f.selector) && f.texto !== 'on').map((f) => `${f.texto} ${f.color}/${f.fondo} ${f.ratio}`),
    objetivos: window.Medir.objetivos(48).map((o) => `${o.texto || o.selector} ${o.ancho}x${o.alto}`),
    reflow: window.Medir.reflow(),
    vivas: window.Medir.regionesVivas(),
    invisibles: window.Medir.enfocablesInvisibles(),
    etiquetas: window.Medir.etiquetaEnNombre(),
  }));
}

// Avisos del canal cortés (los <p> de #a11y-cortes), en orden.
export const avisos = (page) => page.evaluate(() => [...document.querySelectorAll('#a11y-cortes p')].map((p) => p.textContent));

export const vaciarAvisos = (page) => page.evaluate(() => {
  document.getElementById('a11y-cortes').replaceChildren();
  document.getElementById('a11y-urgente').textContent = '';
});

// Segundos transcurridos según el reloj visible del reproductor ("m:ss").
export async function segundosReproducidos(page) {
  const texto = (await page.locator('.progress-bar-container > span').first().textContent()).trim();
  const [m, s] = texto.split(':').map(Number);
  return m * 60 + s;
}

// Elige el primer libro del catálogo con el teclado y espera a que suene,
// con el foco en el botón de reproducir y pausar (variante S3).
export async function elegirLibro(page) {
  await page.locator('.book-card').first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Pausar audiolibro' }).waitFor({ timeout: 60_000 });
}

// ---------------------------------------------------------------------------
// API simulada (T-h). Para los casos que no necesitan la API real ni
// credenciales: toda llamada a la API del sitio se intercepta en el navegador
// y nada sale a la red. Un token falso (sin firma) basta, porque el sitio solo
// decodifica el contenido.
// ---------------------------------------------------------------------------
const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function tokenSimulado({ roles = ['Admin'] } = {}) {
  const cabecera = base64url({ alg: 'none', typ: 'JWT' });
  const cuerpo = base64url({ id: 1, sub: 'admin@simulado.test', username: 'admin', roles, exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${cabecera}.${cuerpo}.firma`;
}

// WAV de silencio (8 kHz, 8 bits, mono): suena de verdad en el <audio> sin pesar.
export function wavSilencio(segundos = 20) {
  const muestras = 8000 * segundos;
  const b = Buffer.alloc(44 + muestras, 128);
  b.write('RIFF', 0); b.writeUInt32LE(36 + muestras, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36); b.writeUInt32LE(muestras, 40);
  return b;
}

export const LIBRO_SIMULADO = {
  id: 7, nombre: 'PRUEBA ARNES Libro', autor: 'Autora de prueba', narrador: 'Voz de prueba', genero: 'Novela',
  estado_publicacion: 'borrador', en_memoria: false, narracion_habilitada: true, categoria_id: null, clasificaciones: [], descripcion: '',
};

export const CAPITULOS_SIMULADOS = [
  { indice: 1, nombre: 'Pista 1.mp3' }, { indice: 2, nombre: 'Pista 2.mp3' }, { indice: 3, nombre: 'Pista 10.mp3' },
];

// Respuesta de /admin/pendientes con los campos nuevos de T-c (nombres en lib/pendientes.js)
export const PENDIENTES_SIMULADOS = {
  indice: { estado: 'listo', ultimo_ok: '2026-10-22T10:00:00', error: null, libros: 538, pistas: 6240, gb: 112.46 },
  sin_audio: { calculando: false, cantidad: 1, libros: [{ id: 7, nombre: 'PRUEBA ARNES Libro' }] },
  audio_sin_ficha: { cantidad: 2, carpetas: ['PRUEBA ARNES Carpeta Uno', 'PRUEBA ARNES Carpeta Dos'] },
  sin_narrador: { habilitado: true, cantidad: 0, libros: [] },
  borradores: { habilitado: true, cantidad: 1, libros: [{ id: 7, nombre: 'PRUEBA ARNES Libro' }] },
  parecidos: { generos: [], autores: [], narradores: [] },
  tareas_con_errores: [],
  papelera: { habilitado: true, cantidad: 0 },
  informe: { fecha: '2026-10-22', habilitado: true, creados: 0, importados: 0, publicados: 0, pistas_subidas: 0, eliminados: 0 },
};

/**
 * Intercepta la API local. `sobrescribir` mapea 'METODO /ruta' a { status, json }
 * o a una función (ruta) => ruta.fulfill(...). Devuelve { llamadas, sinSimular }.
 */
export async function simularApi(page, sobrescribir = {}) {
  const registro = { llamadas: [], sinSimular: [] };
  const token = tokenSimulado();
  await page.addInitScript((t) => localStorage.setItem('token', t), token);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const json = (status, cuerpo) => ({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const tabla = {
    'GET /genres': json(200, []),
    'GET /search': json(200, []),
    'GET /mis-audiolibros': json(200, []),
    'GET /user/me/preferencias': json(404, { detail: 'sin perfil' }),
    'GET /admin/pendientes': json(200, PENDIENTES_SIMULADOS),
    'GET /admin/audiolibros': json(200, [LIBRO_SIMULADO]),
    'GET /admin/categorias': json(200, []),
    'GET /admin/papelera': json(200, []),
    'GET /admin/tareas': json(200, []),
    'GET /admin/operaciones': json(200, []),
    'GET /admin/auditoria/sesiones/': json(200, []),
    [`GET /audio-by-id/${LIBRO_SIMULADO.id}`]: json(200, { audiolibro: LIBRO_SIMULADO.nombre, capitulos: CAPITULOS_SIMULADOS }),
    [`GET /admin/audiolibros/${LIBRO_SIMULADO.id}/audio`]: json(200, { verificadas: 0, pistas: [], duracion_total_hablada: '' }),
    [`GET /admin/audiolibros/${LIBRO_SIMULADO.id}/historial`]: json(200, []),
    [`GET /obtener-progreso/1/${LIBRO_SIMULADO.id}`]: json(404, { detail: 'sin progreso' }),
    'POST /guardar-progreso': json(200, {}),
    ...sobrescribir,
  };
  // Las rutas se comparan sin la barra final ('/admin/auditoria/sesiones/' = '.../sesiones')
  const sinBarra = (clave) => clave.replace(/\/+$/, '');
  const normalizada = Object.fromEntries(Object.entries(tabla).map(([k, v]) => [sinBarra(k), v]));
  const wav = wavSilencio();
  await page.route(/^http:\/\/localhost:8000\//, async (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    if (peticion.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
    const clave = `${peticion.method()} ${url.pathname}`;
    registro.llamadas.push(clave);
    const exacta = normalizada[sinBarra(clave)];
    if (typeof exacta === 'function') return exacta(ruta);
    if (exacta) return ruta.fulfill(exacta);
    // Un libro recién creado en la prueba: sin audio, sin verificación y sin historial
    if (peticion.method() === 'GET') {
      if (/^\/audio-by-id\/\d+$/.test(url.pathname)) return ruta.fulfill(json(200, { audiolibro: 'nuevo', capitulos: [] }));
      if (/^\/admin\/audiolibros\/\d+\/audio$/.test(url.pathname)) return ruta.fulfill(json(200, { verificadas: 0, pistas: [], duracion_total_hablada: '' }));
      if (/^\/admin\/audiolibros\/\d+\/historial$/.test(url.pathname)) return ruta.fulfill(json(200, []));
    }
    if (url.pathname.startsWith('/stream-audio-simple/')) {
      return ruta.fulfill({ status: 200, headers: { ...cors, 'content-type': 'audio/wav' }, body: wav });
    }
    registro.sinSimular.push(clave);
    return ruta.fulfill(json(404, { detail: 'no simulada' }));
  });
  return registro;
}
