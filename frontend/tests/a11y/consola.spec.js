// Consola de administración operada por una persona ciega (spec 005, grupos A, B y C).
// Cada caso cita su V# o R#. Necesita la API local y INVISION_ADMIN_EMAIL /
// INVISION_ADMIN_PASSWORD en el entorno (nunca versionados); si faltan, se saltea.
// La subida de pistas se prueba con permiso, PUT y confirmación simulados: nunca
// escribe en el almacenamiento real (si la simulación fallara, Azure rechaza la
// firma falsa). Todo lo que se crea lleva "PRUEBA ARNES" y se elimina al final.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiDisponible, prefs, axe, medir, simularApi, wavSilencio, LIBRO_SIMULADO, PENDIENTES_SIMULADOS } from './ayudas.js';

const EMAIL = process.env.INVISION_ADMIN_EMAIL;
const CLAVE = process.env.INVISION_ADMIN_PASSWORD;
const PESTANAS = ['Inicio', 'Libros', 'Usuarios', 'Importar fichas', 'Tareas', 'Papelera', 'Auditoría'];

async function ingresar(page, email, clave) {
  await page.goto('/login');
  await page.getByLabel('Correo Electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor({ timeout: 60_000 });
}

async function entrarConsola(page) {
  await ingresar(page, EMAIL, CLAVE);
  await page.goto('/admin/import');
  await page.getByRole('tablist').waitFor();
}

const avisos = (page) => page.evaluate(() => [...document.querySelectorAll('#a11y-cortes p')].map((p) => p.textContent));
const ultimoCortes = async (page) => (await avisos(page)).slice(-1)[0] || '';
const vaciarAvisos = (page) => page.evaluate(() => {
  document.getElementById('a11y-cortes').replaceChildren();
  document.getElementById('a11y-urgente').textContent = '';
});

async function pestana(page, nombre) {
  await page.getByRole('tab', { name: nombre, exact: true }).click();
  await page.getByRole('tabpanel').getByRole('heading', { level: 2 }).first().waitFor();
}

async function abrirLibros(page) {
  await pestana(page, 'Libros');
  await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
}

async function crearLibro(page, titulo, datos = {}) {
  await abrirLibros(page);
  await page.getByRole('button', { name: 'Registrar audiolibro' }).click();
  const ficha = page.getByRole('dialog');
  await ficha.getByLabel(/Título/).fill(titulo);
  for (const [etiqueta, valor] of Object.entries(datos)) await ficha.getByLabel(etiqueta, { exact: true }).fill(valor);
  await ficha.getByRole('button', { name: 'Guardar' }).click();
  // Si aparece "¿Es el mismo?", se guarda como nuevo: el caso V12 lo prueba aparte
  const nuevo = ficha.getByRole('button', { name: 'Guardar como nuevo' });
  if (await nuevo.isVisible().catch(() => false)) await nuevo.click();
  await expect(ficha.getByRole('heading', { name: new RegExp(`Gestionar: ${titulo}`) })).toBeVisible({ timeout: 30_000 });
  return ficha;
}

// Limpieza: a la papelera y de ahí, definitivo. Solo toca fichas "PRUEBA ARNES".
async function purgar(page, titulo) {
  await abrirLibros(page);
  await page.getByRole('searchbox', { name: /Buscar libros/ }).fill(titulo);
  const boton = page.getByRole('button', { name: `Gestionar ${titulo}`, exact: true });
  if (await boton.count()) {
    await boton.click();
    const ficha = page.getByRole('dialog');
    await ficha.getByRole('button', { name: 'Eliminar libro' }).click();
    await ficha.getByRole('button', { name: /Enviar a la papelera|Eliminar definitivamente/ }).click();
    await expect(ficha).toBeHidden({ timeout: 30_000 });
  }
  await pestana(page, 'Papelera');
  const borrar = page.getByRole('button', { name: `Eliminar definitivamente ${titulo}`, exact: true });
  if (await borrar.count()) {
    await borrar.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page.getByRole('button', { name: `Eliminar definitivamente ${titulo}`, exact: true })).toHaveCount(0, { timeout: 30_000 });
  }
}

