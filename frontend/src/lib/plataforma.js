/**
 * Detección de iOS (variante S3). En iPhone y iPad el sistema ignora el
 * volumen que fija la página, así que el reproductor oculta su control.
 * Módulo puro: recibe los datos del navegador (`navigator` o un objeto con
 * `userAgent`, `platform` y `maxTouchPoints`).
 */
const APPLE_MOVIL = /iPhone|iPad|iPod/;

export const esIOS = (datos) => {
  const { userAgent = '', platform = '', maxTouchPoints = 0 } = datos || {};
  if (APPLE_MOVIL.test(userAgent) || APPLE_MOVIL.test(platform)) return true;
  // Desde iPadOS 13 el iPad se anuncia como Mac de escritorio, pero con pantalla táctil
  const pareceMac = platform === 'MacIntel' || /Macintosh/.test(userAgent);
  return pareceMac && Number(maxTouchPoints) > 1;
};
