import { useEffect, useRef } from 'react';

/**
 * Diálogo modal nativo (spec 002, R30, D18). `showModal()` vuelve inerte el
 * resto de la página, cierra con Esc y, al cerrarse, el foco vuelve a quien lo
 * abrió. El evento `close` es la única fuente de verdad: `onClose` avisa al
 * padre para que actualice su estado.
 *
 * Tab y Shift+Tab giran adentro: el modal nativo deja salir el foco hacia la
 * interfaz del navegador (en el panel quedaba en <body>).
 */
export const Dialogo = ({ abierto, onClose, tituloId, className = 'modal-card', claseDialogo = '', children }) => {
  const ref = useRef(null);
  const disparadorRef = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) {
      disparadorRef.current = document.activeElement;
      dialogo.showModal();
      // [data-foco-inicial]: un elemento estático arriba (con tabIndex -1) para
      // contenidos largos, así la ventana no abre desplazada hasta el final
      const primero = dialogo.querySelector('[data-foco-inicial], [autofocus], input, select, textarea, button');
      if (primero) primero.focus();
    } else if (!abierto && dialogo.open) {
      dialogo.close();
    }
  }, [abierto]);

  const alCerrar = () => {
    const destino = disparadorRef.current;
    // Si el disparador ya no existe (p. ej. la fila del libro recién eliminado),
    // el foco va al contenido principal: nunca queda en la nada.
    if (destino && document.contains(destino)) destino.focus();
    else document.getElementById('main-content-section')?.focus();
    disparadorRef.current = null;
    onClose();
  };

  const retenerFoco = (e) => {
    if (e.key !== 'Tab') return;
    const enfocables = [...ref.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  // Clic en el fondo (fuera de la tarjeta) cierra, como el overlay anterior
  const alClic = (e) => {
    if (e.target === ref.current) ref.current.close();
  };

  return (
    <dialog
      ref={ref}
      className={`dialogo ${claseDialogo}`.trim()}
      aria-labelledby={tituloId}
      onClose={alCerrar}
      onKeyDown={retenerFoco}
      onClick={alClic}
    >
      {/* La tarjeta va adentro: así el clic en el fondo es el único que
          tiene como destino al <dialog> mismo */}
      {abierto && <div className={className}>{children}</div>}
    </dialog>
  );
};

export default Dialogo;
