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

// Los items de navegacion son <a> sin href: el teclado no los activa por si
// solos. Sin esto las secciones solo se alcanzan con el mouse. El selector
// cubre los seis items del menu, que llevan todos role="button".
document.querySelectorAll('.nav-item[role="button"]').forEach(item => {
  item.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      item.click();
    }
  });
});

/* ===========================================================================
 * Paso 2: eleccion de archivos y subida secuencial de las pistas.
 * ========================================================================= */

/**
 * Cuanto se espera antes de avisar "sigo subiendo".
 *
 * A11y.anunciar() hace speechSynthesis.cancel(): un "subiendo la pista 3"
 * disparado siempre le pisaria la voz al resultado de la pista 3 en las
 * subidas rapidas, y el resultado es el unico dato que importa (si entro o
 * no). Con la demora, el aviso solo se emite cuando la subida de verdad
 * tarda, que es cuando el silencio se confundiria con un cuelgue.
 */
const DEMORA_AVISO_MS = 2000;

/**
 * A partir de cuantos archivos se deja de leer la lista completa.
 *
 * Leer 50 nombres seguidos es inescuchable y el usuario no puede rebobinar la
 * voz. Arriba de este numero se anuncian el conteo y las dos puntas, y la
 * lista entera queda en un <ol> que si se puede recorrer item por item con el
 * lector de pantalla.
 */
const MAX_NOMBRES_HABLADOS = 8;

let archivosElegidos = [];
// Los <span> de estado de cada fila del <ol>, en el mismo orden que archivosElegidos
let filasPistas = [];

/**
 * Un anuncio = un estado. Escribe el mismo texto en `#estado-carga` (espejo
 * visible y ancla de foco) y lo manda por el unico canal de voz que tiene el
 * panel.
 *
 * `#estado-carga` NO lleva aria-live a proposito: la live region de A11y ya
 * es aria-live="assertive", y dos regiones vivas con el mismo texto harian
 * que el lector de pantalla lea todo dos veces.
 */
function anunciarEstado(texto) {
  const estado = document.getElementById('estado-carga');
  // textContent: parte del texto lo redacta el servidor y no viene escapado
  if (estado) estado.textContent = texto;
  A11y.anunciar(texto);
}

/**
 * Deja el copy del servidor con exactamente un punto final.
 *
 * Los mensajes del backend no son uniformes: unos terminan en punto y otros
 * no. Encadenar `${mensaje}. ` a mano deja ".." cuando ya lo traia, y el
 * sintetizador de voz lo lee como una pausa larga en mitad de la frase.
 */
function conPunto(texto) {
  return `${String(texto || '').trim().replace(/\.+$/, '')}.`;
}

/**
 * Programa un anuncio que se cancela si la respuesta llega antes.
 * Devuelve el cancelador.
 */
function avisoDemorado(texto) {
  const t = setTimeout(() => anunciarEstado(texto), DEMORA_AVISO_MS);
  return () => clearTimeout(t);
}

/**
 * Orden de reproduccion real: comparacion ordinal del nombre, que es como
 * Azure lista los blobs de la carpeta del libro y como server.py arma el
 * explorador (Python compara strings por code point).
 *
 * localeCompare() NO sirve aca: agrupa mayusculas con minusculas y pliega
 * acentos, asi que "Intro.mp3" y "capitulo1.mp3" le saldrian al reves de como
 * van a sonar. Esta pantalla existe justamente para prometer el orden real;
 * prometer uno distinto es peor que no prometer nada, porque no hay tabla de
 * capitulos y el error recien se descubre escuchando el libro.
 */
function compararOrdinal(a, b) {
  if (a.name < b.name) return -1;
  return a.name > b.name ? 1 : 0;
}

/**
 * Detecta los dos modos en que el orden sale mal. Los dos son irreversibles
 * sin volver a subir todo, asi que se avisan ANTES de subir. Devuelve '' si
 * no hay nada que advertir.
 */
