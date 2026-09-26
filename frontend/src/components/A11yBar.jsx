import { useAudio } from '../hooks/useAudio';

// Interruptor (spec 002, D17): texto fijo, aria-pressed y una marca visible.
// El nombre accesible es siempre lo que se ve, así lo encuentra el control por voz.
const Interruptor = ({ activo, onClick, children }) => (
  <button type="button" className="a11y-btn" aria-pressed={activo} onClick={onClick}>
    {activo && <span className="marca-activa" aria-hidden="true">✓ </span>}
    {children}
  </button>
);

export const A11yBar = () => {
  const {
    adjustTextScale,
    highContrast,
    toggleContrast,
    audioCuesEnabled,
    setAudioCuesEnabled,
    vozActiva,
    toggleVoz,
    announceText,
    playCue,
  } = useAudio();

  const handleToggleCues = () => {
    const next = !audioCuesEnabled;
    setAudioCuesEnabled(next);
    if (next) setTimeout(() => playCue('success'), 50);
    announceText(next ? 'Señales de audio activadas.' : 'Señales de audio desactivadas.');
  };

  // <section> y no <header>: un header de primer nivel es el banner de la
  // página y la barra no lo es (R31).
  return (
    <section className="a11y-header" aria-label="Ajustes de accesibilidad visual y auditiva">
      <p className="a11y-title">
        <span aria-hidden="true">♿</span>
        <span>Herramientas de Accesibilidad</span>
      </p>
      <div className="a11y-controls">
        <button type="button" className="a11y-btn" onClick={() => adjustTextScale(1)}>
          Aumentar Texto A+
        </button>
        <button type="button" className="a11y-btn" onClick={() => adjustTextScale(-1)}>
          Disminuir Texto A-
        </button>
        <Interruptor activo={highContrast} onClick={toggleContrast}>Alto Contraste</Interruptor>
        <Interruptor activo={audioCuesEnabled} onClick={handleToggleCues}>Señales de Audio</Interruptor>
        <Interruptor activo={vozActiva} onClick={toggleVoz}>Lectura en voz</Interruptor>
      </div>
    </section>
  );
};
