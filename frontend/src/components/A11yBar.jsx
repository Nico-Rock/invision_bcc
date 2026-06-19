import { useAudio } from '../hooks/useAudio';

export const A11yBar = () => {
  const {
    adjustTextScale,
    highContrast,
    toggleContrast,
    audioCuesEnabled,
    setAudioCuesEnabled,
    announceText,
    playCue,
  } = useAudio();

  const handleToggleCues = () => {
    setAudioCuesEnabled((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          playCue('success');
          announceText('Señales de audio activadas.');
        }, 50);
      } else {
        announceText('Señales de audio desactivadas.');
      }
      return next;
    });
  };

  return (
    <header 
      className="a11y-header" 
      role="region" 
      aria-label="Ajustes de accesibilidad visual y auditiva"
    >
      <div className="a11y-title">
        <span aria-hidden="true">♿</span>
        <span>Herramientas de Accesibilidad</span>
      </div>
      <div className="a11y-controls">
        <button 
          className="a11y-btn" 
          onClick={() => adjustTextScale(1)} 
          aria-label="Aumentar tamaño de letra"
        >
          Aumentar Texto A+
        </button>
        <button 
          className="a11y-btn" 
          onClick={() => adjustTextScale(-1)} 
          aria-label="Disminuir tamaño de letra"
        >
          Disminuir Texto A-
        </button>
        <button 
          className="a11y-btn" 
          id="contrastButton" 
          onClick={toggleContrast} 
          aria-label={highContrast ? "Desactivar contraste alto" : "Activar contraste alto"}
        >
          {highContrast ? "Modo Estándar" : "Alto Contraste"}
        </button>
        <button 
          className="a11y-btn" 
          id="audioCuesButton" 
          onClick={handleToggleCues} 
          aria-label={audioCuesEnabled ? "Desactivar señales de audio" : "Activar señales de audio"}
        >
          Señales de Audio: {audioCuesEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </header>
  );
};