function revisarOrden(nombres) {
  const porLocale = nombres.slice().sort((a, b) => a.localeCompare(b, 'es'));
  const porNumero = nombres.slice().sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const difiereDeLocale = porLocale.some((n, i) => n !== nombres[i]);

  // Numeros sin ceros adelante: "10" ordena antes que "2". Solo se acusa
  // cuando el orden ordinal y el alfabetico coinciden; si ya difieren, la
  // culpa es de mayusculas o acentos y el mensaje de numeros seria falso.
  if (!difiereDeLocale) {
    const i = porNumero.findIndex((n, k) => n !== nombres[k]);
    if (i !== -1) {
      return 'Atención: los números de los nombres no tienen la misma cantidad de dígitos, '
        + `así que el orden no va a ser el que esperás: ${nombres[i]} se va a escuchar `
        + `antes que ${porNumero[i]}. Conviene renombrarlos con ceros adelante, `
        + 'por ejemplo 01, 02, 10.';
    }
  }

  const sinNumero = nombres.filter(n => !/^\d/.test(n));
  if (sinNumero.length) {
    const cuantos = sinNumero.length === nombres.length
      ? 'los nombres no empiezan'
      : `${sinNumero.length} de los nombres no empiezan`;
    return `Atención: ${cuantos} con número, así que se ordenan alfabéticamente. `
      + 'Ese es el orden en que se van a escuchar: si no es el correcto, '
      + 'elegí otros archivos antes de subir.';
  }

  return '';
}

/** Redibuja el <ol> de pistas y devuelve los <span> de estado de cada fila. */
function dibujarLista(archivos) {
  const lista = document.getElementById('lista-pistas');
  const titulo = document.getElementById('titulo-lista-pistas');
  lista.textContent = '';
  titulo.hidden = archivos.length === 0;

  return archivos.map(f => {
    const li = document.createElement('li');
    const nombre = document.createElement('span');
    // textContent: el nombre lo eligio el usuario y despues viaja al servidor
    nombre.textContent = f.name;
    const estado = document.createElement('span');
    estado.textContent = ' — sin subir';
    li.append(nombre, estado);
    lista.appendChild(li);
    return estado;
  });
}

/**
 * `mensajeServidor` es el copy que redacta el backend al crear el libro. Va
 * en el MISMO A11y.anunciar() que la consigna del paso 2: anunciar() cancela
 * el anuncio anterior, asi que dos llamadas encadenadas dejarian mudo al
 * primero en los dos canales (voz y live region).
 */
function mostrarPasoArchivos(mensajeServidor) {
  const cont = document.getElementById('paso-archivos');
  if (!cont) return;
  const nombreLibro = (libroActual && libroActual.nombre) || 'el libro';

  archivosElegidos = [];
  filasPistas = [];

  cont.hidden = false;
  cont.className = 'governance-card';
  cont.textContent = '';

  const titulo = document.createElement('h3');
  // textContent: el nombre sale de la base y no viene escapado
  titulo.textContent = `Paso 2: archivos de audio de ${nombreLibro}`;

  const ayuda = document.createElement('p');
  ayuda.id = 'ayuda-archivos';
  ayuda.textContent = 'Las pistas se escuchan en el orden de sus nombres. Para que el '
    + 'orden salga bien conviene numerarlas con la misma cantidad de dígitos: 01, 02, 10.';

  const etiqueta = document.createElement('label');
  etiqueta.htmlFor = 'campo-archivos';
  etiqueta.textContent = 'Elegí los archivos MP3 del libro';

  const campo = document.createElement('input');
  campo.type = 'file';
  campo.id = 'campo-archivos';
  campo.accept = '.mp3,audio/mpeg';
  campo.multiple = true;
  campo.className = 'search-input';
  campo.setAttribute('aria-describedby', 'ayuda-archivos');
  campo.addEventListener('change', revisarArchivos);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-subir';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Subir pistas';
  // Recien aparece con archivos elegidos: un boton que no haria nada es una
  // parada muerta al tabular.
  btn.hidden = true;
  btn.addEventListener('click', subirTodo);

  const estado = document.createElement('p');
  estado.id = 'estado-carga';
  // tabindex -1: durante la subida el boton esta deshabilitado y un elemento
  // deshabilitado no puede tener el foco. Sin este ancla el foco se caeria al
  // body y el operador no vidente perderia el punto de referencia.
  estado.tabIndex = -1;

  const zonaReintento = document.createElement('div');
  zonaReintento.id = 'zona-reintento';
  zonaReintento.hidden = true;

  const tituloLista = document.createElement('h4');
  tituloLista.id = 'titulo-lista-pistas';
  tituloLista.textContent = 'Orden de subida';
  tituloLista.hidden = true;

  // <ol> y no <ul>: la numeracion ES el orden de reproduccion. Sin aria-live,
  // por lo mismo que `#estado-carga`: la voz sale por un solo canal.
  const lista = document.createElement('ol');
  lista.id = 'lista-pistas';
  lista.setAttribute('aria-labelledby', 'titulo-lista-pistas');

  cont.append(titulo, ayuda, etiqueta, campo, btn, estado, zonaReintento, tituloLista, lista);

  anunciarEstado(`${conPunto(mensajeServidor || 'Libro creado')} Paso 2: elegí los archivos MP3. `
    + 'Se van a escuchar en el orden de sus nombres. '
    + 'Estás parado en el selector de archivos.');

  campo.focus();
}

