/**
 * Vocabulario controlado (spec 005, R15). Una persona ciega no detecta a simple
 * vista que "CUENTO" y "CUENTOS" son el mismo género: así nacieron las 17
 * variantes medidas el 26/09. Antes de guardar un valor nuevo, se compara con
 * los existentes ignorando tildes, mayúsculas, espacios y plural.
 */
const singular = (palabra) => palabra.replace(/(es|s)$/, '');

export function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().split(/\s+/).filter(Boolean)
    .map(singular).join(' ');
}

/**
 * Todos los valores existentes que se parecen al escrito, si el escrito no es
 * idéntico a uno de ellos. Devuelve todas las variantes porque el catálogo real
 * ya las tiene ("BIOGRAFIAS Y MEMORIAS" y "BIOGRAFÍAS Y MEMORIAS"): quien no ve
 * tiene que escucharlas todas para elegir.
 */
export function parecidos(valor, existentes) {
  const escrito = String(valor || '').trim();
  if (!escrito || existentes.includes(escrito)) return [];
  const clave = normalizar(escrito);
  return existentes.filter((e) => e && normalizar(e) === clave);
}

/** El primer valor parecido, o null. */
export function parecido(valor, existentes) {
  return parecidos(valor, existentes)[0] || null;
}

export function valoresUnicos(lista) {
  return [...new Set(lista.filter((v) => v && String(v).trim()).map((v) => String(v).trim()))]
    .sort((a, b) => a.localeCompare(b, 'es'));
}
