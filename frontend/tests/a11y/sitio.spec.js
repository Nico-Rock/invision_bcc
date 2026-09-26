// Accesibilidad del sitio público (spec 002, Historia 8). Cada caso cita su V#.
import { test, expect } from '@playwright/test';
import { EMAIL, CLAVE, apiDisponible, prefs, espiarVoz, ingresar, axe, medir } from './ayudas.js';

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

  test('V21: S lleva al buscador y una "s" escrita no dispara el atajo', async ({ page }) => {
    await page.keyboard.press('s');
    await expect(page.getByRole('searchbox', { name: /Buscar audiolibro/ })).toBeFocused();
    await page.keyboard.type('sol');
    await expect(page.getByRole('searchbox', { name: /Buscar audiolibro/ })).toHaveValue('sol');
  });

  test('V21: Espacio sobre un botón lo activa (no lo secuestra el reproductor)', async ({ page }) => {
    await page.getByRole('button', { name: /Ayuda de Atajos/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: /Atajos de Teclado/ })).toBeVisible();
  });

  test('V22: la ayuda es un diálogo modal que retiene y devuelve el foco', async ({ page }) => {
    // Cerrada: Tab nunca llega a "Entendido"
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).not.toBe('Entendido');
    }
    const disparador = page.getByRole('button', { name: /Ayuda de Atajos/ });
    await disparador.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog', { name: /Atajos de Teclado/ });
    await expect(dialogo).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(disparador).toBeFocused();
  });

  test('V20: con la lectura en voz apagada el sitio no habla', async ({ page }) => {
    await page.keyboard.press('2');
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
});
