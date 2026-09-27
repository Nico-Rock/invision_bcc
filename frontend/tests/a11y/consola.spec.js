// Consola de administración operada por una persona ciega (spec 005, grupos A, B y C).
// Cada caso cita su V# o R#. Necesita la API local y INVISION_ADMIN_EMAIL /
// INVISION_ADMIN_PASSWORD en el entorno (nunca versionados); si faltan, se saltea.
// La subida de pistas se prueba con permiso, PUT y confirmación simulados: nunca
// escribe en el almacenamiento real (si la simulación fallara, Azure rechaza la
// firma falsa). Todo lo que se crea lleva "PRUEBA ARNES" y se elimina al final.
import { test, expect } from '@playwright/test';
import { apiDisponible, prefs, axe, medir } from './ayudas.js';

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
});
