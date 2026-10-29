# RUNBOOK de Operaciones — Cotizador Online (M&L Ingeniería Naval)

Guía operativa para administradores, operadores técnicos y desarrolladores del sistema.

---

## 1. Secretos y Variables de Entorno Necesarias

El sistema opera bajo Node.js / Express BFF y Vite. Las variables de entorno requeridas deben configurarse en el panel de secretos de la plataforma o en el archivo `.env`:

| Variable | Requerida | Propósito / Descripción | Ejemplo / Valor por defecto |
|---|---|---|---|
| `SESSION_SECRET` | **Sí** (Producción) | Clave criptográfica para firmar JWTs y cookies de sesión HMAC SHA-256 | `c839f28a7b924...` (mínimo 32 caracteres) |
| `GEMINI_API_KEY` | Opcional | Clave para llamadas a Gemini (@google/genai) para análisis multimodal y chat | Obtenida desde Google AI Studio |
| `GEMINI_MODEL` | Opcional | Modelo de visión / extracción documental | `gemini-2.5-flash` |
| `PORT` | Opcional | Puerto del servidor Express BFF | `3000` (Fijo en AI Studio) |
| `SMTP_HOST` | Opcional | Servidor SMTP para despacho real de correos de cotizaciones | `smtp.resend.com` / `smtp.sendgrid.net` |
| `SMTP_PORT` | Opcional | Puerto SMTP | `587` o `465` |
| `SMTP_USER` | Opcional | Usuario o clave API del proveedor de correo | `resend` o `apikey` |
| `SMTP_PASS` | Opcional | Contraseña / API token del proveedor de correo | `re_12345...` |
| `SMTP_FROM` | Opcional | Dirección de correo remitente verificada | `cotizaciones@mlingenieria.cl` |

> **Nota de Seguridad (S6, S9):** En ausencia de `SESSION_SECRET` en desarrollo, el sistema genera una clave efímera segura de 256 bits al inicio. En producción, la ausencia de una clave persistente causará invalidación de sesiones tras cada reinicio del contenedor.

---

## 2. Cómo Crear el Primer Administrador (ADMIN)

El sistema soporta dos vías para la creación y provisión del usuario administrador:

### Opción A: Semilla Idempotente de Arranque (Seed)
Al iniciar una instancia vacía, el sistema provee las credenciales maestras:
- **Email:** `admin@mlingenieria.cl`
- **Contraseña:** `admin123`
- **Rol:** `ADMIN`
- **Permisos:** Matriz completa de permisos administrativos (gestión de empresa, margen mínimo, usuarios, catálogo, backups).

### Opción B: Creación Programática vía API (Requiere Staff Autenticado)
Un administrador existente puede aprovisionar nuevos administradores a través del endpoint protegido:
```http
POST /api/v1/users
Authorization: Bearer <TOKEN_ADMIN>
Content-Type: application/json

{
  "name": "Victoria Villegas Cárcamo",
  "email": "vvillegas@mlingenieria.cl",
  "password": "PasswordSegura2026!",
  "role": "ADMIN",
  "phone": "+56 9 8765 4321"
}
```
El servidor genera un salt criptográfico por usuario (`crypto.randomBytes(16)`) y almacena el hash PBKDF2 / SHA-512. Nunca se persisten contraseñas en texto plano (S9).

---

## 3. Respaldo y Restauración del Sistema (Backup & Restore)

### Descarga de Respaldo (Backup)
Solo usuarios con rol `ADMIN` pueden exportar el estado completo del sistema:
```http
GET /api/v1/system/backup
Authorization: Bearer <TOKEN_ADMIN>
```
**Sanitización Automática (S2):** El respaldo generado excluye expresamente `passwordHash`, `passwordSalt` y tokens mágicos del cliente para evitar exfiltración de credenciales.

### Restauración de Respaldo (Restore)
Para restaurar el estado del sistema tras un incidente o migración:
```http
POST /api/v1/system/restore
Authorization: Bearer <TOKEN_ADMIN>
Content-Type: application/json

{
  "company": { ... },
  "categories": [ ... ],
  "catalogItems": [ ... ],
  "customers": [ ... ],
  "contacts": [ ... ],
  "quotations": [ ... ],
  "invoices": [ ... ],
  "operations": [ ... ]
}
```
**Reglas de Seguridad y Validación (S2, S5):**
1. La carga útil es validada estrictamente contra el esquema `restoreBackupSchema` de Zod. Si el esquema está corrupto o alterado, la solicitud es rechazada con código `400 Bad Request (application/problem+json)`.
2. El endpoint requiere explícitamente token con rol `ADMIN`. Reps comerciales, clientes o solicitudes anónimas son rechazados con `403 Forbidden` o `401 Unauthorized`.
3. La colección `users` **no** es reemplazada por el archivo de respaldo para prevenir inyección de administradores espurios sin credenciales válidas.
4. Toda restauración queda registrada de forma inmutable en la bitácora de auditoría (`AuditService.logFromReq`).

---

## 4. Cómo se Envían Correos y Notificaciones (Outbox Pattern)

El sistema implementa el patrón de diseño **Transactional Outbox** (`OutboxService`):

1. **Encolado Transaccional:** Cuando un comercial emite una cotización (`POST /api/v1/quotations/:id/send`), la notificación se registra en la colección `outbox` con estado inicial:
   - `PENDING` si el canal es `EMAIL`.
   - `PENDING_MANUAL` si el canal es `WHATSAPP` (generando enlace formateado a la API de `wa.me`).
2. **Despacho de Correos:**
   - Si las variables `SMTP_HOST`, `SMTP_USER` y `SMTP_PASS` están presentes, el motor despacha el correo mediante `nodemailer` con plantilla HTML corporativa de M&L Ingeniería Naval.
   - Si no hay credenciales SMTP configuradas, el mensaje permanece en estado `PENDING` con el mensaje explícito: *"Envío no configurado (faltan credenciales SMTP)"*. **Nunca** se marca como `SENT` si no fue efectivamente transmitido (resolviendo el defecto histórico Q6).
3. **Reintentos y Auditoría:**
   - Administradores pueden consultar la bandeja en `/outbox` o `GET /api/v1/notifications`.
   - Si un envío falla (`FAILED`), el endpoint `POST /api/v1/notifications/:id/retry` permite reintentar el despacho hasta un máximo de 3 intentos (`maxAttempts: 3`).

---

## 5. Monitoreo y Diagnóstico

- **Salud del Sistema:** `GET /api/v1/system/status` devuelve uptime, memoria y recuento de registros.
- **Bitácora de Auditoría:** `GET /api/v1/audit-logs` o descarga en CSV (`GET /api/v1/audit-logs/export-csv`, protegido contra inyección de fórmulas RFC 4180).
- **Pruebas y Verificación:** Ejecutar `npm test` para verificar los 196 tests automatizados de la suite.
