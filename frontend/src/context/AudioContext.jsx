/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const { token, user } = useAuth();
  
  // Audio state
  const [currentBook, setCurrentBook] = useState(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('a11y-volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  // Accessibility state
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(() => {
    const saved = localStorage.getItem('a11y-cues');
    return saved !== null ? saved === 'true' : true;
  });
  const [fontScale, setFontScale] = useState(() => {
    const saved = localStorage.getItem('a11y-font-scale');
    return saved !== null ? parseInt(saved, 10) : 16;
  });
  const [highContrast, setHighContrast] = useState(() => {
    const saved = localStorage.getItem('a11y-high-contrast');
    return saved !== null ? saved === 'true' : false;
  });

  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const objectUrlRef = useRef(null);

  // Sync volume to localStorage
  useEffect(() => {
    localStorage.setItem('a11y-volume', volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync audio cues to localStorage
  useEffect(() => {
    localStorage.setItem('a11y-cues', audioCuesEnabled.toString());
  }, [audioCuesEnabled]);

  // Sync fontScale to CSS variable
  useEffect(() => {
    localStorage.setItem('a11y-font-scale', fontScale.toString());
    document.documentElement.style.setProperty('--font-scale', `${fontScale}px`);
  }, [fontScale]);

  // Sync highContrast to body class
  useEffect(() => {
    localStorage.setItem('a11y-high-contrast', highContrast.toString());
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [highContrast]);

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

  // Screen reader speech announcement
  const announceText = (text, assertive = true) => {
    const announcer = document.getElementById('srAnnouncer');
    if (announcer) {
      announcer.innerText = text;
      // Toggle role to re-trigger screen readers
      announcer.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
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
      announceText('Error de reproducción de audio.');
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
      announceText('Debes iniciar sesión para reproducir audiolibros.');
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
      announceText(`Error al reproducir el capítulo: ${err.message}`);
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
    setFontScale(prev => {
      let next = prev + direction * 2;
      if (next < 12) next = 12;
      if (next > 28) next = 28;
      announceText(`Tamaño de letra ajustado a ${next} píxeles`);
      playCue('action');
      return next;
    });
  };

  const toggleContrast = () => {
    setHighContrast(prev => {
      const next = !prev;
      playCue('success');
      if (next) {
        announceText('Alto contraste activado. Interfaz optimizada en color negro y amarillo.');
      } else {
        announceText('Alto contraste desactivado. Interfaz estándar en blanco y naranja.');
      }
      return next;
    });
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
