# Frontend de Invision

Aplicación web en React 19 y Vite. Está pensada para operarse con teclado y lector de pantalla.

## Comandos

```bash
npm install
npm run dev          # servidor de desarrollo
npm run build        # compilación de producción en dist/
npm run lint         # ESLint
npm run test:unit    # pruebas unitarias (node --test)
npm run test:a11y    # pruebas de accesibilidad con Playwright y axe-core
```

## API

La dirección de la API se toma de `VITE_API_URL`. Si no existe, se asume el mismo host en el puerto 8000. Ver [src/config.js](src/config.js).

## Accesibilidad

El procedimiento de verificación y la matriz de lectores de pantalla están en [../verificacion/a11y](../verificacion/a11y/README.md).
