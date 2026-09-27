import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useAudio } from '../../../hooks/useAudio';
import { API_BASE_URL } from '../../../config';
import { CAMPOS, fechaHablada } from '../../../lib/consola';

/** Publicación (spec 005, R19): los socios solo ven lo publicado; publicar exige audio. */
export const PublicacionLibro = ({ libro, onCambio }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [enviando, setEnviando] = useState(false);

  if (!libro.publicacion_habilitada) {
    return (
      <section className="seccion-ficha" aria-labelledby="publicacion-titulo">
        <h3 id="publicacion-titulo">Publicación</h3>
        <p className="nota-campo">El estado de publicación todavía no está habilitado en esta base: todos los libros se ven.</p>
      </section>
    );
  }

  const publicado = libro.estado_publicacion === 'publicado';
  const cambiar = async () => {
    setEnviando(true);
    try {
      const r = await authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${libro.id}/publicacion`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: publicado ? 'borrador' : 'publicado' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : String(r.status));
      playCue('success');
      announceText(publicado ? `${libro.nombre} pasó a borrador: los socios ya no lo ven.` : `${libro.nombre} publicado: los socios ya lo pueden escuchar.`);
      onCambio();
    } catch (err) {
      playCue('error');
      announceText(`No se pudo cambiar la publicación: ${err.message}`, { urgente: true });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="seccion-ficha" aria-labelledby="publicacion-titulo">
      <h3 id="publicacion-titulo">Publicación</h3>
      <p>Estado: <strong>{publicado ? 'publicado' : 'borrador'}</strong>. {publicado ? 'Los socios lo ven en el catálogo.' : 'Los socios no lo ven hasta publicarlo, y publicar exige que tenga audio.'}</p>
      <button type="button" className="btn-submit" onClick={cambiar} disabled={enviando} aria-busy={enviando}>
        {publicado ? 'Pasar a borrador' : 'Publicar'}
      </button>
    </section>
  );
};

/** Historial de cambios con deshacer (spec 005, R23). */
export const HistorialLibro = ({ libro, onCambio }) => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const [cambios, setCambios] = useState(null);
  const [nota, setNota] = useState('');

  useEffect(() => {
    let vigente = true;
    authenticatedFetch(`${API_BASE_URL}/admin/audiolibros/${libro.id}/historial`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vigente) return;
        if (r.ok) setCambios(d);
        else { setCambios([]); setNota(typeof d.detail === 'string' ? d.detail : 'No se pudo cargar el historial.'); }
      })
      .catch(() => { if (vigente) { setCambios([]); setNota('No se pudo cargar el historial.'); } });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libro.id]);

  const deshacer = async (c) => {
    const r = await authenticatedFetch(`${API_BASE_URL}/admin/historial/${c.id}/deshacer`, { method: 'POST' });
    if (r.ok) {
      playCue('success');
      announceText(`Cambio deshecho: ${CAMPOS[c.campo] || c.campo} vuelve a ser ${c.antes || 'vacío'}.`);
      onCambio();
    } else {
      playCue('error');
      announceText('No se pudo deshacer el cambio.', { urgente: true });
    }
  };

  const valor = (v) => (v === null || v === undefined || v === '' ? 'vacío' : v === 'True' ? 'sí' : v === 'False' ? 'no' : v);

  return (
    <section className="seccion-ficha" aria-labelledby="historial-titulo">
      <h3 id="historial-titulo">Historial de cambios ({cambios ? cambios.length : '…'})</h3>
      {nota && <p className="nota-campo">{nota}</p>}
      {cambios && cambios.length === 0 && !nota && <p>Sin cambios registrados.</p>}
      {cambios && cambios.length > 0 && (
        <ol className="orden-pistas">
          {cambios.slice(0, 20).map((c) => (
            <li key={c.id}>
              {CAMPOS[c.campo] || c.campo}: de {valor(c.antes)} a {valor(c.despues)}
              {c.motivo !== 'edicion' ? ` (${c.motivo === 'fusion' ? 'unión de valores' : c.motivo})` : ''}, {c.usuario?.username || 'sin persona'}, {fechaHablada(c.fecha)}.{' '}
              <button type="button" className="btn-action-edit" onClick={() => deshacer(c)}>
                Deshacer<span className="sr-only"> el cambio de {CAMPOS[c.campo] || c.campo} a {valor(c.despues)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
