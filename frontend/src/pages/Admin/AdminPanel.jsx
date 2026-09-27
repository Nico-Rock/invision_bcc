import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../hooks/useAudio';
import { API_BASE_URL } from '../../config';
import { Inicio } from './components/Inicio';
import { Importador } from './components/Importador';
import { AuditLogs } from './components/AuditLogs';
import { UserManagement } from './components/UserManagement';
import { ContentManagement } from './components/ContentManagement';
import { Papelera } from './components/Papelera';
import { Tareas } from './components/Tareas';
import { ESTADOS_TAREA, tareaActiva } from '../../lib/consola';

// Pestañas (spec 005, R13 y R18): la consola abre en Inicio, que dice qué
// necesita atención. El orden va de lo diario a lo excepcional.
const PESTANAS = [
  { id: 'inicio', nombre: 'Inicio' },
  { id: 'content', nombre: 'Libros' },
  { id: 'users', nombre: 'Usuarios' },
  { id: 'import', nombre: 'Importar fichas' },
  { id: 'tareas', nombre: 'Tareas' },
  { id: 'papelera', nombre: 'Papelera' },
  { id: 'audit', nombre: 'Auditoría' },
];

/**
 * Vigila las tareas largas desde cualquier pestaña (R21): cuando una termina,
 * se avisa aunque el administrador esté trabajando en otra cosa. Cortés si
 * salió bien, urgente si tuvo errores. Quien no ve no puede mirar una barra.
 */
const useVigilanteDeTareas = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();
  const conocidas = useRef(null);

  useEffect(() => {
    let vigente = true;
    const revisar = async () => {
      try {
        const r = await authenticatedFetch(`${API_BASE_URL}/admin/tareas`);
        if (!r.ok || !vigente) return;
        const tareas = await r.json();
        const antes = conocidas.current;
        conocidas.current = Object.fromEntries(tareas.map((t) => [t.id, t.estado]));
        if (!antes) return;  // primera lectura: nada que avisar
        for (const t of tareas) {
          const previo = antes[t.id];
          if ((previo === undefined || tareaActiva({ estado: previo })) && !tareaActiva(t)) {
            const urgente = t.estado !== 'terminada';
            playCue(urgente ? 'error' : 'success');
            announceText(`Tarea ${ESTADOS_TAREA[t.estado]}: ${t.titulo}. ${t.hechos} de ${t.total}${t.fallidos ? `, ${t.fallidos} con problemas` : ''}.`, { urgente });
          }
        }
      } catch {
        // Sin conexión: se reintenta en la próxima vuelta
      }
    };
    revisar();
    const intervalo = setInterval(revisar, 4000);
    return () => { vigente = false; clearInterval(intervalo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export const AdminPanel = () => {
  const { announceText, playCue } = useAudio();
  const [activeTab, setActiveTab] = useState('inicio');
  const [filtroLibros, setFiltroLibros] = useState(null);
  const tabRefs = useRef({});
  useVigilanteDeTareas();

  // Un solo aviso, con el nombre que se ve
  const changeTab = (id, opciones = {}) => {
    setActiveTab(id);
    if (id === 'content') setFiltroLibros(opciones.filtro || null);
    const pestana = PESTANAS.find((p) => p.id === id);
    announceText(`${pestana.nombre}${opciones.filtro ? `, ${opciones.filtro.nombre}` : ''}.`);
    playCue('action');
    setTimeout(() => (opciones.foco ? document.getElementById(opciones.foco) : tabRefs.current[id])?.focus(), 0);
  };

  // Patrón de pestañas ARIA completo: flechas, Inicio y Fin
  const handleTabKeyDown = (e, index) => {
    const ultimo = PESTANAS.length - 1;
    const destino = { ArrowRight: index === ultimo ? 0 : index + 1, ArrowLeft: index === 0 ? ultimo : index - 1, Home: 0, End: ultimo }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    changeTab(PESTANAS[destino].id);
  };

  const irA = (id, opciones) => changeTab(id, opciones);

  return (
    <div className="admin-panel-container">
      <header className="admin-header">
        <h1 className="admin-title">Panel de Administración</h1>
        <p className="admin-subtitulo">
          Gestión del patrimonio digital de la Biblioteca Central para Ciegos
        </p>
      </header>

      <div role="tablist" aria-label="Secciones de administración" className="tabs-header">
        {PESTANAS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => { tabRefs.current[p.id] = el; }}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={activeTab === p.id}
            aria-controls={`panel-${p.id}`}
            className={`tab-btn ${activeTab === p.id ? 'active' : ''}`}
            tabIndex={activeTab === p.id ? 0 : -1}
            onClick={() => changeTab(p.id)}
            onKeyDown={(e) => handleTabKeyDown(e, i)}
            onFocus={() => playCue('focus')}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {PESTANAS.map((p) => (
        <div key={p.id} id={`panel-${p.id}`} role="tabpanel" aria-labelledby={`tab-${p.id}`} hidden={activeTab !== p.id}>
          {activeTab === p.id && p.id === 'inicio' && <Inicio irA={irA} />}
          {activeTab === p.id && p.id === 'content' && <ContentManagement filtroInicial={filtroLibros} />}
          {activeTab === p.id && p.id === 'users' && <UserManagement />}
          {activeTab === p.id && p.id === 'import' && <Importador irA={irA} />}
          {activeTab === p.id && p.id === 'tareas' && <Tareas />}
          {activeTab === p.id && p.id === 'papelera' && <Papelera />}
          {activeTab === p.id && p.id === 'audit' && <AuditLogs />}
        </div>
      ))}
    </div>
  );
};

export default AdminPanel;
