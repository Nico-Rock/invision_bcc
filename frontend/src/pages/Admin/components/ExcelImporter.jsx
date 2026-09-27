// Ingesta masiva deshabilitada (spec 005, R1 y R2).
//
// La versión anterior subía un archivo falso sobre el capítulo 1 real de cada
// libro y anunciaba "finalizada con éxito" con un progreso inventado. Para quien
// no ve la pantalla, lo que se anuncia es su única evidencia: esta pantalla
// solo dice la verdad y lleva a donde sí se puede cargar.
export const ExcelImporter = ({ onIrALibros }) => (
  <section className="admin-card" aria-labelledby="import-title">
    <h2 id="import-title">Ingesta Masiva desde SharePoint</h2>
    <p className="aviso-admin">
      <strong>Deshabilitada.</strong> La transferencia desde SharePoint todavía no existe: la
      versión anterior anunciaba cargas que no ocurrían y podía reemplazar audio real por un
      archivo vacío.
    </p>
    <p>
      Mientras tanto, cada libro se carga desde la pestaña Libros: se registra la ficha con su
      narrador y, en la misma ficha, se suben sus capítulos uno por uno, con aviso de cada
      resultado.
    </p>
    <button type="button" className="btn-submit" onClick={onIrALibros}>
      Ir a Libros
    </button>
  </section>
);

export default ExcelImporter;
