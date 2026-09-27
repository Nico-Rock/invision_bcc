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
