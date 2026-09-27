// Consola de administración operada por una persona ciega (spec 005, grupo A).
// Cada caso cita su V#. Necesita la API local y INVISION_ADMIN_EMAIL /
// INVISION_ADMIN_PASSWORD en el entorno (nunca versionados); si faltan, se saltea.
// La subida de pistas se prueba con permiso y PUT simulados: nunca escribe en el
// almacenamiento real (si la simulación fallara, Azure rechaza la firma falsa).
import { test, expect } from '@playwright/test';
import { apiDisponible, prefs, axe, medir } from './ayudas.js';

const EMAIL = process.env.INVISION_ADMIN_EMAIL;
const CLAVE = process.env.INVISION_ADMIN_PASSWORD;
const PESTANAS = ['Libros', 'Usuarios', 'Auditoría', 'Ingesta Masiva'];

async function entrarConsola(page) {
  await page.goto('/login');
  await page.getByLabel('Correo Electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor({ timeout: 60_000 });
  await page.goto('/admin/import');
  await page.getByRole('tablist').waitFor();
}

const ultimoCortes = (page) => page.evaluate(() => [...document.querySelectorAll('#a11y-cortes p')].map((p) => p.textContent).slice(-1)[0] || '');
const vaciarAvisos = (page) => page.evaluate(() => {
  document.getElementById('a11y-cortes').replaceChildren();
  document.getElementById('a11y-urgente').textContent = '';
});

async function abrirLibros(page) {
  await page.getByRole('tab', { name: 'Libros' }).click();
  await page.getByRole('heading', { level: 2, name: /^Libros/ }).waitFor();
  await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
}

test.describe('consola de administración', () => {
  test.beforeAll(async () => {
    test.skip(!EMAIL || !CLAVE, 'Faltan INVISION_ADMIN_EMAIL / INVISION_ADMIN_PASSWORD en el entorno');
    test.skip(!(await apiDisponible()), 'La API local no responde en :8000');
  });

  test.beforeEach(async ({ page }) => {
    await prefs(page);
    await entrarConsola(page);
  });

  test('V11: abre en Libros, sin la barra de géneros, un título por pestaña, un solo aviso e Inicio/Fin', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Libros' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('navigation', { name: 'Géneros' })).toHaveCount(0);
    await vaciarAvisos(page);
    await page.getByRole('tab', { name: 'Libros' }).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Ingesta Masiva' })).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: /Ingesta/ })).toBeVisible();
    const avisos = await page.evaluate(() => document.querySelectorAll('#a11y-cortes p').length);
    expect(avisos).toBe(1);
    expect(await ultimoCortes(page)).toMatch(/Ingesta Masiva/);
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Libros' })).toBeFocused();
  });

  test('V13: axe en 0, texto AAA y 48 px en cada pestaña, en los dos modos', async ({ page }) => {
    for (const contraste of [false, true]) {
      if (contraste) await page.getByRole('button', { name: 'Alto Contraste' }).click();
      for (const nombre of PESTANAS) {
        await page.getByRole('tab', { name: nombre }).click();
        await page.getByRole('heading', { level: 2 }).last().waitFor();
        if (nombre === 'Libros' || nombre === 'Usuarios') await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
        expect(await axe(page), `${nombre} ${contraste ? 'alto contraste' : 'estándar'}`).toEqual([]);
        const m = await medir(page);
        expect(m.contraste, `${nombre}`).toEqual([]);
        expect(m.objetivos, `${nombre}`).toEqual([]);
        expect(m.vivas, `${nombre}`).toHaveLength(2);
      }
    }
  });

  test('V1: la ingesta explica que está deshabilitada y no ofrece cargar', async ({ page }) => {
    await page.getByRole('tab', { name: 'Ingesta Masiva' }).click();
    await expect(page.getByText(/deshabilitada/i).first()).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
  });

  test('V10: la auditoría es una tabla legible, sin región viva propia', async ({ page }) => {
    await page.getByRole('tab', { name: 'Auditoría' }).click();
    await page.getByRole('heading', { level: 2, name: /Auditoría/ }).waitFor();
    await expect(page.locator('[role=log]')).toHaveCount(0);
    // Con la API lenta la pestaña primero dice "Cargando": se espera el resultado
    const tabla = page.getByRole('table');
    await expect(tabla.or(page.getByText(/No hay eventos/))).toBeVisible({ timeout: 60_000 });
    if (await tabla.count()) {
      await expect(tabla.getByRole('columnheader', { name: 'Persona' })).toBeVisible();
    }
  });

  test('V7: libros con un control por fila, total en el título y conteo al buscar', async ({ page }) => {
    await abrirLibros(page);
    const filas = await page.locator('tbody tr').count();
    const botones = await page.locator('tbody button').count();
    expect(botones).toBe(filas);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`Libros.*${filas}`) })).toBeVisible();
    await vaciarAvisos(page);
    await page.getByRole('searchbox', { name: /Buscar libros/ }).fill('cumbres');
    await expect.poll(() => ultimoCortes(page), { timeout: 5000 }).toMatch(/\d+ (libro|libros) encontrad/);
  });

  test('V4 y V8: error urgente con campo marcado; la ficha retiene el foco y Eliminar empieza en Cancelar', async ({ page }) => {
    await abrirLibros(page);
    const registrar = page.getByRole('button', { name: 'Registrar audiolibro' });
    await registrar.click();
    const ficha = page.getByRole('dialog', { name: /Registrar audiolibro/ });
    await expect(ficha).toBeVisible();
    await vaciarAvisos(page);
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#a11y-urgente')).toContainText(/título/i);
    await expect(ficha.getByLabel(/Título/)).toHaveAttribute('aria-invalid', 'true');
    await expect(ficha.getByLabel(/Título/)).toBeFocused();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await ficha.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(ficha).toBeHidden();
    await expect(registrar).toBeFocused();

    const gestionar = page.locator('tbody button').first();
    await gestionar.click();
    const fichaLibro = page.getByRole('dialog');
    await fichaLibro.getByRole('button', { name: 'Eliminar libro' }).click();
    await expect(fichaLibro.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expect(fichaLibro.getByText(/dejará de verse/)).toBeVisible();
    await fichaLibro.getByRole('button', { name: 'Cancelar' }).click();
    await page.keyboard.press('Escape');
    await expect(gestionar).toBeFocused();
  });

  test('V6, V12 y V5: alta con narrador, aviso de parecidos y subida de capítulos', async ({ page }) => {
    await abrirLibros(page);
    const generoExistente = await page.locator('tbody tr td:nth-child(4)').filter({ hasText: /S$/ }).first().textContent();
    const titulo = `PRUEBA ARNES ${Date.now()}`;
    await page.getByRole('button', { name: 'Registrar audiolibro' }).click();
    const ficha = page.getByRole('dialog');
    await ficha.getByLabel(/Título/).fill(titulo);
    await ficha.getByLabel('Narrador').fill('ROSA PRUEBA');
    await ficha.getByRole('checkbox', { name: /En Memoria/ }).check();
    // V12: el mismo género escrito distinto (minúsculas y singular)
    await ficha.getByLabel('Género').fill(generoExistente.trim().toLowerCase().replace(/s$/, ''));
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(ficha.getByRole('heading', { name: /¿Es el mismo/ })).toBeVisible();
    // Puede haber varias variantes existentes (el catálogo real las tiene): se ofrece cada una
    const opciones = ficha.getByRole('button', { name: /^Usar / });
    expect(await opciones.count()).toBeGreaterThan(0);
    await opciones.first().click();
    await expect(page.locator('#a11y-cortes')).toContainText(/registrado/i, { timeout: 30_000 });

    // V6: al volver a abrir, narrador y En Memoria están
    await expect(ficha.getByLabel('Narrador')).toHaveValue('ROSA PRUEBA');
    await expect(ficha.getByRole('checkbox', { name: /En Memoria/ })).toBeChecked();

    // V5: subida con permiso y PUT simulados
    await page.route('**/capitulos/presign-upload**', (ruta) => {
      const nombre = new URL(ruta.request().url()).searchParams.get('filename');
      if (nombre === 'Pista 2.mp3') return ruta.fulfill({ json: { estado: 'existe', blob_path: `x/${nombre}` } });
      return ruta.fulfill({ json: { estado: 'subir', blob_path: `x/${nombre}`, sas_url: `https://cuentaprueba.blob.core.windows.net/simulado-arnes/${encodeURIComponent(nombre)}?sig=falsa` } });
    });
    let intentosPista10 = 0;
    await page.route('**/simulado-arnes/**', (ruta) => {
      if (ruta.request().url().includes('Pista%2010')) {
        intentosPista10 += 1;
        if (intentosPista10 === 1) return ruta.fulfill({ status: 500, body: '' });
      }
      return ruta.fulfill({ status: 201, body: '' });
    });
    const mp3 = (name) => ({ name, mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 prueba') });
    await ficha.getByLabel(/Elegí los archivos MP3/).setInputFiles([mp3('Pista 10.mp3'), mp3('Pista 2.mp3'), mp3('Pista 1.mp3')]);
    const orden = await ficha.locator('ol.orden-pistas li').allTextContents();
    expect(orden.map((t) => t.split(' — ')[0])).toEqual(['Pista 1.mp3', 'Pista 2.mp3', 'Pista 10.mp3']);
    await ficha.getByRole('button', { name: /Subir 3 pistas/ }).click();
    await expect(ficha.getByRole('button', { name: /Reintentar 1 pista/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#a11y-urgente')).toContainText(/Pista 10/);
    await ficha.getByRole('button', { name: /Reintentar 1 pista/ }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/todas las pistas/i, { timeout: 30_000 });
    expect(intentosPista10).toBe(2);

    // Limpieza: el libro de prueba vive solo en la base local
    await ficha.getByRole('button', { name: 'Eliminar libro' }).click();
    await ficha.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/eliminado/i, { timeout: 30_000 });
  });

  test('V9 y V14: roles visibles y contraseñas que se pueden escuchar', async ({ page }) => {
    await page.getByRole('tab', { name: 'Usuarios' }).click();
    await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
    const filaAdmin = page.locator('tbody tr', { hasText: EMAIL });
    await expect(filaAdmin).toContainText('Admin');
    await page.getByRole('button', { name: 'Registrar usuario' }).click();
    const ficha = page.getByRole('dialog');
    const clave = ficha.getByLabel(/^Contraseña/);
    await expect(clave).toHaveAttribute('type', 'password');
    await ficha.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(clave).toHaveAttribute('type', 'text');
    await vaciarAvisos(page);
    await ficha.getByRole('button', { name: 'Generar contraseña' }).click();
    const generada = await clave.inputValue();
    expect(generada).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    expect(await ultimoCortes(page)).toContain('guion');
    await page.keyboard.press('Escape');
  });
});
