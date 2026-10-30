# Arquitectura de Interacción, Sincronización y Flujo de Datos (Admin · Asesor · Cliente)

## 1. Resumen Ejecutivo y Diagnóstico Arquitectónico

El sistema opera bajo una arquitectura de tres portales conectados a un almacén de estado unificado en el servidor y almacenamiento local en el navegador:
1. **Portal Administrador (`ADMIN`)**: Control global sobre catálogo, márgenes, excepciones, equipo comercial, facturación, operaciones, auditoría, bandeja de salida y la totalidad de las cotizaciones.
2. **Portal Asesor Comercial (`SALES_REP`)**: Gestión comercial enfocada en su cartera de cotizaciones, creación de clientes/contactos, consulta de catálogo en modo lectura y seguimiento de facturas/órdenes e indicadores propios.
3. **Portal Corporativo del Cliente (`CUSTOMER_CONTACT` y Vista Pública de Propuesta)**: Autoservicio B2B para revisión de propuestas, aceptación con firma electrónica, rechazo con motivo, solicitud de ajustes comerciales, seguimiento de órdenes de trabajo/hitos y consulta de estado de cuenta/facturas.

A partir de las decisiones arquitectónicas definidas para esta intervención, el plan establece:
- **Bus de Sincronización Reactiva Multicanal**: Implementación de un bus de eventos de dominio basado en `BroadcastChannel`, eventos `storage` y `CustomEvent` locales, complementado con sondeo ligero inteligente cuando la pestaña está visible.
- **Aislamiento de Sesión por Pestaña**: Uso de `sessionStorage` para almacenar la identidad y el token de cada pestaña de forma independiente (permitiendo operar simultáneamente como Admin en una pestaña, Asesor en otra y Cliente en una tercera sin pisar sesiones), reservando `localStorage` y `BroadcastChannel` exclusivamente para propagar señales de invalidación y sincronización de datos.
- **Prevención de Colisiones de Edición**: Validación estricta de estado, revisión vigente (`revision` / `isLatestRevision`) y marca temporal (`updatedAt`) antes de persistir cambios, bloqueando sobrescrituras cuando una cotización ya fue aceptada, rechazada o reemplazada por una nueva revisión.

---

## 2. Matriz de Acciones por Rol y Efectos Reactivos