test.describe('consola de administración', () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    test.skip(!EMAIL || !CLAVE, 'Faltan INVISION_ADMIN_EMAIL / INVISION_ADMIN_PASSWORD en el entorno');
    test.skip(!(await apiDisponible()), 'La API local no responde en :8000');
  });

  test.beforeEach(async ({ page }) => {
    await prefs(page);
    await entrarConsola(page);
  });

  test('V11 y R18: abre en Inicio, anuncia los pendientes, un solo aviso por pestaña e Inicio/Fin', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Inicio' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('navigation', { name: 'Géneros' })).toHaveCount(0);
    await expect.poll(() => avisos(page), { timeout: 30_000 }).toContainEqual(expect.stringMatching(/^Inicio\. Pendientes:/));
    await vaciarAvisos(page);
    await page.getByRole('tab', { name: 'Inicio' }).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Auditoría' })).toBeFocused();
    await expect.poll(() => avisos(page)).toContainEqual('Auditoría.');
    expect((await avisos(page)).filter((a) => a === 'Auditoría.')).toHaveLength(1);
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Inicio' })).toBeFocused();
  });

  test('V13: axe en 0, texto AAA y 48 px en cada pestaña, en los dos modos', async ({ page }) => {
    for (const contraste of [false, true]) {
      if (contraste) await page.getByRole('button', { name: 'Alto Contraste' }).click();
      for (const nombre of PESTANAS) {
        await pestana(page, nombre);
        if (nombre === 'Libros' || nombre === 'Usuarios') await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
        await page.waitForTimeout(800);
        expect(await axe(page), `${nombre} ${contraste ? 'alto contraste' : 'estándar'}`).toEqual([]);
        const m = await medir(page);
        expect(m.contraste, nombre).toEqual([]);
        expect(m.objetivos, nombre).toEqual([]);
        expect(m.vivas, nombre).toHaveLength(2);
      }
    }
  });

  test('V1 y R22: la ingesta de SharePoint sigue deshabilitada; el importador CSV analiza sin escribir', async ({ page }) => {
    await pestana(page, 'Importar fichas');
    await expect(page.getByText(/SharePoint sigue deshabilitada/)).toBeVisible();
    const titulo = `PRUEBA ARNES IMPORTADA ${Date.now()}`;
    const csv = `Título;Autor;Narrador\n${titulo};AUTORA ARNES;VOZ ARNES\n;SIN;TITULO\n`;
    await vaciarAvisos(page);
    await page.getByLabel('Elegí el archivo CSV').setInputFiles({ name: 'fichas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect.poll(() => ultimoCortes(page), { timeout: 30_000 }).toMatch(/2 filas: 1 lista para importar.*1 bloqueada/);
    await expect(page.getByText(/Fila 3.*no se importa.*sin título/)).toBeVisible();
    await page.getByRole('button', { name: /Importar 1 ficha en borrador/ }).click();
    // El vigilante avisa al terminar, desde cualquier pestaña (R21)
    await expect.poll(() => avisos(page), { timeout: 60_000 }).toContainEqual(expect.stringMatching(/^Tarea terminada: Importar 1 fichas/));
    await pestana(page, 'Tareas');
    await expect(page.locator('tbody tr').first()).toContainText('terminada');
    await abrirLibros(page);
    await page.getByRole('searchbox', { name: /Buscar libros/ }).fill(titulo);
    await expect(page.locator('tbody tr', { hasText: titulo })).toContainText('Borrador');
    await expect(page.locator('tbody tr', { hasText: titulo })).toContainText('VOZ ARNES');
    await purgar(page, titulo);
  });

  test('V10 y R26: auditoría con cambios de contenido y accesos en tablas', async ({ page }) => {
    const titulo = `PRUEBA ARNES AUDITORIA ${Date.now()}`;
    await crearLibro(page, titulo);
    await page.keyboard.press('Escape');
    await pestana(page, 'Auditoría');
    await expect(page.locator('[role=log]')).toHaveCount(0);
    const cambios = page.getByRole('region', { name: /Cambios de contenido/ });
    await expect(cambios.getByRole('row', { name: new RegExp(`Creó la ficha.*${titulo}`) })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /Accesos/ })).toBeVisible();
    await purgar(page, titulo);
  });

  test('V7: libros con un control por fila, total en el título, filtro y conteo al buscar', async ({ page }) => {
    await abrirLibros(page);
    const filas = await page.locator('tbody tr').count();
    expect(await page.locator('tbody button').count()).toBe(filas);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`Libros.*${filas}`) })).toBeVisible();
    await vaciarAvisos(page);
    await page.getByRole('searchbox', { name: /Buscar libros/ }).fill('cumbres');
    await expect.poll(() => ultimoCortes(page), { timeout: 5000 }).toMatch(/\d+ (libro|libros) encontrad/);
    await page.getByLabel('Mostrar').selectOption('publicado');
    await expect.poll(() => ultimoCortes(page), { timeout: 5000 }).toMatch(/^\d+ (libro|libros)\.$/);
  });

  test('V4, V8 y R23: error urgente, ficha que retiene el foco, papelera, restaurar e historial con deshacer', async ({ page }) => {
    await abrirLibros(page);
    const registrar = page.getByRole('button', { name: 'Registrar audiolibro' });
    await registrar.click();
    let ficha = page.getByRole('dialog', { name: /Registrar audiolibro/ });
    await vaciarAvisos(page);
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#a11y-urgente')).toContainText(/título/i);
    await expect(ficha.getByLabel(/Título/)).toHaveAttribute('aria-invalid', 'true');
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await ficha.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(registrar).toBeFocused();

    const titulo = `PRUEBA ARNES PAPELERA ${Date.now()}`;
    ficha = await crearLibro(page, titulo, { Autor: 'AUTORA UNO ARNES' });
    await ficha.getByLabel('Autor', { exact: true }).fill('AUTORA DOS ARNES');
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    const deshacer = ficha.getByRole('button', { name: /Deshacer el cambio de autor a AUTORA DOS ARNES/ });
    await expect(deshacer).toBeVisible({ timeout: 30_000 });
    await deshacer.click();
    await expect(ficha.getByLabel('Autor', { exact: true })).toHaveValue('AUTORA UNO ARNES', { timeout: 30_000 });

    await ficha.getByRole('button', { name: 'Eliminar libro' }).click();
    await expect(ficha.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await expect(ficha.getByText(/va a la papelera/)).toBeVisible();
    await ficha.getByRole('button', { name: 'Enviar a la papelera' }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/enviado a la papelera/, { timeout: 30_000 });
    await pestana(page, 'Papelera');
    await page.getByRole('button', { name: `Restaurar ${titulo}`, exact: true }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/restaurado/);
    await purgar(page, titulo);
  });

  test('V6, V12, R19 y V5/R20: narrador, parecidos, publicar exige audio y subida verificada', async ({ page }) => {
    await abrirLibros(page);
    const generoExistente = await page.locator('tbody tr td:nth-child(4)').filter({ hasText: /S$/ }).first().textContent();
    const titulo = `PRUEBA ARNES ${Date.now()}`;
    await page.getByRole('button', { name: 'Registrar audiolibro' }).click();
    const ficha = page.getByRole('dialog');
    await ficha.getByLabel(/Título/).fill(titulo);
    await ficha.getByLabel('Narrador').fill('ROSA PRUEBA ARNES');
    await ficha.getByRole('checkbox', { name: /En Memoria/ }).check();
    await ficha.getByLabel('Género').fill(generoExistente.trim().toLowerCase().replace(/s$/, ''));
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(ficha.getByRole('heading', { name: /¿Es el mismo/ })).toBeVisible();
    const opciones = ficha.getByRole('button', { name: /^Usar / });
    expect(await opciones.count()).toBeGreaterThan(0);
    await opciones.first().click();
    await expect(page.locator('#a11y-cortes')).toContainText(/registrado/i, { timeout: 30_000 });
    await expect(ficha.getByLabel('Narrador')).toHaveValue('ROSA PRUEBA ARNES');
    await expect(ficha.getByRole('checkbox', { name: /En Memoria/ })).toBeChecked();

    // R19: nace en borrador y no se publica sin audio (consulta real y de solo lectura al almacenamiento)
    await expect(ficha.getByText(/Estado: borrador/)).toBeVisible();
    await ficha.getByRole('button', { name: 'Publicar' }).click();
    await expect(page.locator('#a11y-urgente')).toContainText(/no tiene audio/, { timeout: 30_000 });

    // V5 y R20: permiso, PUT y confirmación simulados
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
    await page.route('**/capitulos/confirmar', (ruta) => {
      const blob = ruta.request().postDataJSON().blob_path;
      if (blob.endsWith('Pista 10.mp3')) {
        return ruta.fulfill({ json: { duracion_segundos: 0, duracion_hablada: '0 segundos', problemas: ['danada'], descripcion: 'está dañado: tiene partes que no son audio' } });
      }
      return ruta.fulfill({ json: { duracion_segundos: 1450, duracion_hablada: '24 minutos 10 segundos', problemas: [], descripcion: '' } });
    });
    const mp3 = (name) => ({ name, mimeType: 'audio/mpeg', buffer: Buffer.from('ID3 prueba') });
    await ficha.getByLabel(/Elegí los archivos MP3/).setInputFiles([mp3('Pista 10.mp3'), mp3('Pista 2.mp3'), mp3('Pista 1.mp3')]);
    const orden = await ficha.locator('ol.orden-pistas li').allTextContents();
    expect(orden.map((t) => t.split(' — ')[0])).toEqual(['Pista 1.mp3', 'Pista 2.mp3', 'Pista 10.mp3']);
    await ficha.getByRole('button', { name: /Subir 3 pistas/ }).click();
    await expect(ficha.getByRole('button', { name: /Reintentar 1 pista/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#a11y-urgente')).toContainText(/Pista 10/);
    await expect(ficha.locator('ol.orden-pistas li').first()).toContainText('24 minutos 10 segundos');
    await ficha.getByRole('button', { name: /Reintentar 1 pista/ }).click();
    await expect(page.locator('#a11y-urgente')).toContainText(/con problemas: Pista 10\.mp3 está dañado/, { timeout: 30_000 });
    expect(intentosPista10).toBe(2);
    await page.keyboard.press('Escape');
    await purgar(page, titulo);
  });

  test('R24: unir variantes de un género desde el Inicio, con vista previa', async ({ page }) => {
    const sello = Date.now();
    const a = `PRUEBA ARNES FUSION A ${sello}`;
    const b = `PRUEBA ARNES FUSION B ${sello}`;
    await crearLibro(page, a, { 'Género': `GENERO ARNES ${sello} POESIA` });
    await page.keyboard.press('Escape');
    await crearLibro(page, b, { 'Género': `GENERO ARNES ${sello} POESÍAS` });
    await page.keyboard.press('Escape');
    await pestana(page, 'Inicio');
    await page.getByRole('button', { name: new RegExp(`Unir género: .*GENERO ARNES ${sello}`) }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByRole('radio', { name: `GENERO ARNES ${sello} POESÍAS` }).check();
    await expect.poll(() => ultimoCortes(page), { timeout: 30_000 }).toMatch(/1 ficha cambia/);
    await dialogo.getByRole('button', { name: `Unir en GENERO ARNES ${sello} POESÍAS` }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/1 ficha usa ahora/, { timeout: 30_000 });
    await abrirLibros(page);
    await page.getByRole('searchbox', { name: /Buscar libros/ }).fill(`FUSION A ${sello}`);
    await expect(page.locator('tbody tr', { hasText: a })).toContainText(`GENERO ARNES ${sello} POESÍAS`);
    await purgar(page, a);
    await purgar(page, b);
  });

  test('V9, V14 y R25: roles, contraseñas que se escuchan y perfil que llega al socio', async ({ page, browser }) => {
    await pestana(page, 'Usuarios');
    await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
    await expect(page.locator('tbody tr', { hasText: EMAIL })).toContainText('Admin');

    const sello = Date.now();
    const email = `prueba.arnes.${sello}@invision.com`;
    await page.getByRole('button', { name: 'Registrar usuario' }).click();
    let ficha = page.getByRole('dialog');
    await ficha.getByLabel(/Correo/).fill(email);
    await ficha.getByLabel(/Nombre de usuario/).fill(`pruebaarnes${sello}`);
    const clave = ficha.getByLabel(/^Contraseña/);
    await expect(clave).toHaveAttribute('type', 'password');
    await ficha.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(clave).toHaveAttribute('type', 'text');
    await vaciarAvisos(page);
    await ficha.getByRole('button', { name: 'Generar contraseña' }).click();
    const generada = await clave.inputValue();
    expect(generada).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    expect(await ultimoCortes(page)).toContain('guion');
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(ficha).toBeHidden({ timeout: 30_000 });

    // R25: la administración elige el perfil...
    await page.getByRole('button', { name: `Gestionar pruebaarnes${sello}`, exact: true }).click();
    ficha = page.getByRole('dialog');
    await ficha.getByLabel('Perfil de accesibilidad').selectOption('baja_vision');
    await expect(page.locator('#a11y-cortes')).toContainText(/Baja visión/, { timeout: 30_000 });
    await page.keyboard.press('Escape');

    // ...y el socio, en su primer ingreso desde un dispositivo, lo recibe aplicado
    const contexto = await browser.newContext({ reducedMotion: 'reduce' });
    const socio = await contexto.newPage();
    await ingresar(socio, email, generada);
    await expect(socio.locator('html')).toHaveClass(/high-contrast/, { timeout: 30_000 });
    expect(await socio.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');
    await expect(socio.locator('#a11y-cortes')).toContainText(/Se aplicó tu configuración de accesibilidad/);
    await contexto.close();

    // Limpieza: la cuenta de prueba se elimina
    await page.getByRole('button', { name: `Gestionar pruebaarnes${sello}`, exact: true }).click();
    ficha = page.getByRole('dialog');
    await ficha.getByRole('button', { name: 'Eliminar usuario' }).click();
    await ficha.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(page.locator('#a11y-cortes')).toContainText(/eliminado/, { timeout: 30_000 });
  });

  test('R27: informe del día en el Inicio, imprimible', async ({ page }) => {
    const informe = page.getByRole('region', { name: /Informe del día/ });
    await expect(informe).toBeVisible({ timeout: 30_000 });
    await expect(informe.getByRole('listitem').first()).toBeVisible();
    await expect(informe.getByRole('button', { name: 'Imprimir el informe' })).toBeVisible();
  });

  // Atajos por defecto de las pestañas (spec 004, T10). Se saltean sin sesión de administrador.
  test('T10: el dígito lleva a la pestaña, con un solo aviso y el foco en ella', async ({ page }) => {
    await page.getByRole('tab', { name: 'Inicio' }).focus();
    await vaciarAvisos(page);
    await page.keyboard.press('Digit2');
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toBeFocused();
    await expect.poll(() => avisos(page)).toContainEqual('Libros.');
    expect((await avisos(page)).filter((a) => a === 'Libros.')).toHaveLength(1);
    expect(new URL(page.url()).pathname).toBe('/admin/import');
  });

  test('T10: 1 sobre una pestaña va a Inicio y no a Perfil; con Mayúscula no hace nada', async ({ page }) => {
    await pestana(page, 'Usuarios');
    await page.getByRole('tab', { name: 'Usuarios', exact: true }).focus();
    await page.keyboard.press('Digit1');
    await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).pathname).toBe('/admin/import');
    await page.keyboard.press('Shift+Digit2');
    await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(new URL(page.url()).pathname).toBe('/admin/import');
  });

  test('T10: un 2 dentro del buscador de libros se escribe en el campo', async ({ page }) => {
    await abrirLibros(page);
    const buscador = page.getByRole('searchbox', { name: /Buscar libros/ });
    await buscador.click();
    await page.keyboard.press('2');
    await expect(buscador).toHaveValue('2');
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  // La tecla 3 global se retiró por decisión de Nico (variante S3): en JAWS el 3
  // es "encabezado de nivel 3". Se entra por el enlace del menú y el foco va a
  // la pestaña activa.
  test('T10: el 3 fuera de la consola no hace nada; el enlace Administración del menú lleva el foco a la pestaña activa', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor();
    await page.locator('#results-title-header').focus();
    await page.keyboard.press('Digit3');
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const enlace = page.getByRole('link', { name: 'Administración', exact: true });
    await expect(enlace).not.toHaveAttribute('aria-keyshortcuts');
    await enlace.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toBeFocused({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toHaveAttribute('aria-selected', 'true');
    // Dentro de la consola, el 3 fuera de las pestañas tampoco hace nada
    await abrirLibros(page);
    await page.getByRole('button', { name: 'Registrar audiolibro' }).focus();
    await page.keyboard.press('Digit3');
    await expect(page.getByRole('button', { name: 'Registrar audiolibro' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  // Descubrimiento de las pestañas: «Saltar a las secciones», el texto visible y la ayuda
  test('Saltos: desde la carga de la consola, 3 Tab llegan a «Saltar a las secciones»; Enter enfoca la pestaña activa y → cambia de sección', async ({ page }) => {
    await page.reload();
    await page.getByRole('tablist').waitFor();
    for (const texto of ['Saltar al contenido principal', 'Saltar al menú', 'Saltar a las secciones']) {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: texto })).toBeFocused();
    }
    await page.keyboard.press('Enter');
    const inicio = page.getByRole('tab', { name: 'Inicio', exact: true });
    await expect(inicio).toBeFocused();
    await expect(inicio).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Usuarios', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Usuarios', exact: true })).toHaveAttribute('aria-selected', 'true');
    // El salto sigue a la pestaña activa
    await page.getByRole('link', { name: 'Saltar a las secciones' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Usuarios', exact: true })).toBeFocused();
  });

  test('Pestañas: una sola con tabIndex 0, Tab sale de la lista, el texto visible va antes y ninguna tiene descripción accesible', async ({ page }) => {
    const con0 = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].filter((t) => t.tabIndex === 0).length);
    expect(con0).toBe(1);
    await expect(page.locator('[role="tab"][aria-describedby]')).toHaveCount(0);
    const aviso = page.getByText('Con el foco en las pestañas: las flechas ← → (o los números 1 a 7) cambian de sección; Tab entra en la sección.');
    await expect(aviso).toBeVisible();
    expect(await page.evaluate(() => {
      const p = document.querySelector('.tabs-ayuda');
      return !!(p.compareDocumentPosition(document.querySelector('[role="tablist"]')) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await page.locator('[role="tab"][aria-selected="true"]').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('[role="tablist"]').contains(document.activeElement))).toBe(false);
  });

  test('T10: aria-keyshortcuts coincide con el dígito y la ayuda de un Admin muestra la fila 1 a 7', async ({ page }) => {
    for (const [i, nombre] of PESTANAS.entries()) {
      await expect(page.getByRole('tab', { name: nombre, exact: true })).toHaveAttribute('aria-keyshortcuts', String(i + 1));
    }
    await vaciarAvisos(page);
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    const ayuda = page.getByRole('dialog');
    await expect(ayuda.getByRole('cell', { name: '1 a 7' })).toBeVisible();
    await expect(ayuda.getByRole('cell', { name: '← o → o Inicio o Fin' })).toBeVisible();
    await expect(ayuda).toContainText('Tab entra en la sección');
    await expect(ayuda).toContainText('Con el foco en las pestañas');
    await expect.poll(() => avisos(page)).toContainEqual(expect.stringMatching(/1 para Inicio/));
    expect((await avisos(page)).join(' ')).not.toMatch(/El 3/);
    expect(await axe(page)).toEqual([]);
  });

  // El <audio> no está en el documento: el salto de 15 s se observa por su aviso
  test('T10: con un libro sonando, la flecha derecha sobre una pestaña cambia de pestaña y el audio no se mueve', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: /Audiolibros Disponibles/ }).waitFor();
    await page.locator('.book-card').first().click();
    await page.getByRole('region', { name: 'Reproductor de audiolibros' }).waitFor();
    await page.getByRole('link', { name: 'Administración', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Inicio', exact: true })).toBeFocused({ timeout: 30_000 });
    await vaciarAvisos(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await avisos(page)).not.toContainEqual(expect.stringMatching(/segundos adelantados/));
  });
});

// ---------------------------------------------------------------------------
// T-h (brecha 8, 8b, 14 y E; criterios 7, 9, 10, 11): sin API real ni credenciales.
// Toda llamada a la API se simula en el navegador (ayudas.js: simularApi): el
// reproductor suena un WAV de silencio generado en memoria y nada se escribe
// en ningún almacenamiento ni base.
// ---------------------------------------------------------------------------
const aqui = path.dirname(fileURLToPath(import.meta.url));
const NOMBRE_LIBRO = LIBRO_SIMULADO.nombre;

test('CWE-79: ningún archivo de src usa dangerouslySetInnerHTML', () => {
  const hallazgos = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (/\.(jsx?|tsx?)$/.test(e.name) && fs.readFileSync(ruta, 'utf8').includes('dangerouslySetInnerHTML')) hallazgos.push(path.relative(aqui, ruta));
    }
  };
  recorrer(path.resolve(aqui, '../../src'));
  expect(hallazgos).toEqual([]);
});

test.describe('consola con la API simulada', () => {
  test.describe.configure({ timeout: 120_000 });
  let api;

  const abrirConsola = async (page, sobrescribir) => {
    await prefs(page);
    api = await simularApi(page, sobrescribir);
    await page.goto('/admin/import');
    await page.getByRole('tablist').waitFor();
  };

  // Toda llamada a la API tiene que estar simulada: si el sitio pide algo más, se nota
  test.afterEach(() => {
    expect(api.sinSimular, 'llamadas a la API sin simular').toEqual([]);
  });

  const abrirFicha = async (page) => {
    await pestana(page, 'Libros');
    await page.locator('tbody tr').first().waitFor();
    await page.getByRole('button', { name: `Gestionar ${NOMBRE_LIBRO}`, exact: true }).click();
    const ficha = page.getByRole('dialog');
    await expect(ficha.getByRole('heading', { name: `Gestionar: ${NOMBRE_LIBRO}` })).toBeVisible();
    return ficha;
  };

  test('criterio 9: tres botones de escucha, un solo reproductor dentro de la ficha, foco en Pausar, sin atajos fuera del reproductor, y el audio sigue al cerrar', async ({ page }) => {
    await abrirConsola(page);
    const ficha = await abrirFicha(page);
    await expect(ficha.getByRole('heading', { name: 'Capítulos cargados' })).toBeVisible();
    const botones = ficha.getByRole('button', { name: /^Escuchar capítulo \d/ });
    await expect(botones).toHaveCount(3);
    await expect(ficha.getByRole('list', { name: 'Capítulos cargados' }).getByRole('listitem')).toHaveCount(3);
    await expect(botones.nth(1)).toHaveAccessibleName('Escuchar capítulo 2: Pista 2.mp3');

    await vaciarAvisos(page);
    await botones.nth(1).click();
    await expect(page.getByRole('button', { name: 'Pausar audiolibro' })).toBeFocused({ timeout: 30_000 });
    await expect(page.locator('.player-dock')).toHaveCount(1);
    await expect(page.locator('dialog[open] .player-dock')).toHaveCount(1);
    await expect(page.locator('#playerChapter')).toHaveText('Capítulo 2 de 3');
    expect(await avisos(page)).toContainEqual('Escucha previa: los socios no ven este libro.');

    // Con el foco en la ficha (no en el reproductor), Espacio, N y P no mueven el audio
    await page.locator('#capitulos-titulo').focus();
    for (const tecla of [' ', 'n', 'p']) await page.keyboard.press(tecla);
    await expect(page.locator('#playerChapter')).toHaveText('Capítulo 2 de 3');
    await expect(page.getByRole('button', { name: 'Pausar audiolibro' })).toBeVisible();

    // Con el foco dentro del reproductor, N sí actúa (no se agregó ningún atajo nuevo)
    await page.getByRole('button', { name: 'Pausar audiolibro' }).focus();
    await page.keyboard.press('n');
    await expect(page.locator('#playerChapter')).toHaveText('Capítulo 3 de 3');

    await page.keyboard.press('Escape');
    await expect(ficha).toBeHidden();
    await expect(page.locator('.player-dock')).toHaveCount(1);
    await expect(page.locator('dialog .player-dock')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pausar audiolibro' })).toBeVisible();
  });

  test('criterio 10: ficha con reproductor abierto, axe 0, contraste AAA, 48 px y dos regiones vivas; modo claro y alto contraste, normal y al 200 %', async ({ page }) => {
    await abrirConsola(page);
    let primera = true;
    const revisar = async (etiqueta, doscientos) => {
      const ficha = await abrirFicha(page);
      if (primera) {
        await ficha.getByRole('button', { name: /^Escuchar capítulo 1/ }).click();
        await page.getByRole('button', { name: 'Pausar audiolibro' }).waitFor({ timeout: 30_000 });
        primera = false;
      }
      await expect(page.locator('dialog[open] .player-dock')).toHaveCount(1);
      await page.waitForTimeout(600);
      expect(await axe(page), etiqueta).toEqual([]);
      const m = await medir(page);
      expect(m.contraste, etiqueta).toEqual([]);
      expect(m.objetivos, etiqueta).toEqual([]);
      expect(m.vivas, etiqueta).toHaveLength(2);
      if (doscientos) {
        expect(m.reflow.fuera, etiqueta).toEqual([]);
        expect(m.reflow.desplazamientoHorizontal, etiqueta).toBe(false);
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    };
    await revisar('claro, tamaño normal', false);
    for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Aumentar Texto/ }).click();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('32px');
    await revisar('claro, 200 %', true);
    await page.getByRole('button', { name: 'Alto Contraste' }).click();
    await revisar('alto contraste, 200 %', true);
    for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Disminuir Texto/ }).click();
    await revisar('alto contraste, tamaño normal', false);
  });

  test('criterio 10 (320 px): la ficha con el reproductor no desborda ni deja controles fuera de vista', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await abrirConsola(page);
    const ficha = await abrirFicha(page);
    await ficha.getByRole('button', { name: /^Escuchar capítulo 1/ }).click();
    await page.getByRole('button', { name: 'Pausar audiolibro' }).waitFor({ timeout: 30_000 });
    const m = await medir(page);
    expect(m.reflow.fuera).toEqual([]);
    expect(m.objetivos).toEqual([]);
    expect(await axe(page)).toEqual([]);
  });

  test('criterio 11: Inicio dice libros con audio, pistas y GB; una carpeta sin ficha abre Registrar con el nombre escrito', async ({ page }) => {
    const libros = [LIBRO_SIMULADO];
    let enviado = null;
    await abrirConsola(page, {
      'GET /admin/audiolibros': (ruta) => ruta.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(libros) }),
      'POST /admin/audiolibros': (ruta) => {
        enviado = JSON.parse(ruta.request().postData());
        libros.push({ ...LIBRO_SIMULADO, id: 8, nombre: enviado.nombre, estado_publicacion: 'borrador' });
        return ruta.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ id: 8 }) });
      },
    });
    const inicio = page.getByRole('tabpanel');
    await expect(inicio.getByRole('heading', { name: 'Almacenamiento de audio' })).toBeVisible();
    await expect(inicio).toContainText('538 libros con audio');
    await expect(inicio).toContainText('6.240 pistas');
    await expect(inicio).toContainText('112,5 GB');
    await expect(inicio.getByRole('heading', { name: 'Reglas de operación' })).toBeVisible();
    await expect(inicio.getByRole('listitem').filter({ hasText: 'validación formal previa' })).toHaveCount(1);
    expect(await avisos(page)).toContainEqual(expect.stringMatching(/^Inicio\. Pendientes:.*538 libros con audio.*2 carpetas de audio sin ficha/));

    const ver = inicio.getByRole('button', { name: 'Ver 2 carpetas sin ficha' });
    await expect(ver).toHaveAttribute('aria-expanded', 'false');
    await ver.click();
    await expect(ver).toHaveAttribute('aria-expanded', 'true');

    // Inicio con cifras y carpetas desplegadas: axe 0, AAA, 48 px y dos regiones vivas, en los dos modos
    for (const contraste of [false, true]) {
      if (contraste) await page.getByRole('button', { name: 'Alto Contraste' }).click();
      await page.waitForTimeout(600);
      expect(await axe(page), `Inicio ${contraste ? 'alto contraste' : 'claro'}`).toEqual([]);
      const m = await medir(page);
      expect(m.contraste).toEqual([]);
      expect(m.objetivos).toEqual([]);
      expect(m.vivas).toHaveLength(2);
    }

    await inicio.getByRole('button', { name: 'Registrar audiolibro: PRUEBA ARNES Carpeta Dos' }).click();
    const ficha = page.getByRole('dialog');
    await expect(ficha.getByRole('heading', { name: 'Registrar audiolibro' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Libros', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(ficha.getByLabel(/Título/)).toHaveValue('PRUEBA ARNES Carpeta Dos');
    await expect(ficha.getByLabel(/Título/)).toBeFocused();
    await expect(ficha).toContainText('Se crea como borrador');
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(ficha.getByRole('heading', { name: 'Gestionar: PRUEBA ARNES Carpeta Dos' })).toBeVisible({ timeout: 30_000 });
    expect(enviado.nombre).toBe('PRUEBA ARNES Carpeta Dos');
    // El sitio nunca pide publicar: el estado lo fija el servidor, que crea el libro como borrador
    expect(Object.keys(enviado)).not.toContain('estado_publicacion');
    expect(await avisos(page)).toContainEqual(expect.stringMatching(/registrado como borrador/));
  });

  test('criterio 6 (sitio): con el índice en error, Inicio dice el error por el canal urgente y no «Calculando»', async ({ page }) => {
    const error = { ...PENDIENTES_SIMULADOS, indice: { estado: 'error', ultimo_ok: null, error: 'el almacenamiento no respondió', libros_con_audio: null, pistas: null, gb: null }, sin_audio: { calculando: false, cantidad: null, libros: [], error: 'el almacenamiento no respondió' }, sin_ficha: { calculando: false, cantidad: null, carpetas: [], error: 'el almacenamiento no respondió' } };
    await abrirConsola(page, { 'GET /admin/pendientes': (ruta) => ruta.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(error) }) });
    const inicio = page.getByRole('tabpanel');
    await expect(inicio).toContainText('El índice del almacenamiento falló: el almacenamiento no respondió.');
    await expect(inicio).not.toContainText('Calculando');
    await expect(page.locator('#a11y-urgente')).toContainText('el almacenamiento no respondió');
    expect(await axe(page)).toEqual([]);
  });

  test('criterio 7 (sitio): sin la tabla de sesiones, Auditoría muestra una nota y no un error urgente', async ({ page }) => {
    const texto = 'Esta base no registra los inicios y cierres de sesión.';
    await abrirConsola(page, { 'GET /admin/auditoria/sesiones': (ruta) => ruta.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify({ detail: texto }) }) });
    await pestana(page, 'Auditoría');
    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText(texto)).toBeVisible();
    await expect(panel.locator('.texto-error')).toHaveCount(0);
    await expect(page.locator('#a11y-urgente')).toBeEmpty();
    await expect(panel.getByRole('heading', { name: /Cambios de contenido/ })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test('brecha 14: una pista vacía se rechaza antes de pedir el permiso; el tamaño viaja en el permiso y en la confirmación; se avisa de las pistas sin número', async ({ page }) => {
    const peticiones = { permiso: [], confirmar: [] };
    const ok = (cuerpo) => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    await abrirConsola(page, {
      [`POST /audiolibros/${LIBRO_SIMULADO.id}/capitulos/presign-upload`]: (ruta) => {
        peticiones.permiso.push(ruta.request().url());
        return ruta.fulfill(ok({ estado: 'nuevo', sas_url: 'http://localhost:8000/blob-simulado', blob_path: `${NOMBRE_LIBRO}/Pista 1.mp3` }));
      },
      'PUT /blob-simulado': { status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' },
      [`POST /audiolibros/${LIBRO_SIMULADO.id}/capitulos/confirmar`]: (ruta) => {
        peticiones.confirmar.push(JSON.parse(ruta.request().postData()));
        return ruta.fulfill(ok({ problemas: [], descripcion: 'sin problemas', duracion_hablada: '1 segundo' }));
      },
    });
    const ficha = await abrirFicha(page);
    const campo = ficha.getByLabel(/Elegí los archivos MP3/);
    await vaciarAvisos(page);
    await campo.setInputFiles({ name: 'Vacia 3.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(0) });
    await expect.poll(() => page.locator('#a11y-urgente').textContent()).toMatch(/Vacia 3\.mp3.*vacío/);
    await expect(ficha.getByRole('button', { name: /^Subir/ })).toHaveCount(0);
    expect(peticiones.permiso).toHaveLength(0);

    await vaciarAvisos(page);
    await campo.setInputFiles([
      { name: 'Prólogo.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('abc') },
      { name: 'Pista 1.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('abcd') },
    ]);
    await expect.poll(() => avisos(page)).toContainEqual(expect.stringMatching(/1 pista sin número en el nombre va al final: Prólogo\.mp3/));
    await ficha.getByRole('button', { name: 'Subir 2 pistas' }).click();
    await expect.poll(() => peticiones.confirmar.length, { timeout: 30_000 }).toBe(2);
    expect(peticiones.permiso.map((u) => new URL(u).searchParams.get('tamano'))).toEqual(['4', '3']);
    expect(peticiones.confirmar.map((c) => c.tamano)).toEqual([4, 3]);
  });

  test('catálogo: activar dos veces una tarjeta mientras la pista se descarga pide el audio una sola vez', async ({ page }) => {
    let descargas = 0;
    const ok = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    await abrirConsola(page, {
      'POST /search': { status: 200, headers: ok, body: JSON.stringify({ results: [LIBRO_SIMULADO] }) },
      [`GET /stream-audio-simple/1/${LIBRO_SIMULADO.id}/1`]: async (ruta) => {
        descargas += 1;
        await new Promise((listo) => setTimeout(listo, 1500)); // la descarga tarda
        await ruta.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'audio/wav' }, body: wavSilencio() });
      },
    });
    await page.goto('/');
    const tarjeta = page.locator('.book-card').first();
    await tarjeta.waitFor();
    // El reproductor fijo tapa la tarjeta apenas aparece: se activa dos veces por evento, sin puntero
    await tarjeta.dispatchEvent('click');
    await tarjeta.dispatchEvent('click');
    await page.getByRole('button', { name: 'Pausar audiolibro' }).waitFor({ timeout: 30_000 });
    expect(descargas).toBe(1);
  });

  test('320 px: la fila de pestañas de Administración no desborda la página', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await abrirConsola(page);
    const m = await medir(page);
    expect(m.reflow.desplazamientoHorizontal).toBe(false);
    expect(m.reflow.fuera).toEqual([]);
  });
});
