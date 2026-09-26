// Arnés de accesibilidad del sitio (spec 002, T20, D12). No toca el `vite build`.
// Requiere el sitio en http://localhost:3000 (npm run dev) y, para los casos con
// sesión, la API local en :8000 más INVISION_DEMO_EMAIL / INVISION_DEMO_PASSWORD
// en el entorno (nunca versionados). Si faltan, esos casos se saltean con motivo.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/a11y',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.INVISION_SITIO_URL || 'http://localhost:3000',
    // Chrome del sistema: evita descargar un Chromium por versión de Playwright
    channel: process.env.PW_CHANNEL || 'chrome',
    viewport: { width: 1280, height: 900 },
    locale: 'es-AR',
  },
});
