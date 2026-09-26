/**
 * Ayudas al usuario portadas del mockup accesible (spec 001 R41), corregidas
 * por el spec 002 (Historia 10): atajos con guardas, foco que nunca queda en
 * la nada, dictado que no se escucha a sí mismo y atajos del reproductor.
 * La tabla de atajos sale de A11yLogica.ATAJOS (fuente única, R39).
 * Depende de A11y, A11yLogica, Dictado y de switchTab / filterBooks /
 * closeAudioPlayer / Reproductor (index.html).
 */
const Ayuda = (() => {
  const L = window.A11yLogica;
  const SALTO_SEGUNDOS = 15;
  let focoAntesDeAyuda = null;
  let dictado = null;

  // --- Estado del foco -------------------------------------------------------

  function escribiendo() {
    const el = document.activeElement;
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
  }

  function sobreControl() {
    // Espacio activa botones y enlaces enfocados: ahí no se secuestra.
    const el = document.activeElement;
    return el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button');
  }

  // Tabla desplazable o región con foco: las flechas y el espacio la mueven.
  function enRegionDesplazable() {
    const el = document.activeElement;
    return !!(el && el.matches && el.matches('[role="region"][tabindex], .table-container'));
  }

  // --- Ventana de ayuda ------------------------------------------------------

  function pintarTablaAyuda() {
    const cuerpo = document.getElementById('ayuda-cuerpo');
    if (!cuerpo || cuerpo.childElementCount) return;
    for (const a of L.ATAJOS) {
      const tr = document.createElement('tr');
      const tecla = document.createElement('td');
      a.etiqueta.forEach((parte) => {
        if (['a', 'o', '/'].includes(parte)) {
          tecla.append(` ${parte} `);
        } else {
          const kbd = document.createElement('kbd');
          kbd.textContent = parte;
          tecla.append(kbd);
        }
      });
      if (a.reproductor) tecla.append(' (con reproductor abierto)');
      const accion = document.createElement('td');
      accion.textContent = a.accion;
      tr.append(tecla, accion);
      cuerpo.append(tr);
    }
  }

  function abrirAyuda() {
    const dialogo = document.getElementById('ayuda-atajos');
    if (!dialogo || dialogo.open) return;
    focoAntesDeAyuda = document.activeElement;
    pintarTablaAyuda();
    dialogo.showModal();  // modal nativo: atrapa el foco y cierra con Esc
    dialogo.querySelector('button').focus();
    A11y.earcon('accion');
    A11y.anunciar(`Ventana de atajos abierta. ${L.resumenAtajos()}`);
  }

  function cerrarAyuda() {
    const dialogo = document.getElementById('ayuda-atajos');
    if (dialogo && dialogo.open) dialogo.close();
  }

  // El modal nativo deja salir el foco hacia la interfaz del navegador (en
  // la prueba del 26/09 quedaba en <body>): Tab y Shift+Tab giran adentro.
  function retenerFoco(e) {
    if (e.key !== 'Tab') return;
    const dialogo = e.currentTarget;
    const enfocables = [...dialogo.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!enfocables.length) return;
    const primero = enfocables[0], ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  function alCerrarAyuda() {
    const destino = focoAntesDeAyuda && document.contains(focoAntesDeAyuda) && focoAntesDeAyuda.offsetParent !== null
      ? focoAntesDeAyuda : document.getElementById('contenido-principal');
    destino.focus();
    focoAntesDeAyuda = null;
    A11y.anunciar('Ventana de ayuda cerrada.');
  }

  // --- Buscador y dictado ----------------------------------------------------

  function irAlBuscador() {
    switchTab('books', { anunciar: false });
    const campo = document.getElementById('book-search');
    campo.focus();
    A11y.earcon('foco');
    A11y.anunciar('Buscador de audios. Escribí un título o usá el botón Dictar.');
  }

  function pintarBotonDictado(estado) {
    const boton = document.getElementById('btn-dictado');
    const texto = document.getElementById('btn-dictado-texto');
    if (!boton || !texto) return;
    const activo = estado !== 'inactivo';
    boton.classList.toggle('grabando', estado === 'escuchando');
    boton.setAttribute('aria-pressed', String(activo));
    texto.textContent = activo ? 'Detener dictado' : 'Dictar';
    if (estado === 'escuchando') A11y.earcon('voz');
  }

  function dictar() {
    if (!dictado) {
      dictado = Dictado.crearDictado({
        Reconocimiento: window.SpeechRecognition || window.webkitSpeechRecognition || null,
        vozActiva: A11y.vozActiva,
        anunciar: (texto, op) => {
          if (op && op.urgente) A11y.earcon('error');
          A11y.anunciar(texto, op);
        },
        alEstado: pintarBotonDictado,
        alResultado: async (texto) => {
          const campo = document.getElementById('book-search');
          campo.value = texto;
          const cantidad = await filterBooks({ anunciar: false });
          A11y.earcon('exito');
          A11y.anunciar(`Entendido: ${texto}. ${cantidad === 1 ? '1 audiolibro encontrado' : `${cantidad} audiolibros encontrados`}.`);
        },
      });
    }
    dictado.alternar();
  }

  // --- Reproductor -----------------------------------------------------------

  function reproductor() {
    const barra = document.getElementById('audio-player-bar');
    const audio = document.getElementById('global-audio-player');
    return barra && !barra.hidden && audio && audio.getAttribute('src') ? audio : null;
  }

  async function alternarPausa(audio) {
    if (audio.paused) {
      try {
        await audio.play();
        A11y.anunciar('Reproduciendo.');
      } catch (e) {
        A11y.earcon('error');
        A11y.anunciar('No se pudo reproducir el audio.', { urgente: true });
      }
    } else {
      audio.pause();
      A11y.anunciar('Pausado.');
    }
  }

  function cambiarVolumen(audio, direccion) {
    const nuevo = L.siguienteVolumen(audio.volume, direccion);
    const limite = nuevo === audio.volume;
    audio.volume = nuevo;
    if (audio.muted && direccion > 0) audio.muted = false;
    const pct = Math.round(nuevo * 100);
    A11y.earcon(limite ? 'error' : 'accion');
    A11y.anunciar(limite ? `Volumen al ${direccion > 0 ? 'máximo' : 'mínimo'}, ${pct} %.` : `Volumen ${pct} %.`);
  }

  function alternarSilencio(audio) {
    audio.muted = !audio.muted;
    A11y.earcon('accion');
    A11y.anunciar(audio.muted ? 'Silenciado.' : `Sonido restaurado, volumen ${Math.round(audio.volume * 100)} %.`);
  }

  // --- Teclado ---------------------------------------------------------------

  function alPresionar(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;  // no pisar atajos del navegador
    if (document.getElementById('ayuda-atajos')?.open) return;  // el modal nativo maneja Esc y Tab
    if (e.repeat) return;  // una tecla mantenida no dispara diez cambios de sección
    if (escribiendo()) return;  // incluido Esc: cierra el autocompletado, no el reproductor
    const el = document.activeElement;
    if (el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO')) return;  // controles nativos
    if (el && el.closest && el.closest('dialog')) return;

    const atajo = L.atajoDeTecla(e.key);
    if (!atajo) return;
    const audio = reproductor();
    if (atajo.reproductor && !audio) return;  // sin reproductor la tecla hace lo de siempre
    if ((atajo.id === 'pausa' || atajo.id === 'saltar' || atajo.id === 'volumen') && enRegionDesplazable()) return;
    if (atajo.id === 'pausa' && sobreControl()) return;

    switch (atajo.id) {
      case 'secciones': {
        e.preventDefault();
        const seccion = L.SECCIONES.find((s) => s.tecla === e.key);
        if (seccion) switchTab(seccion.id);
        break;
      }
      case 'buscar':
        e.preventDefault();
        irAlBuscador();
        break;
      case 'ayuda':
        e.preventDefault();
        abrirAyuda();
        break;
      case 'cerrar':
        if (audio) {
          e.preventDefault();
          closeAudioPlayer();
          A11y.anunciar('Reproductor cerrado.');
        }
        break;
      case 'pausa':
        e.preventDefault();
        alternarPausa(audio);
        break;
      case 'saltar': {
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? SALTO_SEGUNDOS : -SALTO_SEGUNDOS;
        audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + delta));
        A11y.earcon('accion');
        A11y.anunciar(delta > 0 ? 'Adelantado 15 segundos.' : 'Retrocedido 15 segundos.');
        break;
      }
      case 'volumen':
        e.preventDefault();
        cambiarVolumen(audio, e.key === 'ArrowUp' ? 1 : -1);
        break;
      case 'pista':
        e.preventDefault();
        Reproductor.vecina(e.key.toLowerCase() === 'n' ? 1 : -1);
        break;
      case 'silencio':
        e.preventDefault();
        alternarSilencio(audio);
        break;
      default:
        break;
    }
  }

  // Clic sutil al pasar el foco por un control (sonificación del mockup).
  // A11y.earcon ya respeta el interruptor de señales de audio.
  function alEnfocar(e) {
    const el = e.target;
    if (el.matches && el.matches('button, a[href], input, select, textarea, [role="button"], summary')) {
      A11y.earcon('foco');
    }
  }

  function iniciar() {
    document.addEventListener('keydown', alPresionar);
    document.addEventListener('focusin', alEnfocar);
    document.getElementById('ayuda-atajos')?.addEventListener('close', alCerrarAyuda);
    document.getElementById('ayuda-atajos')?.addEventListener('keydown', retenerFoco);
    pintarTablaAyuda();
    // Bienvenida por el canal cortés: no interrumpe al lector de pantalla.
    setTimeout(() => {
      let texto = 'Panel operativo de Invision. Presioná H o signo de pregunta para escuchar los atajos de teclado.';
      if (A11y.esPrimerUso() && A11y.vozActiva()) {
        texto += ' La lectura en voz está encendida. Si usás lector de pantalla, apagala con el botón Lectura en voz de la barra superior.';
      }
      A11y.anunciar(texto);
    }, 1000);
  }

  return { iniciar, abrirAyuda, cerrarAyuda, dictar, irAlBuscador };
})();
