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
    contraste: window.Medir.barridoContraste().fallas.map((f) => `${f.texto} ${f.color}/${f.fondo} ${f.ratio}`),
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
