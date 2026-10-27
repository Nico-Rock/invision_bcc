/**
 * Reglas de pistas del sitio (spec 005, R3 y R5). Son las mismas que la API
 * (audiobooks/validacion_pistas.py, crud.numero_de_capitulo) y el panel: el
 * servidor valida igual, esto solo evita pedir permisos que se van a rechazar.
 */
export function numeroDeCapitulo(nombre) {
  const base = String(nombre).split('/').pop().replace(/\.[^.]+$/, '');
  const numeros = base.match(/\d+/g);
  return numeros ? Number(numeros[numeros.length - 1]) : null;
}

/** Orden de reproducción: por número; las que no tienen número al final, por nombre. */
export function ordenarPistas(archivos) {
  return [...archivos].sort((a, b) => {
    const na = numeroDeCapitulo(a.name);
    const nb = numeroDeCapitulo(b.name);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na === null && nb !== null) return 1;
    if (na !== null && nb === null) return -1;
    return a.name.localeCompare(b.name, 'es');
  });
}

export function validarNombrePista(nombre) {
  if (!nombre || !nombre.trim()) return 'Falta el nombre del archivo.';
  if (nombre.includes('/') || nombre.includes('\\') || nombre.includes('..')) {
    return 'El nombre del archivo no puede incluir carpetas ni dos puntos seguidos.';
  }
  if (nombre.length > 200) return 'El nombre del archivo supera los 200 caracteres.';
  if (!nombre.toLowerCase().endsWith('.mp3')) return 'Solo se aceptan archivos MP3.';
  return null;
}

/** Tope por pista (mismo valor que la API y el panel: 500 MB). */
export const MAX_BYTES_PISTA = 500 * 1024 * 1024;

/**
 * Control de tamaño antes de pedir el permiso. Una pista vacía se subía, quedaba
 * «con problemas» y ya no se podía reemplazar (el permiso es de solo creación).
 */
export function validarTamanoPista(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'El archivo está vacío.';
  if (bytes > MAX_BYTES_PISTA) return 'El archivo supera los 500 megabytes.';
  return null;
}

/** Nombre y tamaño juntos; devuelve el motivo del rechazo o null. */
export function validarPista(archivo) {
  return validarNombrePista(archivo.name) || validarTamanoPista(archivo.size);
}

/**
 * Único punto donde el tamaño viaja a la API. SUPUESTO (otro agente escribe el
 * lado servidor): el permiso lo recibe como parámetro de consulta y la
 * confirmación como campo del cuerpo, ambos con este nombre, en bytes.
 */
export const CAMPO_TAMANO = 'tamano';

export function paramsPermiso(archivo) {
  return new URLSearchParams({ filename: archivo.name, [CAMPO_TAMANO]: String(archivo.size) });
}

export function cuerpoConfirmacion(blobPath, archivo) {
  return JSON.stringify({ blob_path: blobPath, [CAMPO_TAMANO]: archivo.size });
}

/** Aviso al elegir archivos: las pistas sin número van al final (brecha 15). */
export function frasePistasSinNumero(archivos) {
  const sin = archivos.filter((a) => numeroDeCapitulo(a.name) === null);
  if (!sin.length) return '';
  const cuales = sin.map((a) => a.name).join(', ');
  return `${sin.length === 1 ? '1 pista sin número en el nombre va' : `${sin.length} pistas sin número en el nombre van`} al final: ${cuales}.`;
}

export const etiquetaEscuchar = (n, nombre) => `Escuchar capítulo ${n}: ${nombre}`;

export const avisoEscuchaPrevia = (estadoPublicacion) =>
  (estadoPublicacion === 'borrador' ? 'Escucha previa: los socios no ven este libro.' : '');
