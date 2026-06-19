import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../hooks/useAudio';
import { API_BASE_URL } from '../../config';

export const AdminPanel = () => {
  const { authenticatedFetch } = useAuth();
  const { announceText, playCue } = useAudio();

  const [excelData, setExcelData] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  
  // Progress simulation state
  const [importProgress, setImportProgress] = useState(0);
  const [isImportingActive, setIsImportingActive] = useState(false);
  const [currentItemName, setCurrentItemName] = useState('');

  // Audit state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/admin/auditoria/sesiones/`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smart header mapping to convert Excel column names to API keys
  const mapHeadersToKeys = (row) => {
    const mapped = {};
    const keys = Object.keys(row);
    
    keys.forEach(k => {
      const normalizedKey = k.toLowerCase().trim();
      const val = row[k];

      if (normalizedKey.includes('nombre') || normalizedKey.includes('title') || normalizedKey.includes('titulo') || normalizedKey === 'name') {
        mapped.nombre = val;
      } else if (normalizedKey.includes('desc') || normalizedKey.includes('descripcion') || normalizedKey.includes('description')) {
        mapped.descripcion = val;
      } else if (normalizedKey.includes('autor') || normalizedKey.includes('author')) {
        mapped.autor = val;
      } else if (normalizedKey.includes('cat') || normalizedKey.includes('genre') || normalizedKey.includes('genero')) {
        mapped.categoria = val;
      } else if (normalizedKey.includes('clas') || normalizedKey.includes('tag') || normalizedKey.includes('label')) {
        // Puede ser string separado por comas o array
        if (typeof val === 'string') {
          mapped.clasificaciones = val.split(/[,,;,|]/).map(s => s.trim()).filter(Boolean);
        } else if (Array.isArray(val)) {
          mapped.clasificaciones = val;
        } else if (val) {
          mapped.clasificaciones = [String(val)];
        } else {
          mapped.clasificaciones = [];
        }
      } else if (normalizedKey.includes('sharepoint') || normalizedKey.includes('url') || normalizedKey.includes('link') || normalizedKey.includes('path')) {
        mapped.sharepoint_url = val;
      }
    });

    // Rellenar valores por defecto para campos requeridos
    if (!mapped.nombre) mapped.nombre = 'Audiolibro sin título';
    if (!mapped.clasificaciones) mapped.clasificaciones = [];
    
    return mapped;
  };

  const handleFile = (file) => {
    if (!file) return;
    
    const fileType = file.name.split('.').pop().toLowerCase();
    if (fileType !== 'xlsx' && fileType !== 'xls') {
      announceText('El archivo seleccionado no es un formato de Excel válido.');
      playCue('error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
          announceText('El archivo de Excel está vacío.');
          playCue('error');
          return;
        }

        const mappedData = json.map(mapHeadersToKeys);
        setExcelData(mappedData);
        announceText(`Archivo cargado exitosamente. Se encontraron ${mappedData.length} registros en la planilla.`);
        playCue('success');
      } catch (err) {
        console.error(err);
        announceText('Ocurrió un error al leer el archivo de Excel.');
        playCue('error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerImport = async () => {
    if (excelData.length === 0) return;
    
    setLoadingImport(true);
    setImportMessage('');
    try {
      announceText('Enviando lote al servidor de ingesta...');
      playCue('action');

      const response = await authenticatedFetch(`${API_BASE_URL}/admin/importar-lote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ libros: excelData }),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar la importación masiva.');
      }

      const data = await response.json();
      setImportMessage(data.message || 'Importación iniciada correctamente.');
      announceText('Lote aceptado. Iniciando transferencia desde SharePoint a Azure.');
      playCue('success');

      // Iniciar simulación de ingesta para feedback visual e interactivo
      startProgressSimulation(excelData);
      setExcelData([]);
    } catch (err) {
      setImportMessage(err.message || 'Error de conexión.');
      announceText(`Error al importar el lote: ${err.message}`);
      playCue('error');
    } finally {
      setLoadingImport(false);
    }
  };

  const startProgressSimulation = (items) => {
    setIsImportingActive(true);
    setImportProgress(0);
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= items.length) {
        clearInterval(interval);
        setIsImportingActive(false);
        setImportProgress(100);
        setCurrentItemName('');
        announceText('Ingesta masiva finalizada con éxito. Todos los archivos transferidos a Azure Blob Storage.');
        playCue('success');
        fetchAuditLogs(); // Recargar registros
        return;
      }

      const currentItem = items[currentIndex];
      setCurrentItemName(currentItem.nombre);
      const percent = Math.round(((currentIndex + 1) / items.length) * 100);
      setImportProgress(percent);
      
      announceText(`Transferido: ${currentItem.nombre}. Progreso al ${percent} por ciento.`);
      playCue('action');
      currentIndex++;
    }, 2000);
  };

  return (
    <div className="admin-panel-container">
      <header className="admin-header">
        <h1 className="admin-title">Panel de Administración e Ingesta</h1>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>
          Gestión del patrimonio digital de la Biblioteca Central para Ciegos
        </p>
      </header>

      {/* Simulación de progreso de ingesta */}
      {isImportingActive && (
        <section 
          aria-live="assertive" 
          style={{ 
            background: 'var(--bg-sidebar)', 
            border: '3px solid var(--accent-orange)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '1.5rem', 
            marginBottom: '2rem' 
          }}
        >
          <h2 style={{ fontSize: '1.4rem', color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>
            Procesando Ingesta SharePoint ➔ Azure Storage...
          </h2>
          <p style={{ fontWeight: 'bold', marginBottom: '0.8rem' }}>
            Descargando: <span style={{ color: 'var(--accent-blue)' }}>{currentItemName}</span>
          </p>
          <div style={{ width: '100%', backgroundColor: '#E5E7EB', borderRadius: '50px', height: '24px', overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${importProgress}%`, 
                backgroundColor: 'var(--accent-orange)', 
                height: '100%', 
                transition: 'width 0.5s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}
            >
              {importProgress}%
            </div>
          </div>
        </section>
      )}

      <div className="admin-grid">
        {/* Sección Izquierda: Carga masiva */}
        <section className="admin-card" aria-labelledby="import-title">
          <h2 id="import-title">Carga Masiva desde SharePoint</h2>
          
          <div 
            className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('excel-file-input').click()}
            tabIndex="0"
            role="button"
            aria-label="Zona de arrastre de planilla Excel. Presione Enter para abrir el selector de archivos."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                document.getElementById('excel-file-input').click();
              }
            }}
            onFocus={() => playCue('focus')}
          >
            <input 
              id="excel-file-input"
              type="file" 
              accept=".xlsx, .xls"
              onChange={(e) => handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="var(--accent-blue)" strokeWidth="2" fill="none" style={{ margin: '0 auto 1rem auto', display: 'block' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <p>Arrastra aquí tu planilla .xlsx de catálogo</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              o haz clic para explorar en tu disco
            </p>
          </div>

          {excelData.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Previsualización del lote</h3>
              <div className="excel-preview">
                <table className="excel-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col">Título</th>
                      <th scope="col">Autor</th>
                      <th scope="col">Categoría</th>
                      <th scope="col">Ruta SharePoint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelData.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.nombre}</td>
                        <td>{row.autor || '—'}</td>
                        <td>{row.categoria || '—'}</td>
                        <td style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{row.sharepoint_url || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importMessage && (
                <div style={{ padding: '1rem', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '8px', margin: '1rem 0', fontWeight: 'bold' }}>
                  {importMessage}
                </div>
              )}

              <button 
                type="button" 
                className="btn-submit"
                onClick={triggerImport}
                disabled={loadingImport}
                aria-busy={loadingImport}
                onFocus={() => playCue('focus')}
              >
                {loadingImport ? 'Procesando encolamiento...' : `Iniciar Ingesta de ${excelData.length} Libros`}
              </button>
            </div>
          )}
        </section>

        {/* Sección Derecha: Auditoría de Accesos */}
        <section className="admin-card" aria-labelledby="audit-title">
          <h2 id="audit-title">Auditoría de Sesiones y Accesos</h2>

          {loadingAudit ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', fontWeight: 'bold' }}>
              Cargando logs de acceso...
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No se registran eventos de inicio o cierre de sesión.
            </div>
          ) : (
            <div className="audit-list" role="log" aria-label="Historial de inicios y cierres de sesión">
              {auditLogs.map((log) => {
                const date = new Date(log.timestamp);
                return (
                  <div key={log.id} className="audit-item" tabIndex="0" onFocus={() => playCue('focus')}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Usuario ID: {log.usuario_id}</span>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {date.toLocaleDateString()} a las {date.toLocaleTimeString()}
                      </div>
                    </div>
                    <span className={`audit-badge ${log.tipo_evento.toLowerCase()}`}>
                      {log.tipo_evento === 'LOGIN' ? 'INICIO SESIÓN' : 'CERRÓ SESIÓN'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
export default AdminPanel;