function revisarArchivos(ev) {
  const btn = document.getElementById('btn-subir');
  const crudos = Array.from(ev.target.files || []);

  const descartar = (motivo) => {
    archivosElegidos = [];
    filasPistas = dibujarLista([]);
    btn.hidden = true;
    A11y.earcon('error');
    anunciarEstado(motivo);
    ev.target.focus();
  };

  // Cancelar el dialogo no dispara change en la mayoria de los navegadores,
  // pero cuando lo dispara llega vacio. Sin este aviso el usuario se quedaria
  // en silencio, sin saber si eligio algo o no.
  if (!crudos.length) {
    descartar('No elegiste ningún archivo. Volvé a abrir el selector para elegir los MP3.');
    return;
  }

  // `accept` es solo una sugerencia del dialogo del sistema: el usuario puede
  // forzar otro tipo. Se filtra aca y no en el servidor para no gastar una
  // subida entera en un archivo que igual va a terminar rechazado.
  const rechazados = [];
  const aceptados = [];
  crudos.forEach(f => {
    if (!f.name.toLowerCase().endsWith('.mp3')) rechazados.push(`${f.name}, no es MP3`);
    else if (!f.size) rechazados.push(`${f.name}, está vacío`);
    else aceptados.push(f);
  });

  if (!aceptados.length) {
    descartar(`Ninguno de los ${crudos.length} archivos sirve: ${rechazados.join('; ')}. `
      + 'Elegí archivos MP3 que no estén vacíos.');
    return;
  }

  archivosElegidos = aceptados.sort(compararOrdinal);
  filasPistas = dibujarLista(archivosElegidos);

  const nombres = archivosElegidos.map(f => f.name);
  const partes = [];

  if (nombres.length === 1) {
    partes.push(`1 archivo: ${nombres[0]}.`);
  } else if (nombres.length <= MAX_NOMBRES_HABLADOS) {
    partes.push(`${nombres.length} archivos, en este orden: ${nombres.join(', ')}.`);
  } else {
    partes.push(`${nombres.length} archivos, empezando por ${nombres[0]} y terminando `
      + `por ${nombres[nombres.length - 1]}. La lista completa, en orden, está `
      + 'en pantalla debajo del selector.');
  }

  if (rechazados.length) {
    partes.push(`Dejé afuera ${rechazados.length}: ${rechazados.join('; ')}.`);
  }

  const avisoOrden = revisarOrden(nombres);
  if (avisoOrden) partes.push(avisoOrden);

  partes.push('Cuando estés listo, presioná el botón subir pistas.');

  // El earcon distingue "listo" de "mirá esto" antes de que arranque la voz
  A11y.earcon((avisoOrden || rechazados.length) ? 'error' : 'accion');
  anunciarEstado(partes.join(' '));
  btn.hidden = false;
  btn.disabled = false;
  btn.focus();
}

