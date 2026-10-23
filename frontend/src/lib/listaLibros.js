/**
 * Movimiento con flechas entre las tarjetas de la lista de libros. Módulo puro.
 * Sin envolver: en los extremos no hay movimiento. Devuelve el índice destino,
 * o null si la tecla no es de movimiento o no hay cambio.
 */
export const indiceDestino = (tecla, actual, total) => {
  if (!Number.isInteger(actual) || !(total > 0) || actual < 0 || actual >= total) return null;
  let destino;
  switch (tecla) {
    case 'ArrowDown': case 'ArrowRight': destino = actual + 1; break;
    case 'ArrowUp': case 'ArrowLeft': destino = actual - 1; break;
    case 'Home': destino = 0; break;
    case 'End': destino = total - 1; break;
    default: return null;
  }
  if (destino < 0 || destino >= total || destino === actual) return null;
  return destino;
};

/** Texto de posición: 'Página 1 de 15 · 8 de 120 libros'. */
export const textoPosicion = (pagina, totalPaginas, mostrados, total) =>
  `Página ${pagina} de ${totalPaginas} · ${mostrados} de ${total} libros`;
