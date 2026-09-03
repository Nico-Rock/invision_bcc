/** Flujo de carga de audiolibros, operable sin ver la pantalla. */
let libroActual = null;

async function cargarCategorias() {
  try {
    const r = await fetch('/api/categorias');
    const d = await r.json();
    const sel = document.getElementById('campo-categoria');
    (d.categorias || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      // textContent, no innerHTML: el nombre sale de la base y no viene escapado
      opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
  } catch (e) {
    // Sin categorias el flujo sigue: el campo es opcional
  }
}

document.getElementById('form-libro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nombre = document.getElementById('campo-nombre').value.trim();
  if (!nombre) {
    A11y.earcon('error');
    A11y.anunciar('El nombre del libro es obligatorio');
    document.getElementById('campo-nombre').focus();
    return;
  }

  const btn = document.getElementById('btn-crear-libro');
  btn.disabled = true;
  A11y.anunciar('Creando el libro, esperá un momento');

  try {
    const r = await fetch('/api/admin/crear-libro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': window.ADMIN_TOKEN || '',
      },
      body: JSON.stringify({
        nombre,
        autor: document.getElementById('campo-autor').value.trim(),
        genero: document.getElementById('campo-genero').value.trim(),
        descripcion: document.getElementById('campo-descripcion').value.trim(),
        categoria_id: document.getElementById('campo-categoria').value || null,
      }),
    });
    // Un 500 puede volver sin JSON valido: sin este catch el .json() tira y el
    // usuario escucharia "error de conexion" con el servidor respondiendo.
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      A11y.earcon('error');
      A11y.anunciar(d.mensaje || 'No se pudo crear el libro');
      document.getElementById('campo-nombre').focus();
      return;
    }

    libroActual = { id: d.id, nombre: d.nombre };
    A11y.earcon('exito');
    // El mensaje del servidor viaja al proximo paso en vez de anunciarse acá:
    // A11y.anunciar() cancela el anuncio anterior, asi que dos llamadas
    // seguidas dejarian mudo al primero. Un estado, un anuncio.
    mostrarPasoArchivos(d.mensaje);
  } catch (e) {
    A11y.earcon('error');
    A11y.anunciar('Error de conexión con el servidor. Revisá que el panel esté corriendo.');
    // El foco no puede quedar en el body: sin esto el usuario no sabe donde
    // esta parado ni tiene a que volver despues del error.
    document.getElementById('campo-nombre').focus();
  } finally {
    btn.disabled = false;
  }
});

// Enter en el campo nombre no envia el formulario: evita envios accidentales
document.getElementById('campo-nombre').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    document.getElementById('campo-autor').focus();
  }
});

// El item de navegacion es un <a> sin href: el teclado no lo activa por si
// solo. Sin esto la seccion solo se alcanza con el mouse.
document.querySelectorAll('.nav-item[role="button"]').forEach(item => {
  item.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      item.click();
    }
  });
});

/**
 * STUB — la Task 6 reemplaza esta funcion por la UI real de carga de archivos.
 *
 * Task 6: `mensajeServidor` es el copy que el backend redacta para leerse en
 * voz alta (el 201 de /api/admin/crear-libro). Tiene que seguir formando parte
 * del anuncio del paso siguiente, y tiene que ser UN solo A11y.anunciar():
 * dos llamadas encadenadas se pisan entre si.
 *
 * Hasta entonces esto cierra el flujo con un anuncio en vez de tirar
 * ReferenceError dentro del submit, que dejaria al usuario sin respuesta.
 */
function mostrarPasoArchivos(mensajeServidor) {
  const texto = `${mensajeServidor || 'Libro creado.'} `
    + 'La carga de archivos se habilita en el próximo paso.';

  const zona = document.getElementById('paso-archivos');
  if (zona) {
    zona.hidden = false;
    zona.textContent = '';
    const p = document.createElement('p');
    p.className = 'governance-card';
    p.tabIndex = -1;
    // textContent: el mensaje lo redacta el servidor, no se interpola en HTML
    p.textContent = texto;
    zona.appendChild(p);
    // El foco viaja al aviso: si se queda en el boton, el usuario podria
    // volver a enviarlo y crear el libro dos veces sin darse cuenta.
    p.focus();
  }

  A11y.anunciar(texto);
}

cargarCategorias();
