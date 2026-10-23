// Velocidades del reproductor. El valor de cada opción del selector es el número
// normalizado como texto ("1", no "1.0"), para que coincida con el estado.
export const VELOCIDADES = [
  { valor: 0.75, etiqueta: '0.75x' },
  { valor: 1, etiqueta: '1.0x (Normal)' },
  { valor: 1.25, etiqueta: '1.25x' },
  { valor: 1.5, etiqueta: '1.5x' },
  { valor: 1.75, etiqueta: '1.75x' },
  { valor: 2, etiqueta: '2.0x' },
];

// Normaliza una velocidad (número o texto, "1.0" o 1) al texto canónico "1".
export const valorVelocidad = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
};