| Entidad / Recurso | Acción / Operación | Admin | Asesor | Cliente | Efecto Reactivo y Persistido en los Otros Portales |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Cotizaciones (Ciclo de Vida)** | Crear borrador, editar líneas, costos extra y condiciones | Sí (Global y en nombre de terceros) | Sí (Solo cartera propia) | No (Oculto mientras está en borrador) | Actualiza al instante la lista de cotizaciones, el tablero Kanban y los KPIs del Admin y del Asesor asignado. Permanece invisible en el listado del Portal Cliente hasta su envío. |
| **Cotizaciones (Ítems Libres)** | Agregar partidas fuera de catálogo maestro | Sí | No (Bloqueado) | No | Recalcula totales y utilidad en tiempo real para Admin y Asesor; se refleja en el documento del Cliente una vez enviada la propuesta. |
| **Excepciones de Margen** | Solicitar excepción entre piso duro y margen mínimo | Sí | Sí (Motivo obligatorio) | No | Cambia el estado a pendiente de aprobación, bloquea el envío al Cliente y alerta en el panel del Admin para su resolución. |
| **Excepciones de Margen** | Aprobar o rechazar excepción de margen | Sí (Exclusivo) | No | No | Si se aprueba, habilita al Asesor para enviar la cotización; si se rechaza, devuelve la cotización a ajuste comercial y registra evento en Auditoría. |
| **Cotizaciones (Envío y Revisiones)** | Enviar cotización o generar nueva revisión versionada | Sí | Sí (Solo propias) | No | Habilita la cotización en el Portal Cliente, genera notificación en Bandeja Outbox, incrementa el contador de pendientes del Cliente y marca revisiones previas como obsoletas con aviso de redirección. |
| **Cotizaciones (Apertura / Lectura)** | Abrir propuesta comercial enviada | Sí (Previsualización sin alterar estado) | Sí (Previsualización sin alterar estado) | Sí (Dispara transición a Vista) | Cuando el Cliente abre una propuesta enviada, cambia automáticamente a estado Vista, registra la marca de tiempo y actualiza las tarjetas de Enviadas y Vistas en los paneles de Admin y Asesor. |
| **Cotizaciones (Decisión Comercial)** | Aceptar con firma digital, rechazar con motivo o pedir ajuste | Sí (Aceptación offline con OC o rechazo interno) | Sí (Aceptación offline con OC o rechazo interno) | Sí (En propuestas vigentes enviadas/vistas) | Al aceptar: bloquea ediciones futuras, autogenera Factura y Orden de Trabajo, registra firma SHA-256, notifica en Outbox y actualiza métricas de venta aceptada en Admin, Asesor y Cliente. Al pedir ajuste o rechazar: alerta al Asesor/Admin y actualiza el historial. |
| **Documentos de Cobro (Facturas)** | Emitir factura y registrar abonos o pagos parciales/totales | Sí (Todas) | Sí (Lectura de propias; registro según permiso) | Solo lectura (Estado de cuenta y detalle) | Recalcula saldos pendientes, estado del documento (Pendiente, Parcial, Pagada, Vencida) e hitos de pago en el Portal Cliente y en los tableros financieros de Admin y Asesor. |
| **Órdenes de Trabajo (Operaciones)** | Crear orden, actualizar hitos técnicos, guía y entregables | Sí (Todas) | Lectura y creación sobre propias | Solo lectura (Progreso e hitos en vivo) | El cambio de estado en los hitos recalcula automáticamente el porcentaje de avance y actualiza la barra de progreso y estado de entrega en el Portal Cliente y en el resumen de Admin/Asesor. |
| **Clientes y Contactos** | Crear/editar clientes, contactos y enviar enlace mágico | Sí (Incluye desactivación) | Sí (Creación, edición y enlace mágico) | No (Visualiza sus propios datos corporativos) | Sincroniza el selector de clientes en el generador de cotizaciones para Admin y Asesor, y emite el enlace de acceso en la Bandeja Outbox para ingreso directo al Portal Cliente. |
| **Catálogo Maestro y Categorías** | Crear, editar precios/costos y desactivar ítems | Sí (Control total) | Solo lectura (Consulta de precios y márgenes) | No (Solo ve líneas incluidas en sus ofertas) | Actualiza de inmediato la tabla de catálogo del Asesor y los costos/precios de lista disponibles al estructurar nuevas líneas de cotización. |
| **Configuración de Empresa y Margen** | Editar datos tributarios, IVA, tasa UF, margen mínimo y piso duro | Sí (Exclusivo) | Solo lectura | Solo lectura (Membrete e impuestos en ofertas) | Propaga las nuevas reglas de margen mínimo, tasa UF e IVA al motor de cálculo de cotizaciones del Asesor y actualiza los encabezados corporativos en las vistas del Cliente. |
| **Equipo, Auditoría y Outbox** | Gestionar usuarios, auditar trazabilidad y reenviar correos | Sí (Global) | Lectura propia en Auditoría y Outbox | Lectura de su Línea de Tiempo | Cada acción relevante en cualquiera de los tres portales alimenta de forma reactiva la Auditoría interna, la Bandeja Outbox y la Línea de Tiempo del Cliente. |

---

## 3. Auditoría de Brechas y Estado Compartido

El análisis exhaustivo del código actual reveló seis brechas críticas de sincronización y consistencia de estado entre los tres portales:

1. **Contaminación de Sesión entre Pestañas por Uso Compartido de `localStorage`**:
   - **Hallazgo**: El cliente HTTP almacena y lee el token y el usuario activo en `localStorage` como fuente prioritaria. Si se abre una pestaña como Administrador y otra pestaña como Cliente o Asesor, el último inicio de sesión o cambio de rol sobrescribe `localStorage`. Al recargar o ejecutar acciones que revalidan sesión, la pestaña original adopta silenciosamente la identidad de la otra pestaña.
   - **Impacto**: Pérdida de aislamiento entre portales al realizar pruebas o trabajo simultáneo en múltiples pestañas.

