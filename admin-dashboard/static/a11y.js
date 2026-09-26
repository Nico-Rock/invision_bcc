/**
 * Primitivas de accesibilidad del panel: preferencias, avisos, voz y earcons.
 * Portado de frontend/src/context/AudioContext.jsx (ver docs/specs/10-accesibilidad.md)
 * y ajustado al spec 002: dos canales de aviso (R4, R5, R38), texto como
 * proporción del navegador (R1) y voz propia opcional (R28).
 * Depende de A11yLogica (a11y-logica.js), que se carga en <head>.
 */
const A11y = (() => {
  const L = window.A11yLogica;
  let ctx = null;
  let prefs = { ...L.PREFS_POR_DEFECTO };
  let primerUso = true;
  let avisoSinStorage = false;
  const TOPE_CORTES = 5;

  function guardar() {
    try {
      localStorage.setItem(L.CLAVE, JSON.stringify(prefs));
    } catch (e) {
      if (!avisoSinStorage) {
        avisoSinStorage = true;
        anunciar('Tus preferencias valen solo para esta sesión: el navegador no permite guardarlas.');
      }
    }
  }

  // Misma validación que aplicarTemprano (R37): acota, redondea y nunca lanza.
  function cargar() {
    try {
      const crudo = localStorage.getItem(L.CLAVE);
      primerUso = crudo === null;
      prefs = L.validarPrefs(crudo);
    } catch (e) {
      prefs = { ...L.PREFS_POR_DEFECTO };
    }
  }

  function marcar(id, activo) {
    const boton = document.getElementById(id);
    if (boton) boton.setAttribute('aria-pressed', String(activo));
  }

  function aplicar() {
    const html = document.documentElement;
    html.style.setProperty('--font-factor', String(L.factorTexto(prefs.texto)));
    html.classList.toggle('texto-amplio', L.textoAmplio(prefs.texto));
    html.classList.toggle('high-contrast', prefs.contraste);
    // Texto fijo + aria-pressed (D17): el nombre accesible es siempre lo que se ve.
    marcar('a11y-btn-contraste', prefs.contraste);
    marcar('a11y-btn-senales', prefs.senales);
    marcar('a11y-btn-voz', prefs.voz);
  }

  const porcentaje = () => `${Math.round(L.factorTexto(prefs.texto) * 100)} %`;

  function ajustarTexto(direccion) {
    const siguiente = L.siguienteTexto(prefs.texto, direccion);
    if (siguiente === prefs.texto) {
      earcon('error');
      anunciar(`El texto ya está al ${direccion > 0 ? 'máximo' : 'mínimo'}, ${porcentaje()}.`);
      return;
    }
    prefs.texto = siguiente;
    aplicar(); guardar();
    earcon('accion');
    anunciar(`Texto al ${porcentaje()}.`);
  }

  function alternarContraste() {
    prefs.contraste = !prefs.contraste;
    aplicar(); guardar();
    earcon('exito');
    anunciar(prefs.contraste
      ? 'Alto contraste activado: fondo negro, texto blanco y amarillo.'
      : 'Alto contraste desactivado: modo estándar.');
  }

  function alternarSenales() {
    prefs.senales = !prefs.senales;
    aplicar(); guardar();
    if (prefs.senales) earcon('exito');
    anunciar(prefs.senales ? 'Señales de audio activadas.' : 'Señales de audio desactivadas.');
  }

  function alternarVoz() {
    prefs.voz = !prefs.voz;
    if (!prefs.voz) cancelarVoz();
    aplicar(); guardar();
    earcon('accion');
    anunciar(prefs.voz
      ? 'Lectura en voz activada: el panel lee sus avisos en voz alta.'
      : 'Lectura en voz desactivada. Los avisos siguen llegando a tu lector de pantalla.');
  }

  function iniciar() {
    cargar();
    aplicar();
  }

  // Frecuencias y formas de onda del spec de accesibilidad (seccion 2.3)
  const EARCONS = {
    exito:  { freqs: [440, 880], onda: 'triangle', dur: 0.18 },
    error:  { freqs: [180],      onda: 'sawtooth', dur: 0.30 },
    accion: { freqs: [659.25],   onda: 'sine',     dur: 0.10 },
    // Del mockup accesible (R41 de 001): clic sutil de foco y aviso de dictado
    foco:   { freqs: [523.25],   onda: 'sine',     dur: 0.08 },
    voz:    { freqs: [880],      onda: 'sine',     dur: 0.15 },
  };

  function earcon(tipo) {
    const cfg = EARCONS[tipo];
    if (!cfg || !prefs.senales) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      // El navegador crea el contexto suspendido hasta que hay un gesto del
      // usuario. Sin este resume el primer earcon del panel no suena nunca.
      if (ctx.state === 'suspended') ctx.resume();
      cfg.freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = cfg.onda;
        osc.frequency.value = freq;
        const inicio = ctx.currentTime + i * cfg.dur;
        // La envolvente arranca en `inicio`, no en currentTime: si no, la
        // segunda nota del earcon de exito suena cuando el gain ya decayo a 0.
        gain.gain.setValueAtTime(0.08, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + cfg.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + cfg.dur);
      });
    } catch (e) {
      // Sin Web Audio el flujo sigue: las regiones vivas son el canal principal
    }
  }

  function cancelarVoz() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* sin TTS */ }
  }

  // Voz propia, solo con "Lectura en voz" encendida (R28). Los corteses se
  // encolan; los urgentes cortan lo que se estaba diciendo.
  function hablar(texto, urgente, alTerminar) {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; if (alTerminar) alTerminar(); } };
    if (!prefs.voz || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      fin();
      return;
    }
    try {
      if (urgente) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-ES';
      u.onend = fin;
      u.onerror = fin;
      window.speechSynthesis.speak(u);
      // Algunos navegadores nunca disparan onend: resguardo proporcional al largo.
      if (alTerminar) setTimeout(fin, 2000 + texto.length * 90);
    } catch (e) {
      fin();
    }
  }

  /**
   * Dos canales (D6). Cortés: se agrega un <p> a #a11y-cortes (los avisos se
   * suceden sin cortarse, tope de 5). Urgente: reemplaza #a11y-urgente y vacía
   * la cortés; solo para errores, validaciones y bloqueos.
   */
  function anunciar(texto, { urgente = false, alTerminar = null } = {}) {
    const cortes = document.getElementById('a11y-cortes');
    const urgenteRegion = document.getElementById('a11y-urgente');
    if (urgente && urgenteRegion) {
      if (cortes) cortes.replaceChildren();
      urgenteRegion.textContent = '';
      // El reset fuerza a los lectores a releer un texto repetido
      setTimeout(() => { urgenteRegion.textContent = texto; }, 50);
    } else if (cortes) {
      const p = document.createElement('p');
      p.textContent = texto;
      cortes.appendChild(p);
      while (cortes.childElementCount > TOPE_CORTES) cortes.firstElementChild.remove();
    }
    hablar(texto, urgente, alTerminar);
  }

  return {
    anunciar, earcon, iniciar, ajustarTexto, alternarContraste, alternarSenales, alternarVoz,
    vozActiva: () => prefs.voz, esPrimerUso: () => primerUso,
  };
})();
