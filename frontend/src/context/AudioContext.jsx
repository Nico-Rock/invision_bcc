/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const AudioContext = createContext(null);

// Decisión A3 de la reunión del 29/09: única constante a cambiar.
const VOZ_POR_DEFECTO = true;
const TEXTO_MIN = 12, TEXTO_MAX = 32;

const leerCrudo = (clave) => {
  try { return localStorage.getItem(clave); } catch { return null; }
};
const guardar = (clave, valor) => {
  try { localStorage.setItem(clave, valor); } catch { /* sin storage: vale para esta sesión */ }
};
const leerBooleano = (clave, porDefecto) => {
  const v = leerCrudo(clave);
  return v === 'true' ? true : v === 'false' ? false : porDefecto;
};
// Acota y redondea al paso de 2 px; cualquier valor inválido vuelve a 16.
function acotarTexto(valor) {
  if (!Number.isFinite(valor) || valor === 0) return 16;
  return Math.min(TEXTO_MAX, Math.max(TEXTO_MIN, Math.round(valor / 2) * 2));
}
// Un volumen NaN o mayor que 1 lanzaba IndexSizeError al asignarlo (CWE-20).
function leerVolumen() {
  const v = Number.parseFloat(leerCrudo('a11y-volume'));
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
}

export const AudioProvider = ({ children }) => {
  const { token, user } = useAuth();
  
  // Audio state
  const [currentBook, setCurrentBook] = useState(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => leerVolumen());
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [chapters, setChapters] = useState([]);
  const [muted, setMuted] = useState(false);

  // Preferencias de accesibilidad: se leen acotadas (un valor corrupto en
  // localStorage no puede romper la app, CWE-20) y se aplican en <html>.
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(() => leerBooleano('a11y-cues', true));
  const [fontScale, setFontScale] = useState(() => acotarTexto(Number(leerCrudo('a11y-font-scale'))));
  const [highContrast, setHighContrast] = useState(() => leerBooleano('a11y-high-contrast', false));
  // "Lectura en voz" (R28): la voz propia del sitio es opcional para no
  // duplicar al lector de pantalla. Valor por defecto: decisión A3 del PRD.
  const [vozActiva, setVozActiva] = useState(() => leerBooleano('a11y-voz', VOZ_POR_DEFECTO));
  const vozRef = useRef(vozActiva);
  const primerUsoRef = useRef(leerCrudo('a11y-voz') === null);

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const objectUrlRef = useRef(null);

  // Sync volume to localStorage
  useEffect(() => {
    guardar('a11y-volume', volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    guardar('a11y-cues', audioCuesEnabled.toString());
  }, [audioCuesEnabled]);

  // Texto como proporción del tamaño del navegador (R1): factor sobre 16 px,
  // hasta 200 %. Desde 24 px el diseño pasa a una columna (texto-amplio).
  useEffect(() => {
    guardar('a11y-font-scale', fontScale.toString());
    const html = document.documentElement;
    html.style.setProperty('--font-factor', String(fontScale / 16));
    html.classList.toggle('texto-amplio', fontScale >= 24);
  }, [fontScale]);

  useEffect(() => {
    guardar('a11y-high-contrast', highContrast.toString());
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  useEffect(() => {
    vozRef.current = vozActiva;
    guardar('a11y-voz', vozActiva.toString());
  }, [vozActiva]);

  // Web Audio API for Earcons
  const playBeep = (freq, type = 'sine', duration = 0.1) => {
    if (!audioCuesEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked', e);
    }
  };

  const playCue = (cueType) => {
    switch (cueType) {
      case 'focus':
        playBeep(523.25, 'sine', 0.08); // C5
        break;
      case 'success':
        playBeep(440, 'triangle', 0.15); // A4
        setTimeout(() => playBeep(880, 'triangle', 0.15), 100); // A5
        break;
      case 'error':
        playBeep(180, 'sawtooth', 0.3); // Low buzz
        break;
      case 'action':
        playBeep(659.25, 'sine', 0.1); // E5
        break;
      case 'voiceStart':
        playBeep(880, 'sine', 0.15); // High beep
        break;
      default:
        break;
    }
  };

  /**
   * Dos canales (R4, D6): cortés para estados (se agrega un <p>, los avisos se
   * suceden sin cortarse) y urgente solo para errores, validaciones y bloqueos.
   * La voz propia habla solo con "Lectura en voz" encendida.
   * Compatibilidad: un segundo argumento booleano se ignora (antes era
   * "assertive" por defecto, que interrumpía todo).
   */
  const announceText = (text, opciones = {}) => {
    const { urgente = false, alTerminar = null } = typeof opciones === 'object' && opciones ? opciones : {};
    const cortes = document.getElementById('a11y-cortes');
    const urgenteRegion = document.getElementById('a11y-urgente');
    if (urgente && urgenteRegion) {
      if (cortes) cortes.replaceChildren();
      urgenteRegion.textContent = '';
      setTimeout(() => { urgenteRegion.textContent = text; }, 50);
    } else if (cortes) {
      const p = document.createElement('p');
      p.textContent = text;
      cortes.appendChild(p);
      while (cortes.childElementCount > 5) cortes.firstElementChild.remove();
    }

    let listo = false;
    const fin = () => { if (!listo) { listo = true; if (alTerminar) alTerminar(); } };
    if (!vozRef.current || !('speechSynthesis' in window)) {
      fin();
      return;
    }
    try {
      if (urgente) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.1;
      utterance.onend = fin;
      utterance.onerror = fin;
      window.speechSynthesis.speak(utterance);
      if (alTerminar) setTimeout(fin, 2000 + text.length * 90);
    } catch {
      fin();
    }
  };

  // Handle audio element event listeners
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      announceText('Fin del capítulo.');
      playCue('success');
    };
    const onError = (e) => {
      console.error('Audio playback error', e);
      setIsPlaying(false);
      announceText('Error de reproducción de audio.', { urgente: true });
      playCue('error');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load and play a specific audiobook chapter
  const playChapter = async (book, chapterIdx) => {
    if (!token || !user) {
      announceText('Debes iniciar sesión para reproducir audiolibros.', { urgente: true });
      playCue('error');
      return;
    }

    try {
      setIsPlaying(false);
      setCurrentBook(book);
      setCurrentChapterIndex(chapterIdx);
      
      announceText(`Cargando capítulo ${chapterIdx} de ${book.nombre || book.title}...`);
      playCue('action');

      const streamUrl = `${API_BASE_URL}/stream-audio-simple/${user.id}/${book.id}/${chapterIdx}`;
      
      const response = await fetch(streamUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener el flujo de audio del servidor');
      }

      const audioBlob = await response.blob();
      
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(audioBlob);
      objectUrlRef.current = objectUrl;

      if (audioRef.current) {
        audioRef.current.src = objectUrl;
        audioRef.current.volume = volume;
        audioRef.current.playbackRate = playbackRate;
        
        await audioRef.current.play();
        setIsPlaying(true);
        announceText(`Reproduciendo ${book.nombre || book.title}. Capítulo ${chapterIdx}.`);
        playCue('success');
      }
    } catch (err) {
      console.error(err);
      announceText(`Error al reproducir el capítulo: ${err.message}`, { urgente: true });
      playCue('error');
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !currentBook) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      announceText('Reproducción pausada');
      playCue('action');
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        announceText('Reproducción reanudada');
        playCue('success');
      }).catch((e) => {
        console.error(e);
        announceText('No se pudo reanudar la reproducción.', { urgente: true });
        playCue('error');
      });
    }
  };

  const skipSeconds = (seconds) => {
    if (!audioRef.current || !currentBook) return;
    
    let targetTime = audioRef.current.currentTime + seconds;
    if (targetTime < 0) targetTime = 0;
    if (targetTime > duration) targetTime = duration;
    
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    
    const direction = seconds > 0 ? 'adelantados' : 'retrocedidos';
    announceText(`${Math.abs(seconds)} segundos ${direction}`);
    playCue('action');
  };

  const seekTime = (percent) => {
    if (!audioRef.current || !currentBook || duration === 0) return;
    const targetTime = (percent / 100) * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    announceText(`Posición de reproducción cambiada al ${Math.round(percent)} por ciento`);
  };

  const changeSpeed = (rate) => {
    if (rate < 0.5 || rate > 3.0) return;
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    announceText(`Velocidad de reproducción ajustada a ${rate} equis`);
    playCue('action');
  };

  const adjustTextScale = (direction) => {
    const next = acotarTexto(fontScale + Math.sign(direction) * 2);
    const pct = Math.round((next / 16) * 100);
    if (next === fontScale) {
      announceText(`El texto ya está al ${direction > 0 ? 'máximo' : 'mínimo'}, ${pct} %.`);
      playCue('error');
      return;
    }
    setFontScale(next);
    announceText(`Texto al ${pct} %.`);
    playCue('action');
  };

  const toggleContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    playCue('success');
    announceText(next
      ? 'Alto contraste activado: fondo negro, texto blanco y amarillo.'
      : 'Alto contraste desactivado: modo estándar.');
  };

  const toggleVoz = () => {
    const next = !vozActiva;
    if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    vozRef.current = next;
    setVozActiva(next);
    playCue('action');
    announceText(next
      ? 'Lectura en voz activada: el sitio lee sus avisos en voz alta.'
      : 'Lectura en voz desactivada. Los avisos siguen llegando a tu lector de pantalla.');
  };

  // Atajos del reproductor (R15): volumen de a 10 %, silencio y capítulo vecino.
  const stepVolume = (direction) => {
    const next = Math.min(1, Math.max(0, Math.round((volume + Math.sign(direction) * 0.1) * 10) / 10));
    const pct = Math.round(next * 100);
    if (next === volume) {
      announceText(`Volumen al ${direction > 0 ? 'máximo' : 'mínimo'}, ${pct} %.`);
      playCue('error');
      return;
    }
    setVolume(next);
    if (muted && direction > 0) toggleMute(false);
    announceText(`Volumen ${pct} %.`);
    playCue('action');
  };

  const toggleMute = (anunciar = true) => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    if (anunciar) {
      announceText(next ? 'Silenciado.' : `Sonido restaurado, volumen ${Math.round(volume * 100)} %.`);
      playCue('action');
    }
  };

  const neighborChapter = (direction) => {
    if (!currentBook) return;
    const next = currentChapterIndex + Math.sign(direction);
    const total = chapters.length || 1;
    if (next < 1 || next > total) {
      announceText(direction > 0 ? 'No hay capítulo siguiente.' : 'No hay capítulo anterior.');
      playCue('error');
      return;
    }
    playChapter(currentBook, next);
  };

  const value = {
    currentBook,
    currentChapterIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    playbackRate,
    changeSpeed,
    audioCuesEnabled,
    setAudioCuesEnabled,
    fontScale,
    adjustTextScale,
    highContrast,
    toggleContrast,
    vozActiva,
    toggleVoz,
    esPrimerUso: () => primerUsoRef.current,
    chapters,
    setChapters,
    muted,
    stepVolume,
    toggleMute,
    neighborChapter,
    playCue,
    announceText,
    playChapter,
    togglePlayback,
    skipSeconds,
    seekTime,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};