2. **Falta de Re-hidratación de Estado al Alternar entre Admin y Asesor en la Misma Pestaña**:
   - **Hallazgo**: Cuando el usuario utiliza el selector rápido superior para alternar entre Admin y Asesor mientras se encuentra en vistas internas, el contenedor principal permanece montado y varios hooks de datos (`useQuotations`, `useInvoices`, `useOperations`, `useCustomers`, `useCompany`, `useAudit`, `useOutbox`) no incluyen el identificador ni el rol del usuario activo en sus dependencias de efecto.
   - **Impacto**: El portal muestra temporalmente datos en memoria pertenecientes al rol anterior hasta que el usuario cambia de ruta o recarga manualmente.

3. **Cobertura Incompleta del Bus de Sincronización (Limitado Solo a Cotizaciones)**:
   - **Hallazgo**: Actualmente solo existe el evento `cotizador_quotations_sync`, al cual únicamente están suscritos el listado de cotizaciones (`useQuotations`) y el Portal Cliente (`ClientPortal`).
   - **Impacto**:
     - El Panel General (`useDashboard`) de Admin y Asesor no se actualiza automáticamente cuando un Cliente abre, acepta, rechaza o solicita ajustes en una cotización desde otra pestaña.
     - Los módulos de Facturación (`useInvoices`), Operaciones (`useOperations`), Catálogo (`useCatalog`), Clientes (`useCustomers`), Empresa (`useCompany`), Auditoría (`useAudit`) y Bandeja Outbox (`useOutbox`) no emiten ni escuchan eventos de sincronización, dejando datos desactualizados entre portales tras registrar pagos, avanzar hitos operativos o aprobar márgenes.

4. **Ceguera Reactiva en la Vista Pública de Propuesta (`PublicQuotationView`)**:
   - **Hallazgo**: El visor de propuesta individual no está suscrito a eventos de sincronización.
   - **Impacto**: Si un Asesor o Admin emite una nueva revisión, aprueba o actualiza una cotización mientras el Cliente tiene abierta la propuesta en pantalla, el Cliente no recibe la actualización reactiva ni el aviso inmediato de que existe una revisión más reciente vigente.

5. **Asimetría de Filtrado por Rol en Endpoints de Cotizaciones y KPIs del Pipeline**:
   - **Hallazgo**: Mientras que el resumen del Dashboard, Facturas y Operaciones filtran estrictamente por el identificador del Asesor (`SALES_REP`) en el servidor, la consulta general de cotizaciones y sus KPIs devuelven el listado global si el frontend no inyecta parámetros adicionales.
   - **Impacto**: Desfase entre los números que el Asesor observa en sus tarjetas de resumen ejecutivo (alcance personal) frente a los totales mostrados en la pestaña de cotizaciones y pipeline.

6. **Riesgo de Colisión de Edición y Sobrescritura Concurrente**:
   - **Hallazgo**: Si un Asesor mantiene abierto el asistente de edición de una cotización o ejecuta una transición manual mientras el Cliente ya interactuó con la oferta (o mientras otro usuario generó una nueva revisión), no se valida la versión previa (`updatedAt` / `revision`) ni se bloquean acciones sobre revisiones superadas (`isLatestRevision === false`).
   - **Impacto**: Posibles conflictos de estado o intentos de edición sobre propuestas que ya cambiaron de etapa comercial.

---

## 4. Plan de Implementación Paso a Paso

### Fase 1: Bus Unificado de Sincronización Multicanal y Aislamiento de Sesión por Pestaña
1. **Aislamiento de Credenciales por Pestaña**:
   - Actualizar la gestión de sesión en el cliente API para que cada pestaña almacene y lea prioritariamente su identidad activa y token desde `sessionStorage` (con respaldo controlado para inicialización), garantizando que una pestaña de Admin, una de Asesor y una de Cliente puedan coexistir en el mismo navegador sin sobrescribir sus sesiones mutuas.
   - Emitir un evento interno de cambio de identidad (`auth_user_changed`) cada vez que se inicie sesión, se cierre sesión o se utilice el selector rápido de portales.
