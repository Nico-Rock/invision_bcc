/**
 * Contraseñas fáciles de dictar (spec 005, R17). El administrador ciego tiene
 * que poder escucharla y dictársela al socio sin ambigüedad: palabras comunes
 * sin tildes ni eñes, más dos dígitos.
 */
const PALABRAS = [
  'faro', 'libro', 'nube', 'puerto', 'sol', 'rio', 'mar', 'luna', 'piedra', 'campo',
  'tren', 'verde', 'azul', 'barco', 'isla', 'bosque', 'lago', 'mesa', 'plaza', 'ruta',
  'canto', 'voz', 'papel', 'arena', 'viento', 'fuego', 'hoja', 'cielo', 'perro', 'gato',
];

function aleatorio(n) {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] % n;
  }
  return Math.floor(Math.random() * n);
}

export function generarContrasena() {
  const a = PALABRAS[aleatorio(PALABRAS.length)];
  let b = PALABRAS[aleatorio(PALABRAS.length)];
  while (b === a) b = PALABRAS[aleatorio(PALABRAS.length)];
  const numero = String(10 + aleatorio(90));
  return `${a}-${b}-${numero}`;
}

/** Cómo se anuncia: los guiones por su nombre y los dígitos de a uno. */
export function deletrear(contrasena) {
  return contrasena.split('-')
    .map((parte) => (/^\d+$/.test(parte) ? parte.split('').join(', ') : parte))
    .join(', guion, ');
}
