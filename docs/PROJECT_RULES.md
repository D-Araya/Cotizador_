# Reglas del proyecto (releer al comenzar CADA tarea)

## Stack fijo (no cambiar)
Cliente: Vite + React 19 + Tailwind 4 + TypeScript. Servidor: Express 4 en `server.ts` (BFF). Dinero: decimal.js. IA: @google/genai (solo en el servidor).
PROHIBIDO: Next.js, Prisma, PostgreSQL, Docker, cambiar de framework o de gestor de paquetes. Se pueden añadir paquetes npm pequeños y justificados (por ejemplo zod, helmet, express-rate-limit, react-router-dom, firebase-admin).

## Plataforma (AI Studio)
- El servidor escucha en 0.0.0.0:3000. No cambiar el puerto ni el host.
- No tocar el bloque HMR/watch de `vite.config.ts` (lleva un comentario de "no modificar").
- Los secretos solo viven en el panel de Secrets y se leen de `process.env` en el servidor. Nunca en el cliente ni en el código.
- Los nombres de modelos Gemini se leen de variables de entorno, con el valor actual como default. No inventar nombres de modelo.
- Si algo no es posible en la plataforma, DILO. No simules persistencia, envíos de correo ni autenticación con datos falsos.

## Método de trabajo
- Ediciones quirúrgicas. No regeneres archivos completos ni reescribas lo que funciona.
- Si un archivo supera ~800 líneas, extrae partes a archivos nuevos en lugar de reescribirlo entero.
- Un cambio, un propósito. Tras cada tarea, comprueba que la app compila y que el preview carga.
- Cada fase termina con: (1) archivos creados/modificados, (2) qué verificaste y cómo, (3) qué NO pudiste verificar, (4) pasos manuales para que el usuario pruebe.

## Dominio
Empresa de ingeniería naval en Chile. Moneda CLP sin decimales. IVA tomado de `company.taxRatePct` (hoy 19 %). RUT chileno con validación módulo 11. Teléfonos +56. Interfaz en español de Chile; identificadores de código en inglés.
No usar "factura": llamar "Documento de cobro" a lo que el sistema emite, hasta que exista integración con un proveedor de documentos tributarios electrónicos.

## Dinero (una sola fuente de verdad)
Una única función `computeTotals` en `src/shared-kernel/pricing/`, usada por cliente y servidor. Reglas: Decimal siempre; margen sobre precio de venta; precio unitario redondeado HACIA ARRIBA al peso; IVA sobre el neto total con redondeo half-up al peso; el margen se compara con el mínimo SIN redondeo previo. Prohibido calcular impuestos o totales en otro sitio.

## Invariantes de seguridad
- El cliente nunca envía: rol, identidad, costos, subtotales, customerId ni salesRepId. El servidor los deriva de la sesión y del catálogo.
- Autorización deny-by-default, con la matriz de `docs/CURRENT_STATE.md` (sección "Matriz objetivo").
- Ninguna respuesta pública ni del portal incluye costos, utilidad, margen, comentarios internos ni datos de otros clientes.
- Toda entrada se valida con zod. Los PATCH usan lista blanca de campos (nunca spread de req.body).
- Errores en formato application/problem+json, sin trazas ni mensajes internos.

## Calidad
Sin `any` nuevos. Sin código muerto nuevo. Los textos de interfaz no mencionan lo que no existe.
