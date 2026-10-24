# Estado actual verificado (auditoría previa)

## Defectos de seguridad confirmados
S1 El login acepta cualquier contraseña; no hay sesión. La identidad sale de cabeceras x-user-* que envía el cliente.
S2 Casi ningún endpoint comprueba rol. Se puede cambiar el margen mínimo, promover usuarios a ADMIN, descargar el backup o restaurar uno que inyecte un administrador, sin credenciales.
S3 El portal filtra por ?customerId= enviado por el cliente. Se leen datos de otros clientes.
S4 El enlace público devuelve la cotización interna completa: costos, utilidad, margen, historial con comentarios internos y datos del asesor.
S5 El servidor confía en el costo y los subtotales de cada línea que envía el cliente. El margen mínimo se evade. El cambio manual de estado permite pasar un borrador vacío a ACCEPTED y generar un documento de total 0, o reabrir una aceptada.
S6 Endpoints de Gemini sin autenticación, con modelo elegido por el cliente y cuerpo de hasta 20 MB.
S7 Datos solo en memoria: se pierden al reiniciar.
S8 Ids con Date.now() (colisionan: 22 únicos de 30 creaciones concurrentes). Token público con Math.random, sin expiración.
S9 Contraseñas temporales en claro y estáticas ("Temporal2026!"); el CSV de auditoría permite inyección de fórmulas; sin helmet ni rate limit; sin manejador global de errores.

## Incoherencias entre los tres paneles
C1 El portal y la vista pública muestran al cliente comentarios internos del historial.
C2 Las cotizaciones creadas por el Administrador no aparecen en el reporte por asesor; los totales no cuadran.
C3 El personal puede aceptar o rechazar en nombre del cliente, sin evidencia.
C4 Residuos de otro dominio y país: órdenes "Servicios TI", "Despacho de Equipamiento", teléfono +51, mensajes con "RUC", etiquetas IGV 18 %, `PEN`.
C5 Se emiten "facturas" F001-… (formato peruano) sin base tributaria chilena.
C6 El pago tiene un solo estado, pero los términos dicen "50 % anticipo, 50 % contra entrega". El método de pago está fijo.
C7 Código huérfano: `handleGenerateInvoiceForQuotation`; el botón "Probar Panel Comercial" usa correos inexistentes.
C8 El portal no permite pedir ajustes, comentar ni descargar un PDF.
C9 Admin y Comercial son casi idénticos: el Comercial ve todas las cotizaciones y todo el dashboard, y puede editar costos y precios del catálogo.

## Defectos de calidad
Q1 InternalApp.tsx tiene ~4.100 líneas y ~98 hooks. Un solo bundle de 559 kB.
Q2 13 peticiones en cada recarga, sin paginación. Sesión solo en memoria y sin router (recargar cierra la sesión).
Q3 10 de 117 tests fallan (semilla antigua). Los componentes de UI tienen 0 % de cobertura.
Q4 Sin accesibilidad básica (labels sin htmlFor, modales sin role="dialog").
Q5 El README contradice el código (cookies, arquitectura hexagonal, rutas /app y /portal inexistentes, moneda, credenciales).
Q6 Las notificaciones se marcan "SENT" sin enviar nada.

## Matriz objetivo de permisos
Recurso | ADMIN | SALES_REP | CLIENT (contacto del cliente)
Cotizaciones | todas | solo las suyas | solo las de su empresa, no borradores, vista sin costos
Clientes y contactos | crear, editar, dar de baja | crear y editar (no dar de baja) | no
Catálogo | crear, editar, dar de baja | solo lectura (con costo, para calcular margen) | no
Empresa y margen mínimo | editar | solo lectura | no
Usuarios del equipo | gestionar | no | no
Documentos de cobro | ver, registrar pagos | ver los de sus cotizaciones | ver los de su empresa
Órdenes de trabajo | todas | las de sus cotizaciones | las de su empresa (solo lectura)
Auditoría | toda | solo sus acciones | no
Bandeja de salida | toda | solo la suya | no
Backup y restauración | sí | no | no
Dashboard | global y por asesor | personal | resumen de su empresa
IA (Gemini) | sí | sí | no
Decidir aceptar/rechazar/pedir ajuste | no (salvo aceptación offline con evidencia) | no (salvo aceptación offline con evidencia) | sí, solo con su enlace