async function subirUna(file, nombreLibro) {
  const url = `/api/admin/subir-pista?nombre=${encodeURIComponent(nombreLibro)}`
    + `&archivo=${encodeURIComponent(file.name)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Admin-Token': window.ADMIN_TOKEN || '',
    },
    // El File va crudo como body: el endpoint no espera FormData
    body: file,
  });
  // Un 500 puede volver sin JSON valido: sin este catch el .json() tira y el
  // usuario escucharia "error de conexion" con el servidor respondiendo.
  const d = await r.json().catch(() => ({}));
  return {
    ok: r.ok && d.ok !== false,
    // 200 con skipped:true no es un error, pero tampoco es una subida
    salteada: d.skipped === true,
    mensaje: d.mensaje || (r.ok
      ? `Pista ${file.name} subida`
      : `No se pudo subir la pista ${file.name}`),
  };
}

/** Resumen honesto: separa lo que entro ahora de lo que ya estaba. */
function resumenPistas(nuevas, salteadas) {
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (!nuevas && !salteadas) return 'No entró ninguna pista.';
  if (nuevas && salteadas) {
    return `Se ${nuevas === 1 ? 'subió' : 'subieron'} ${plural(nuevas, 'pista nueva', 'pistas nuevas')}; `
      + `${plural(salteadas, 'pista ya estaba subida', 'pistas ya estaban subidas')}.`;
  }
  if (salteadas) {
    return `${plural(salteadas, 'pista ya estaba subida', 'pistas ya estaban subidas')}, `
      + 'no hizo falta subir nada.';
  }
  return `Se ${nuevas === 1 ? 'subió' : 'subieron'} ${plural(nuevas, 'pista nueva', 'pistas nuevas')}.`;
}

/**
 * Ofrece reintentar o cancelar tras un error, y resuelve con la eleccion.
 *
 * Los controles se crean sin id y la zona se vacia de entrada: con ids fijos,
 * dos pistas fallidas dejarian dos "btn-reintentar" en el documento y
 * querySelector devolveria siempre el primero, que ya esta muerto.
 */
function ofrecerReintento(mensaje, indice, total) {
  return new Promise((resolve) => {
    const zona = document.getElementById('zona-reintento');
    zona.textContent = '';
    zona.hidden = false;

    const grupo = document.createElement('div');
    // role=group con nombre: el lector de pantalla anuncia a que pista
    // pertenecen los dos botones al entrar en ellos.
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', `Error en la pista ${indice} de ${total}`);

    const texto = document.createElement('p');
    // textContent: el mensaje lo redacta el servidor, no se interpola en HTML
    texto.textContent = mensaje;

    const btnR = document.createElement('button');
    btnR.type = 'button';
    btnR.className = 'btn btn-primary';
    btnR.textContent = `Reintentar la pista ${indice}`;

    const btnC = document.createElement('button');
    btnC.type = 'button';
    btnC.className = 'btn btn-secondary';
    btnC.textContent = 'Cancelar la carga';

    grupo.append(texto, btnR, btnC);
    zona.appendChild(grupo);

    const cerrar = (valor) => {
      zona.textContent = '';
      zona.hidden = true;
      resolve(valor);
    };
    btnR.addEventListener('click', () => cerrar(true));
    btnC.addEventListener('click', () => cerrar(false));

    anunciarEstado(`${conPunto(mensaje)} Pista ${indice} de ${total}. Estás parado en el botón `
      + 'reintentar: presioná Enter para volver a intentarla, o tabulá una vez '
      + 'para llegar a cancelar la carga.');
    // El foco al boton de reintento: sin esto, quien no ve la pantalla queda
    // sin ningun control al que volver y la carga se le muere ahi.
    btnR.focus();
  });
}

async function subirTodo() {
  const btn = document.getElementById('btn-subir');
  const campo = document.getElementById('campo-archivos');
  const estado = document.getElementById('estado-carga');
  const btnCrear = document.getElementById('btn-crear-libro');
  const total = archivosElegidos.length;
  if (!total) return;

  // El nombre se fija al arrancar y no se vuelve a leer de `libroActual`: si
  // se leyera en cada pista, crear otro libro a mitad de la carga mandaria las
  // pistas que faltan a la carpeta del libro nuevo, y en Azure eso no se
  // deshace desde el panel.
  const nombreLibro = libroActual.nombre;

  A11y.earcon('accion');
  anunciarEstado(`Subiendo ${total} ${total === 1 ? 'pista' : 'pistas'}.`);
  // El foco se mueve ANTES de deshabilitar: un elemento deshabilitado no puede
  // tener el foco y el navegador lo manda al body.
  estado.focus();
  btn.disabled = true;
  // Tambien el selector: cambiar de archivos a mitad de la carga dejaria
  // `filasPistas` apuntando a un <ol> que ya no corresponde.
  campo.disabled = true;
  // Y el alta de libros: crear otro reconstruiria este mismo paso 2 debajo de
  // los pies de la carga en curso.
  if (btnCrear) btnCrear.disabled = true;

  let nuevas = 0;
  let salteadas = 0;
  let ultimoMensaje = '';

  // Secuencial a proposito, nunca en paralelo: los anuncios de voz se pisarian
  // entre si y el operador perderia el hilo de que pista entro y cual no.
  for (let i = 0; i < total; i++) {
    const file = archivosElegidos[i];
    const fila = filasPistas[i];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (fila) fila.textContent = ' — subiendo';
      const cancelarAviso = avisoDemorado(
        `Sigo subiendo la pista ${i + 1} de ${total}, ${file.name}.`);

      let r;
      try {
        r = await subirUna(file, nombreLibro);
      } catch (e) {
        r = { ok: false, salteada: false, mensaje: `Se cortó la conexión subiendo ${file.name}` };
      } finally {
        cancelarAviso();
      }

      if (r.ok) {
        if (r.salteada) salteadas++;
        else nuevas++;
        // Earcons distintos: la pista que ya estaba suena diferente de la que
        // acaba de entrar, sin esperar a que termine la frase.
        A11y.earcon(r.salteada ? 'accion' : 'exito');
        if (fila) fila.textContent = r.salteada ? ' — ya estaba subida' : ' — subida';
        ultimoMensaje = r.mensaje;
        // La ultima no se anuncia sola: el resumen sale inmediatamente despues
        // y le pisaria la voz. Viaja adentro del resumen, en un anuncio unico.
        if (i < total - 1) {
          anunciarEstado(`${conPunto(r.mensaje)} Van ${nuevas + salteadas} de ${total}.`);
        }
        break;
      }

      if (fila) fila.textContent = ' — con error';
      A11y.earcon('error');
      if (await ofrecerReintento(r.mensaje, i + 1, total)) {
        // Anuncio corto y confirmatorio: los botones de reintento se acaban de
        // borrar, y sin esto el ancla de foco seguiria diciendo el error, como
        // si el reintento hubiera fallado de nuevo.
        A11y.earcon('accion');
        anunciarEstado(`Reintentando la pista ${i + 1} de ${total}.`);
        // El ancla de estado es lo unico enfocable mientras el boton de subir
        // sigue deshabilitado.
        estado.focus();
        continue;
      }

      const pendientes = total - (nuevas + salteadas);
      A11y.earcon('error');
      campo.disabled = false;
      btn.disabled = false;
      if (btnCrear) btnCrear.disabled = false;
      anunciarEstado(`Carga interrumpida. ${resumenPistas(nuevas, salteadas)} `
        + `${pendientes === 1 ? 'Queda 1 pista' : `Quedan ${pendientes} pistas`} sin subir. `
        + 'Si volvés a presionar subir pistas se retoma: las que ya están no se '
        + 'vuelven a subir. Estás parado en el botón subir pistas.');
      btn.focus();
      return;
    }
  }

  campo.disabled = false;
  btn.disabled = false;
  if (btnCrear) btnCrear.disabled = false;
  A11y.earcon('exito');
  anunciarEstado(`${conPunto(ultimoMensaje)} Carga completa de ${nombreLibro}. `
    + `${resumenPistas(nuevas, salteadas)} `
    + 'Si te falta alguna pista podés elegir más archivos: estás parado en el selector.');
  campo.focus();
}

cargarCategorias();
