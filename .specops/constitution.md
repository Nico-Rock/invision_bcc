# Constitución del proyecto — Invision (Biblioteca Digital Accesible, BCC)

> Principios durables. Se consultan en Specify, Plan e Implement. Cada regla está numerada y es verificable.
> Formaliza reglas que el proyecto ya venía aplicando en la práctica (mandato de gobernanza del panel,
> lecciones de los incidentes del 2026-08-27 y 2026-09-21).

**Version:** 1.0.0
**Status:** draft  **Ratified by:** _pendiente (Nico)_  **Ratified date:** _pendiente_  **Last amended:** 2026-09-26

## 1. Calidad de código (Code Quality)
- **P1.** El código nuevo sigue el idioma del archivo que toca (Python estándar sin framework en `admin-dashboard/`, FastAPI en `InvisionAPI-main/`, React en `frontend/`). No se agregan frameworks ni pasos de build donde no los hay.
- **P2.** Ningún dato de dominio se hardcodea en la UI si existe en la base (géneros, títulos, conteos). La base es la fuente, la UI la refleja.

## 2. Estándar de pruebas (Testing)
- **P3.** Toda función que escribe en la base o en Blob Storage tiene tests automáticos que corren contra dobles locales (SQLite temporal, contenedor Blob simulado) y nunca contra producción.
- **P4.** Todo cambio de lectura de datos se prueba con un caso de dato "envenenado" (fila con valores que la API rechazaría), porque una fila mala no puede tumbar una colección entera.
- **P5.** Evidencia antes de afirmación: ninguna tarea se marca como hecha sin un comando de verificación ejecutado y con salida registrada.

## 3. Postura de seguridad (Security)
- **P6.** Nada de secretos en código, logs, commits ni artefactos. Todo sale de `.env`, que no se versiona.
- **P7.** Toda entrada no confiable (formularios, archivos subidos, manifiestos CSV o Excel) se valida en el borde **con las mismas reglas que la API** (schemas Pydantic y límites de columnas de producción) antes de tocar cualquier almacenamiento.
- **P8.** Clases de debilidad no permitidas: CWE-89 (SQL construido con strings; siempre consultas parametrizadas), CWE-22 (rutas de archivo derivadas de entrada sin normalizar), CWE-798 (credenciales en código), CWE-20 (entrada sin validar).
- **P9.** Los datos de prueba no usan dominios de uso reservado (`.local`, `.localhost`, `.test`, `.invalid`, `.example`, `.internal`, `.onion`, `.arpa`).

## 4. Presupuesto de rendimiento (Performance)
- **P10.** Ningún servidor bloquea su arranque esperando a un servicio externo. Si Azure (SQL o Blob) tarda o falla, el servidor igual atiende y reporta el estado de forma honesta.
- **P11.** La carga de audio viaja en streaming, sin cargar el archivo entero en memoria, y cada lote se puede retomar sin volver a subir lo que ya está.

## 5. Gobernanza (Governance)
- **P12.** **Ningún cambio en la base de datos, en Blob Storage o en el código de producción sin validación formal previa del equipo BCC**, con quién aprobó y cuándo registrado por escrito en el artefacto correspondiente. Las herramientas que escriben en producción funcionan en modo simulación por defecto.
- **P13.** El esquema de producción (Azure SQL) es la fuente de verdad del modelo de datos mientras el governance board no decida otra cosa (ver `docs/specs/13-divergencia-esquema-produccion.md`).
- **P14.** Accesibilidad no negociable: toda interfaz nueva o modificada cumple WCAG 2.1 AA, se opera entera con teclado y anuncia su estado a lectores de pantalla. Una interfaz que un bibliotecario ciego no puede usar no está terminada.
- **P15.** Aprobación humana obligatoria en la Human Gate 1 (después de Analyze) y en la Human Gate 2 (después de Verify).
- **P16.** No se edita código sin un cambio de artefacto que lo justifique. Está prohibido parchear síntomas (`try/except` vacíos, tests comentados).

## Proceso de enmiendas
Toda enmienda requiere ratificación explícita, incremento de versión SemVer y una entrada en este registro (qué cambió, por qué, quién aprobó, cuándo).

| Versión | Fecha | Cambio | Aprobó |
|---|---|---|---|
| 1.0.0 | 2026-09-26 | Versión inicial | _pendiente_ |
