/**
 * Primitivas de accesibilidad del panel: voz, earcons y live region.
 * Portado de frontend/src/context/AudioContext.jsx (ver docs/specs/10-accesibilidad.md).
 */
const A11y = (() => {
  let ctx = null;

  // Frecuencias y formas de onda del spec de accesibilidad (seccion 2.3)
  const EARCONS = {
    exito:  { freqs: [440, 880], onda: 'triangle', dur: 0.18 },
    error:  { freqs: [180],      onda: 'sawtooth', dur: 0.30 },
    accion: { freqs: [659.25],   onda: 'sine',     dur: 0.10 },
  };

  function earcon(tipo) {
    const cfg = EARCONS[tipo];
    if (!cfg) return;
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
        // Volumen bajo con decay exponencial: feedback, no interrupcion.
        // La envolvente arranca en `inicio`, no en currentTime: si no, la
        // segunda nota del earcon de exito suena cuando el gain ya decayo a 0.
        gain.gain.setValueAtTime(0.08, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + cfg.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + cfg.dur);
      });
    } catch (e) {
      // Sin Web Audio el flujo sigue: la voz y la live region son el canal principal
    }
  }

  function anunciar(texto) {
    // Live region primero: es el canal que siempre funciona, incluso sin TTS
    const region = document.getElementById('a11y-anuncios');
    if (region) {
      region.textContent = '';
      // El reset fuerza a los lectores de pantalla a releer un texto repetido
      setTimeout(() => { region.textContent = texto; }, 50);
    }
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();  // no encimar anuncios
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-ES';
      window.speechSynthesis.speak(u);
    } catch (e) {
      // Degradacion: queda la live region
    }
  }

  return { anunciar, earcon };
})();
