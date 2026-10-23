// Accesibilidad del sitio público (spec 002, Historia 8). Cada caso cita su V#.
import { test, expect } from '@playwright/test';
import {
  EMAIL, CLAVE, apiDisponible, prefs, espiarVoz, ingresar, axe, medir,
  avisos, vaciarAvisos, segundosReproducidos, elegirLibro,
} from './ayudas.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const TECLAS_RETIRADAS = ['s', 'g', 'h', '?', '1', '2', '3', '4'];

test.describe('sin sesión: ingreso', () => {
  test.beforeEach(async ({ page }) => {
    await prefs(page);
    await page.goto('/login');
  });

  test('V17 y V14: axe en 0, dos regiones vivas y texto AAA', async ({ page }) => {
    expect(await axe(page)).toEqual([]);
    const m = await medir(page);
    expect(m.vivas.map((v) => v.modo).sort()).toEqual(['assertive', 'polite']);
    expect(m.contraste).toEqual([]);
    expect(m.objetivos).toEqual([]);
    expect(m.etiquetas).toEqual([]);
  });

  test('V14 (alto contraste): axe en 0 y texto AAA', async ({ page }) => {
    await page.getByRole('button', { name: 'Alto Contraste' }).click();
    await expect(page.locator('html')).toHaveClass(/high-contrast/);
    expect(await axe(page)).toEqual([]);
    expect((await medir(page)).contraste).toEqual([]);
  });

  test('V23: un ingreso inválido marca los campos y avisa por el canal urgente', async ({ page }) => {
    test.skip(!(await apiDisponible()), 'La API local no responde en :8000');
    await page.getByLabel('Correo Electrónico').fill('nadie@ejemplo.org');
    await page.getByLabel('Contraseña').fill('mal');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('#a11y-urgente')).not.toBeEmpty();
    await expect(page.getByLabel('Correo Electrónico')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Contraseña')).toHaveAttribute('aria-invalid', 'true');
  });

  test('V1-V3: al 200 % no hay controles fuera de vista', async ({ page }) => {
    for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Aumentar Texto/ }).click();
    const tam = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(tam).toBe('32px');
    const m = await medir(page);
    expect(m.reflow.fuera).toEqual([]);
    expect(m.reflow.desplazamientoHorizontal).toBe(false);
  });

  test('S3: en el ingreso el único enlace de salto es al contenido principal, es el primer Tab y lleva al <main>', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido principal' })).toBeFocused();
    await expect(page.locator('a.skip-link')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content-section')).toBeFocused();
  });

  test('S3: en el ingreso, S, G, H, ? y los dígitos 1 a 4 no hacen nada', async ({ page }) => {
    for (const k of TECLAS_RETIRADAS) await page.keyboard.press(k);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('R37: las preferencias se aplican antes del primer pintado', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('a11y-high-contrast', 'true');
      localStorage.setItem('a11y-font-scale', '99');
      new MutationObserver(() => {
        if (document.body && window.__claseAlPintar === undefined) {
          window.__claseAlPintar = document.documentElement.className;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/login');
    expect(await page.evaluate(() => window.__claseAlPintar)).toMatch(/high-contrast/);
    // Valor corrupto (99): se acota al máximo de 32 px, no rompe
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
  });
});

test.describe('con sesión: catálogo', () => {
  test.beforeAll(async () => {
    test.skip(!EMAIL || !CLAVE, 'Faltan INVISION_DEMO_EMAIL / INVISION_DEMO_PASSWORD en el entorno');
    test.skip(!(await apiDisponible()), 'La API local no responde en :8000');
  });

  test.beforeEach(async ({ page }) => {
    await prefs(page);
    await espiarVoz(page);
    await ingresar(page);
  });

  test('V17 y V14: axe en 0 y texto AAA en los dos modos', async ({ page }) => {
    expect(await axe(page)).toEqual([]);
    let m = await medir(page);
    expect(m.contraste).toEqual([]);
    expect(m.objetivos).toEqual([]);
    expect(m.vivas).toHaveLength(2);
    await page.getByRole('button', { name: 'Alto Contraste' }).click();
    expect(await axe(page)).toEqual([]);
    m = await medir(page);
    expect(m.contraste).toEqual([]);
  });

  test('V14 (R20): los géneros reales están a la vista y filtran; nada enfocable invisible', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Géneros' });
    const enlaces = nav.getByRole('link');
    expect(await enlaces.count()).toBeGreaterThan(2);
    // El primero es "Todos"; el segundo ya es un género real del catálogo
    const primero = enlaces.nth(1);
    const nombre = (await primero.textContent()).trim();
    await primero.click();
    await expect(page).toHaveURL(/genero=/);
    await expect(page.locator('#results-title-header')).toContainText(nombre.toUpperCase());
    await expect(primero).toHaveAttribute('aria-current', 'page');
    expect((await medir(page)).invisibles).toEqual([]);
  });

  test('S3: los enlaces de salto son los primeros Tab y cada uno lleva a un elemento que existe', async ({ page }) => {
    // Al recargar (carga inicial) el foco no se mueve solo
    await page.reload();
    await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor();
    await expect(page.locator('#results-title-header')).not.toBeFocused();
    const esperados = [
      ['Saltar al contenido principal', '#main-content-section'],
      ['Saltar al menú', '#menu-heading'],
      ['Saltar al buscador', '#buscador'],
      ['Saltar a los géneros', '#genres-heading'],
    ];
    for (const [texto] of esperados) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(texto);
    }
    // Sin libro cargado no se ofrece el salto al reproductor
    await expect(page.getByRole('link', { name: 'Saltar al reproductor' })).toHaveCount(0);
    for (const [texto, destino] of esperados) {
      await page.getByRole('link', { name: texto }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(destino)).toBeFocused();
    }
    await expect(page.getByRole('search')).toHaveCount(1);
  });

  // Tab×2, Enter sobre «Saltar al menú» y Tab×3: Perfil, Catálogo y, en una cuenta Admin, Administración
  test('Saltos: «Saltar al menú» es el segundo Tab y deja el foco en el menú; 3 Tab más llegan al tercer enlace', async ({ page }) => {
    await page.reload();
    await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al menú' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu-heading')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Perfil', exact: true })).toBeFocused();
  });

  test('S3 (V21): S, G, H, ? y los dígitos 1 a 4 ya no hacen nada; una "s" en el buscador se escribe', async ({ page }) => {
    await page.locator('#results-title-header').focus();
    const antes = page.url();
    for (const k of TECLAS_RETIRADAS) await page.keyboard.press(k);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(page.url()).toBe(antes);
    const buscador = page.getByRole('searchbox', { name: /Buscar audiolibro/ });
    await expect(buscador).not.toBeFocused();
    await expect(buscador).not.toHaveAttribute('aria-keyshortcuts');
    await expect(buscador).not.toHaveAttribute('placeholder', /tecla/);
    await buscador.click();
    await page.keyboard.type('sol');
    await expect(buscador).toHaveValue('sol');
    // Sin marcas de teclas en el menú ni en los géneros
    await expect(page.getByRole('navigation', { name: 'Menú' })).not.toContainText(/\[\d\]/);
    await expect(page.getByRole('heading', { name: 'Géneros', exact: true })).toBeVisible();
  });

  test('S3: tras ingresar, al elegir un género y al cambiar de sección, el foco va al encabezado principal', async ({ page }) => {
    await expect(page.locator('#results-title-header')).toBeFocused();
    await page.getByRole('navigation', { name: 'Géneros' }).getByRole('link').nth(1).click();
    await expect(page).toHaveURL(/genero=/);
    await expect(page.locator('#results-title-header')).toBeFocused();
    await page.getByRole('link', { name: 'Perfil', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mi Perfil' })).toBeFocused();
    await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
    await expect(page.locator('#results-title-header')).toBeFocused();
  });

  test('V21: Espacio sobre un botón lo activa (no lo secuestra el reproductor)', async ({ page }) => {
    await page.getByRole('button', { name: 'Ayuda', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: /Cómo moverte/ })).toBeVisible();
  });

  test('S3: la ayuda explica lector, teclado, toque y mouse y solo lista las teclas del reproductor', async ({ page }) => {
    const boton = page.getByRole('button', { name: 'Ayuda', exact: true });
    await expect(boton).not.toHaveAttribute('aria-keyshortcuts');
    await boton.click();
    const dialogo = page.getByRole('dialog', { name: /Cómo moverte/ });
    for (const titulo of ['Con lector de pantalla', 'Con teclado', 'Con toque', 'Con mouse']) {
      await expect(dialogo.getByRole('heading', { name: titulo })).toBeVisible();
    }
    for (const tecla of ['S', 'G', 'H', '?']) {
      await expect(dialogo.getByRole('cell', { name: tecla, exact: true })).toHaveCount(0);
    }
    await expect(dialogo.getByRole('cell', { name: 'Espacio', exact: true })).toBeVisible();
    await expect(dialogo).toContainText('solo con el foco dentro del reproductor');
    await expect.poll(() => avisos(page)).toContainEqual(expect.stringMatching(/^Ventana de ayuda abierta\. .*reproductor/));
    expect((await avisos(page)).join(' ')).not.toMatch(/S para buscar|4 o G/);
    expect(await axe(page)).toEqual([]);
    expect((await medir(page)).etiquetas).toEqual([]);
  });

  test('V22: la ayuda es un diálogo modal que retiene y devuelve el foco', async ({ page }) => {
    // Cerrada: Tab nunca llega a "Entendido"
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).not.toBe('Entendido');
    }
    const disparador = page.getByRole('button', { name: 'Ayuda', exact: true });
    await disparador.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog', { name: /Cómo moverte/ });
    await expect(dialogo).toBeVisible();
    // Con la ayuda larga, el foco entra por el título (no por "Entendido", al final)
    await expect(dialogo.getByRole('heading', { name: /Cómo moverte/ })).toBeFocused();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(disparador).toBeFocused();
  });

  test('V20: con la lectura en voz apagada el sitio no habla', async ({ page }) => {
    await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
    await page.getByRole('button', { name: 'Alto Contraste' }).click();
    expect(await page.evaluate(() => window.__habla.length)).toBe(0);
  });

  test('V23: si /genres falla, se avisa por el canal urgente', async ({ page }) => {
    await page.route('**/genres', (ruta) => ruta.fulfill({ status: 500, body: 'error' }));
    await page.reload();
    await expect(page.locator('#a11y-urgente')).toContainText(/géneros/i);
  });

  test('V1-V3: catálogo al 200 % sin controles fuera de vista', async ({ page }) => {
    for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Aumentar Texto/ }).click();
    const m = await medir(page);
    expect(m.reflow.fuera).toEqual([]);
    expect(m.reflow.desplazamientoHorizontal).toBe(false);
  });

  test('S3 (bug de Espacio): al elegir un libro el foco va a Pausar; Espacio pausa y reanuda sin volver a 0:00; la tarjeta del mismo libro no recarga', async ({ page }) => {
    await elegirLibro(page);
    const boton = page.locator('#playerPlayBtn');
    await expect(boton).toBeFocused();
    await expect(boton).toHaveAccessibleName('Pausar audiolibro');
    await expect.poll(() => segundosReproducidos(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Space');
    await expect(boton).toHaveAccessibleName('Reproducir audiolibro');
    const pausado = await segundosReproducidos(page);
    expect(pausado).toBeGreaterThanOrEqual(3);
    await page.keyboard.press('Space');
    await expect(boton).toHaveAccessibleName('Pausar audiolibro');
    expect(await segundosReproducidos(page)).toBeGreaterThanOrEqual(pausado);
    // Elegir otra vez la misma tarjeta (con Espacio) no recarga: solo lleva el foco a Pausar
    await vaciarAvisos(page);
    await page.locator('.book-card').first().focus();
    await page.keyboard.press('Space');
    await expect(boton).toBeFocused();
    expect((await avisos(page)).join(' ')).not.toMatch(/Obteniendo capítulos|Cargando capítulo/);
    expect(await segundosReproducidos(page)).toBeGreaterThanOrEqual(pausado);
  });

  test('S3: Espacio, flechas, N, P y M solo actúan con el foco dentro del reproductor', async ({ page }) => {
    await elegirLibro(page);
    await page.evaluate(() => {
      window.__prevenidas = [];
      window.addEventListener('keydown', (e) => setTimeout(() => window.__prevenidas.push([e.key, e.defaultPrevented])));
    });
    await page.locator('#results-title-header').focus();
    await vaciarAvisos(page);
    for (const k of ['Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'n', 'p', 'm']) await page.keyboard.press(k);
    expect(await avisos(page)).toEqual([]);
    // Fuera del reproductor no se cancela el comportamiento nativo (desplazar la página)
    expect((await page.evaluate(() => window.__prevenidas)).filter(([, prevenida]) => prevenida)).toEqual([]);
    await page.locator('#playerPlayBtn').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => avisos(page)).toContainEqual('15 segundos adelantados');
    await page.keyboard.press('m');
    await expect.poll(() => avisos(page)).toContainEqual('Silenciado.');
  });

  test('S3: con un libro cargado aparece el salto al reproductor; lleva a él y ahí Espacio pausa', async ({ page }) => {
    await elegirLibro(page);
    const salto = page.getByRole('link', { name: 'Saltar al reproductor' });
    await expect(salto).toHaveCount(1);
    await salto.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#reproductor')).toBeFocused();
    await expect(page.getByRole('region', { name: 'Reproductor de audiolibros' }).getByRole('heading', { level: 2 })).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(page.locator('#playerPlayBtn')).toHaveAccessibleName('Reproducir audiolibro');
  });

  test('S3 (V1-V3): a 320×200 px el reproductor deja de ser fijo y no tapa el foco; a tamaño normal sigue fijo', async ({ page }) => {
    await elegirLibro(page);
    const posicion = () => page.locator('.player-dock').evaluate((el) => getComputedStyle(el).position);
    expect(await posicion()).toBe('fixed');
    await page.setViewportSize({ width: 320, height: 200 });
    expect(await posicion()).toBe('static');
    const boton = page.locator('#playerPlayBtn');
    await boton.focus();
    const caja = await boton.boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.y).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(320);
    expect(caja.y + caja.height).toBeLessThanOrEqual(200);
    const m = await medir(page);
    expect(m.reflow.desplazamientoHorizontal).toBe(false);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await posicion()).toBe('fixed');
  });
});

test.describe('con sesión, en iPhone: volumen del sistema', () => {
  test.use({ userAgent: IPHONE_UA });

  test.beforeAll(async () => {
    test.skip(!EMAIL || !CLAVE, 'Faltan INVISION_DEMO_EMAIL / INVISION_DEMO_PASSWORD en el entorno');
    test.skip(!(await apiDisponible()), 'La API local no responde en :8000');
  });

  test('S3: en iOS el reproductor no muestra el control de volumen (el sistema lo ignora)', async ({ page }) => {
    await prefs(page);
    await ingresar(page);
    await elegirLibro(page);
    await expect(page.getByRole('slider', { name: 'Control de volumen' })).toHaveCount(0);
    await expect(page.getByRole('slider', { name: 'Posición de reproducción' })).toHaveCount(1);
  });
});
