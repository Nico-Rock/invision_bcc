/**
 * Ayudas al usuario portadas del mockup accesible (mockup_accessible.html), spec 001 R41:
 * atajos de teclado, ventana de ayuda, sonido de foco, bienvenida y dictado por voz.
 * Depende de A11y (a11y.js) y de switchTab / filterBooks / closeAudioPlayer (index.html).
 */
const Ayuda = (() => {
  // Orden = tecla numérica. Mismo orden que la barra lateral.
  const SECCIONES = [
    ['overview', 'Resumen ejecutivo'],
    ['logs', 'Registros de acceso'],
    ['books', 'Explorador de audios'],
    ['users', 'Usuarios y soporte'],
    ['governance', 'Gobernanza y reglas'],
    ['carga', 'Cargar audiolibro'],
  ];
  const SALTO_SEGUNDOS = 15;
  const RESUMEN_ATAJOS =
    'Atajos disponibles: 1 a 6 para cambiar de sección, S para buscar audios, ' +
    'Espacio para pausar, flechas para retroceder o adelantar 15 segundos, ' +
    'y Escape para cerrar. Presiona H o signo de pregunta para repetir esta ayuda.';

  let focoAntesDeAyuda = null;

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

  function reproductor() {
    const barra = document.getElementById('audio-player-bar');
    const audio = document.getElementById('global-audio-player');
    const visible = barra && getComputedStyle(barra).display !== 'none';
    return visible && audio && audio.src ? audio : null;
  }

  // --- Ventana de ayuda ------------------------------------------------------

  function abrirAyuda() {
    const dialogo = document.getElementById('ayuda-atajos');
    if (!dialogo || dialogo.open) return;
    focoAntesDeAyuda = document.activeElement;
    dialogo.showModal();  // modal nativo: atrapa el foco y cierra con Esc
    dialogo.querySelector('button').focus();
    A11y.earcon('accion');
    A11y.anunciar(`Ventana de atajos abierta. ${RESUMEN_ATAJOS}`);
  }

  function cerrarAyuda() {
    const dialogo = document.getElementById('ayuda-atajos');
    if (!dialogo || !dialogo.open) return;
    dialogo.close();
  }

  function alCerrarAyuda() {
    if (focoAntesDeAyuda && document.contains(focoAntesDeAyuda)) focoAntesDeAyuda.focus();
    focoAntesDeAyuda = null;
    A11y.anunciar('Ventana de ayuda cerrada.');
  }

  // --- Buscador y dictado ----------------------------------------------------

  function irAlBuscador() {
    switchTab('books');
    const campo = document.getElementById('book-search');
    campo.focus();
    A11y.earcon('foco');
    A11y.anunciar('Buscador de audios enfocado. Escribe un título o usa el micrófono.');
  }

  function dictar() {
    const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Reconocimiento) {
      A11y.earcon('error');
      A11y.anunciar('El dictado por voz no está disponible en este navegador. Prueba con Google Chrome.');
      return;
    }
    const boton = document.getElementById('btn-dictado');
    const campo = document.getElementById('book-search');
    const rec = new Reconocimiento();
    rec.lang = 'es-ES';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    boton.classList.add('grabando');
    boton.setAttribute('aria-label', 'Escuchando. Dicta el título');
    A11y.earcon('voz');
    A11y.anunciar('Dicta tu búsqueda ahora.');

    const terminar = () => {
      boton.classList.remove('grabando');
      boton.setAttribute('aria-label', 'Buscar usando la voz');
    };
    rec.onresult = (evento) => {
      const texto = evento.results[0][0].transcript;
      campo.value = texto;
      filterBooks();
      A11y.earcon('exito');
      A11y.anunciar(`Entendido: ${texto}. Buscando.`);
    };
    rec.onerror = () => {
      A11y.earcon('error');
      A11y.anunciar('No logré entender el dictado. Intenta de nuevo.');
    };
    rec.onend = terminar;
    try {
      rec.start();
    } catch (e) {
      terminar();
      A11y.earcon('error');
      A11y.anunciar('No se pudo iniciar el micrófono.');
    }
  }

  // --- Teclado ---------------------------------------------------------------

  function alPresionar(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;  // no pisar atajos del navegador
    const dialogoAbierto = document.getElementById('ayuda-atajos')?.open;
    if (dialogoAbierto) return;  // el modal nativo maneja Esc y Tab

    if (e.key === 'Escape') {
      if (reproductor()) {
        closeAudioPlayer();
        A11y.anunciar('Reproductor cerrado.');
      }
      return;
    }
    if (escribiendo()) return;

    const tecla = e.key.toLowerCase();
    const numero = Number.parseInt(e.key, 10);

    if (numero >= 1 && numero <= SECCIONES.length) {
      e.preventDefault();
      switchTab(SECCIONES[numero - 1][0]);
    } else if (tecla === 's') {
      e.preventDefault();
      irAlBuscador();
    } else if (tecla === 'h' || e.key === '?') {
      e.preventDefault();
      abrirAyuda();
    } else if (e.key === ' ' && reproductor() && !sobreControl()) {
      e.preventDefault();
      const audio = reproductor();
      if (audio.paused) {
        audio.play();
        A11y.anunciar('Reproduciendo.');
      } else {
        audio.pause();
        A11y.anunciar('Pausado.');
      }
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && reproductor()) {
      e.preventDefault();
      const audio = reproductor();
      const delta = e.key === 'ArrowRight' ? SALTO_SEGUNDOS : -SALTO_SEGUNDOS;
      audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + delta));
      A11y.earcon('accion');
      A11y.anunciar(delta > 0 ? 'Adelantado 15 segundos.' : 'Retrocedido 15 segundos.');
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
    // Bienvenida: la región viva siempre la recibe; la voz puede esperar a un
    // gesto del usuario según el navegador.
    setTimeout(() => {
      A11y.anunciar('Panel operativo de Invision. Presiona H o el signo de pregunta para escuchar los atajos de teclado.');
    }, 1000);
  }

  return { iniciar, abrirAyuda, cerrarAyuda, dictar, irAlBuscador, SECCIONES };
})();
