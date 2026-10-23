/**
 * Textos compartidos de la consola (spec 005). Todo lo que se anuncia o se
 * muestra sale de acá, en castellano llano, para que el administrador ciego
 * escuche siempre la misma palabra para la misma cosa.
 */
export const OPERACIONES = {
  crear_libro: 'Creó la ficha',
  editar_libro: 'Editó la ficha',
  eliminar_libro: 'Envió a la papelera',
  restaurar_libro: 'Restauró de la papelera',
  borrar_definitivo: 'Eliminó definitivamente',
  publicar: 'Publicó',
  despublicar: 'Pasó a borrador',
  subir_pista: 'Subió una pista',
  importar_ficha: 'Importó la ficha',
  fusionar_valores: 'Unió valores parecidos',
  deshacer: 'Deshizo un cambio',
  perfil_socio: 'Cambió el perfil de accesibilidad',
};

// Pestañas (spec 005, R13 y R18): la consola abre en Inicio, que dice qué
// necesita atención. El orden va de lo diario a lo excepcional.
export const PESTANAS = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'content', nombre: 'Libros' },
  { id: 'users', nombre: 'Usuarios' },
  { id: 'import', nombre: 'Importar fichas' },
  { id: 'tareas', nombre: 'Tareas' },
  { id: 'papelera', nombre: 'Papelera' },
  { id: 'audit', nombre: 'Auditoría' },
];

export const ESTADOS_TAREA = {
  encolada: 'en espera',
  en_curso: 'en curso',
  terminada: 'terminada',
  con_errores: 'terminada con errores',
  fallida: 'falló',
};

export const tareaActiva = (t) => t.estado === 'encolada' || t.estado === 'en_curso';

export const PERFILES = [
  { id: 'lector', nombre: 'Usa lector de pantalla', detalle: 'Sin voz propia del sitio (su lector ya lee), contraste y texto estándar.' },
  { id: 'baja_vision', nombre: 'Baja visión', detalle: 'Alto contraste, texto al 150 % y lectura en voz.' },
  { id: 'ceguera_parcial', nombre: 'Ceguera parcial', detalle: 'Alto contraste, texto al 200 % y lectura en voz.' },
  { id: 'mayor_sin_lector', nombre: 'Persona mayor sin lector de pantalla', detalle: 'Texto al 125 % y lectura en voz.' },
];

export const nombrePerfil = (id) => PERFILES.find((p) => p.id === id)?.nombre || 'Sin perfil';

export const CAMPOS = {
  nombre: 'título', autor: 'autor', genero: 'género', descripcion: 'descripción',
  categoria_id: 'categoría', narrador: 'narrador', en_memoria: 'En Memoria',
};

export const fechaHablada = (iso) => {
  if (!iso) return 'sin fecha';
  const f = new Date(iso);
  return `${f.toLocaleDateString('es-AR')} a las ${f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