2. **Creación del Bus de Sincronización de Dominio (`BroadcastChannel` + `storage` + `CustomEvent`)**:
   - Reemplazar el evento único de cotizaciones por un bus de sincronización tipado que soporte canales por dominio (`quotations`, `invoices`, `operations`, `catalog`, `customers`, `company`, `audit`, `outbox`, `all`).
   - Propagar cada mutación exitosa simultáneamente por tres vías: `CustomEvent` (para componentes montados en la misma pestaña), `BroadcastChannel` (comunicación instantánea entre pestañas/ventanas de Admin, Asesor y Cliente) y marca temporal en `localStorage` (respaldo universal de eventos `storage`).

### Fase 2: Sincronización Reactiva Total en Hooks Internos, Portal Cliente y Vista Pública
1. **Suscripción de Todos los Hooks de Datos al Bus y al Usuario Activo**:
   - Conectar `useDashboard`, `useQuotations`, `useInvoices`, `useOperations`, `useCatalog`, `useCustomers`, `useCompany`, `useAudit`, `useOutbox` y `useTeam` al nuevo bus de sincronización y al cambio de usuario activo (`user.id` / `user.role`).
   - Incorporar refresco silencioso en segundo plano (sin parpadeo de esqueletos de carga) cuando se reciba un evento del bus o cuando la ventana recupere el foco, manteniendo un sondeo ligero en las vistas operativas cuando la pestaña esté visible.
2. **Emisión Automática de Eventos tras Mutaciones en Todos los Portales**:
   - Disparar notificaciones de sincronización al crear/editar/enviar/duplicar/versionar cotizaciones, aprobar o rechazar excepciones de margen, aceptar/rechazar propuestas, registrar pagos de facturas, actualizar hitos de órdenes de trabajo, modificar ítems de catálogo, editar configuración de empresa y gestionar clientes/contactos.
3. **Sincronización en Vivo en la Vista Pública de Cotización**:
   - Suscribir la vista de propuesta individual al bus de eventos para que, si un Asesor o Admin genera una nueva revisión o cambia el estado mientras el Cliente visualiza el documento, la vista se actualice automáticamente y muestre el banner de nueva revisión disponible o el estado actualizado.

### Fase 3: Consistencia de Alcance por Rol y Control de Concurrencia (Anti-Colisiones)
1. **Alineación de Alcance Comercial para el Rol Asesor (`SALES_REP`)**:
   - Asegurar que tanto el resumen ejecutivo, las métricas del pipeline, el listado de cotizaciones y los seguimientos respeten de manera uniforme el alcance del rol activo (global para `ADMIN`, cartera propia para `SALES_REP`), refrescándose de inmediato al alternar de rol.
2. **Control de Concurrencia Optimista y Bloqueo sobre Revisiones Obsoletas**:
   - Validar en el servidor y en la interfaz que ninguna cotización cuya revisión haya sido superada (`isLatestRevision === false`) pueda ser aceptada, rechazada o editada, redirigiendo siempre a la revisión vigente.
   - Incorporar validación de versión/estado previo (`expectedUpdatedAt` / `expectedStatus`) al guardar cambios o ejecutar decisiones sobre una cotización; si otro portal modificó la cotización mientras estaba abierta, bloquear la sobrescritura con un código de conflicto (`409 Conflict`), informar al usuario y refrescar los datos en pantalla.

### Fase 4: Verificación Integral y Pruebas Automatizadas
1. **Pruebas Unitarias y de Integración**:
   - Añadir pruebas automatizadas que verifiquen:
     - El aislamiento de sesión en `sessionStorage` frente a eventos de sincronización en `BroadcastChannel` / `localStorage`.
     - La propagación de eventos entre dominios (aceptación de cliente -> actualización de dashboard, facturas y operaciones).
     - El bloqueo de colisiones de edición (`409 Conflict` / estado modificado concurrentemente y bloqueo de decisiones en revisiones antiguas).
2. **Validación de Compilación y Linter**:
   - Ejecutar la suite completa de tests, linter y compilación de producción para confirmar cero regresiones.
