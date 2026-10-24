# Registro Oficial de Datos Semilla (Mock / Seed Data) — Área de Ingeniería en Chile

Este documento detalla de manera exhaustiva y transparente todos los **datos semilla y ficticios (mock data)** cargados por defecto en el sistema **Cotizador Online**, adaptados específicamente al **Área de la Ingeniería y Consultoría Técnica en Chile** (especialidad en Ingeniería Naval, Proyectos Marítimos, Peritajes Estructurales y Suministros Técnicos).

> ⚠️ **Aviso de Privacidad y Simulación:**  
> Todos los nombres comerciales, personas, números de Rol Único Tributario (RUT / RUN), direcciones físicas, números de teléfono, correos electrónicos, cuentas bancarias y transacciones comerciales contenidos en esta lista son **100% ficticios y simulados**. Han sido diseñados con fines exclusivos de demostración técnica, pruebas funcionales, evaluación de interfaz (UI/UX) y validación de reglas de negocio en la plataforma.

---

## Índice de Entidades Simuladas
1. [Empresa Emisora Ficticia (Configuración Global)](#1-empresa-emisora-ficticia)
2. [Usuarios y Cuentas de Acceso Demo](#2-usuarios-y-cuentas-de-acceso-demo)
3. [Categorías del Catálogo de Ingeniería](#3-categorías-del-catálogo-de-ingeniería)
4. [Catálogo de Productos y Suministros Técnicos](#4-catálogo-de-productos-y-suministros-técnicos)
5. [Catálogo de Servicios Profesionales de Ingeniería](#5-catálogo-de-servicios-profesionales-de-ingeniería)
6. [Cartera de Clientes Corporativos Chilenos](#6-cartera-de-clientes-corporativos-chilenos)
7. [Contactos de Clientes Chilenos](#7-contactos-de-clientes-chilenos)
8. [Cotizaciones Iniciales Semilla (30 Registros)](#8-cotizaciones-iniciales-semilla-30-registros)
9. [Facturas Electrónicas Simuladas (Chile - SII)](#9-facturas-electrónicas-simuladas-chile---sii)
10. [Órdenes de Operación y Peritaje Técnico en Terreno](#10-órdenes-de-operación-y-peritaje-técnico-en-terreno)
11. [Bandeja Outbox de Mensajería Simulada](#11-bandeja-outbox-de-mensajería-simulada)
12. [Criterio de Identificación: Datos Semilla vs. Datos Creados en Vivo](#12-criterio-de-identificación)

---

## 1. Empresa Emisora Ficticia

Datos corporativos de la firma de ingeniería que emite las cotizaciones y facturas electrónicas:

| Campo | Valor Simulado | Nota Técnica |
|---|---|---|
| **ID** | `comp-01` | Identificador único estático |
| **Nombre Comercial** | `M&L Ingeniería Naval SpA` | Nombre de fantasía para propuestas y encabezados |
| **Razón Social** | `M&L Ingeniería Naval y Servicios Marítimos SpA` | Razón social constituida en Chile |
| **RUT Simulado** | `77.892.410-K` | Formato legal chileno con dígito verificador |
| **Dirección Casa Matriz** | `Av. Angelmó 1450, Of. 402, Puerto Montt, Región de Los Lagos, Chile` | Ubicación estratégica sector austral |
| **Teléfono Central** | `+56 65 290 8400` | Red fija de la Región de Los Lagos (+56 65) |
| **Email Corporativo** | `contacto@mlingenieria.cl` | Buzón institucional |
| **Moneda Base** | `CLP` (Pesos Chilenos - `$`) | Moneda oficial del mercado nacional |
| **Tasa de Impuesto (IVA)** | `19.0%` | Impuesto al Valor Agregado en Chile (D.L. 825) |
| **Margen Mínimo Técnico** | `28.0%` | Umbral inviolable por la regla de negocio `MarginPolicy` |
| **Validez de Sesión** | `60` minutos | Tiempo de expiración de sesión |

---

## 2. Usuarios y Cuentas de Acceso Demo

Usuarios precargados para iniciar sesión con 1 clic en la pantalla de inicio `/login`:

| ID | Nombre Simulado & Especialidad | Email Demo | Rol | Contraseña Demo | Teléfono Móvil | Empresa Asignada |
|---|---|---|---|---|---|---|
| `usr-admin-01` | Victoria Villegas Cárcamo (Gerente General & Ing. Naval) | `admin@mlingenieria.cl` | `ADMIN` | `admin123` | +56 9 8765 4321 | M&L Ingeniería Naval SpA |
| `usr-sales-01` | Sebastián Morales (Ingeniero Naval de Proyectos) | `smorales@mlingenieria.cl` | `SALES_REP` | `sales123` | +56 9 9123 4567 | M&L Ingeniería Naval SpA |
| `usr-sales-02` | Camila Soto (Ingeniera Calculista) | `csoto@mlingenieria.cl` | `SALES_REP` | `sales123` | +56 9 8456 7890 | M&L Ingeniería Naval SpA |
| `usr-sales-03` | Felipe Muñoz (Ingeniero Inspector Naval) | `fmunoz@mlingenieria.cl` | `SALES_REP` | `sales123` | +56 9 7321 6540 | M&L Ingeniería Naval SpA |
| `usr-client-01` | Ing. Matías Barrientos (Gerente de Operaciones y Flota) | `mbarrientos@australsalmon.cl` | `CUSTOMER_CONTACT` | `cliente123` | +56 9 7654 3210 | `cust-01` (Austral Salmón & Mar) |

---

## 3. Categorías del Catálogo de Ingeniería

| ID | Nombre de Categoría | Descripción Técnica | Estado |
|---|---|---|---|
| `cat-01` | Diseño y Planos Navales | Líneas de formas, disposición general, mamparos y compartimentado en AutoCAD / Rhino | Activa |
| `cat-02` | Estudios de Estabilidad y Arqueo | Estabilidad sin avería y en avería, pruebas de inclinación bajo DIRECTEMAR / SOLAS | Activa |
| `cat-03` | Cálculos y Análisis Técnicos | Escantillonado estructural, potencia propulsiva, análisis por elementos finitos (FEA) | Activa |
| `cat-04` | Inspecciones Técnicas y Asesoría | Medición de espesores ultrasonido (NDT), peritajes de casco y tramitaciones marítimas | Activa |
| `cat-05` | Apoyo Técnico a Obra y Suministros | Supervisión en astilleros y suministros navales certificados (ánodos, válvulas, planchas) | Activa |

---

## 4. Catálogo de Productos y Suministros Técnicos

6 suministros navales y de obra estructural con estándares IACS / ASTM:

| ID | SKU Simulado | Nombre del Producto | Marca | Unidad | Costo (CLP) | Precio Lista (CLP) | Margen |
|---|---|---|---|---|---|---|---|
| `prod-01` | `ANOD-ZN-5K5` | Kit de Ánodos de Sacrificio Zinc para Casco 5.5 kg | Cathodic Marine | UND | $ 28.000 | $ 42.000 | 33.33% |
| `prod-02` | `ANOD-AL-8KG` | Ánodo de Soldar Aluminio para Embarcaciones de Cultivo 8 kg | Cathodic Marine | UND | $ 35.000 | $ 52.000 | 32.69% |
| `prod-03` | `PL-ACERO-10MM` | Plancha de Acero Naval Certificado Grado A 10mm x 1500 x 6000 mm | CAP Acero Naval | UND | $ 480.000 | $ 680.000 | 29.41% |
| `prod-04` | `VALV-BRONCE-4P` | Válvula de Fondo de Bronce Naval Bridada 4" Tipo Globo | Marine Valves Co. | UND | $ 185.000 | $ 275.000 | 32.73% |
| `prod-05` | `BOMB-ACH-24V` | Bomba de Achique y Sentina Marina Sumergible 24V Heavy Duty | Rule Marine | UND | $ 140.000 | $ 210.000 | 33.33% |
| `prod-06` | `GRILL-G80-12T` | Juego de Grilletes y Cáncamos Forjados Grado 80 de 12 Toneladas | Crosby Marine | UND | $ 52.000 | $ 78.000 | 33.33% |

---

## 5. Catálogo de Servicios Profesionales de Ingeniería

8 servicios de consultoría, cálculo y peritaje naval según normativa de la Autoridad Marítima de Chile (DIRECTEMAR):

| ID | Código | Nombre del Servicio | Unidad | Duración Estimada | Costo (CLP) | Precio Lista (CLP) | Margen |
|---|---|---|---|---|---|---|---|
| `serv-01` | `SRV-ESTAB-01` | Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR | GLOBAL | 3 semanas | $ 1.800.000 | $ 2.600.000 | 30.77% |
| `serv-02` | `SRV-PRUEBA-INC` | Prueba de Inclinación y Medición de Calados en Terreno | GLOBAL | 2 días en terreno | $ 1.200.000 | $ 1.800.000 | 33.33% |
| `serv-03` | `SRV-PLANOS-DG` | Diseño y Elaboración de Planos Navales (Disposición y Formas) | GLOBAL | 4 semanas | $ 2.200.000 | $ 3.200.000 | 31.25% |
| `serv-04` | `SRV-ESCANT-01` | Cálculo de Escantillonado y Análisis Estructural según Clasificadora | GLOBAL | 2 semanas | $ 1.500.000 | $ 2.250.000 | 33.33% |
| `serv-05` | `SRV-INSP-CASCO` | Inspección Técnica de Condición de Casco y Espesores Ultrasonido | VISITA | 3 días | $ 950.000 | $ 1.450.000 | 34.48% |
| `serv-06` | `SRV-ASES-DIR` | Asesoría y Consultoría para Tramitación DIRECTEMAR | GLOBAL | 3 semanas | $ 800.000 | $ 1.250.000 | 36.00% |
| `serv-07` | `SRV-APOYO-OBRA` | Apoyo Técnico a Obra de Construcción y Reparación Naval | MES | 30 días | $ 2.400.000 | $ 3.600.000 | 33.33% |
| `serv-08` | `SRV-HORA-NAV` | Hora de Consultoría en Ingeniería Naval Especializada | HORA | Por requerimiento | $ 55.000 | $ 85.000 | 35.29% |

---

## 6. Cartera de Clientes Corporativos Chilenos

5 empresas mandantes de los sectores acuícola, marítimo y pesquero del sur austral:

| ID | Razón Social | RUT | Dirección Comercial | Asesor Asignado |
|---|---|---|---|---|
| `cust-01` | Austral Salmón & Mar SpA | `76.543.210-4` | Ruta 5 Sur Km 1025, Parque Industrial, Puerto Montt | Sebastián Morales (`usr-sales-01`) |
| `cust-02` | Naviera y Transportes del Sur Austral Ltda. | `77.210.980-3` | Av. Angelmó 1850, Puerto Montt, Región de Los Lagos | Sebastián Morales (`usr-sales-01`) |
| `cust-03` | Astillero y Maestranza Tenglo SpA | `76.890.123-5` | Caleta Anahuac s/n, Sector Isla Tenglo, Puerto Montt | Camila Soto (`usr-sales-02`) |
| `cust-04` | Pesquera Reloncaví & Patagonia SpA | `76.321.654-2` | Camino a Chinquihue Km 8.5, Calbuco, Región de Los Lagos | Camila Soto (`usr-sales-02`) |
| `cust-05` | Servicios Marítimos y Cabotaje Chiloé Ltda. | `77.654.321-1` | Sector Muelle Fiscal s/n, Castro, Chiloé | Felipe Muñoz (`usr-sales-03`) |

---

## 7. Contactos de Clientes Chilenos

6 contrapartes técnicas en las empresas clientes con acceso al Portal B2B:

| ID | Empresa Vinculada | Nombre Simulado | Cargo | Email Ficticio | Teléfono Móvil |
|---|---|---|---|---|---|
| `cont-01` | `cust-01` | Ing. Matías Barrientos | Gerente de Operaciones y Flota | `mbarrientos@australsalmon.cl` | +56 9 7654 3210 |
| `cont-02` | `cust-01` | Rodrigo Cárdenas | Subgerente de Mantenimiento Naval | `rcardenas@australsalmon.cl` | +56 9 8123 4567 |
| `cont-03` | `cust-02` | Capitán Fernando Almonacid | Jefe de Navegación y Flota Austral | `falmonacid@surtransporte.cl` | +56 9 9234 5678 |
| `cont-04` | `cust-03` | Ing. Esteban Paredes | Jefe Técnico de Varadero | `eparedes@astillerotenglo.cl` | +56 9 9345 6789 |
| `cont-05` | `cust-04` | Marcela Triviño | Gerente de Operaciones Pesqueras | `mtrivino@pesquerareloncavi.cl` | +56 9 9456 7890 |
| `cont-06` | `cust-05` | Daniel Subiabre | Superintendente de Flota de Cabotaje | `dsubiabre@cabotajechiloe.cl` | +56 9 9567 8901 |

---

## 8. Cotizaciones Iniciales Semilla (30 Registros)

El sistema genera automáticamente 30 cotizaciones correlativas (`COT-000001` a `COT-000030`):
- Montos valorizados en **Pesos Chilenos (CLP)** con desglose de subtotal neto e **IVA (19%)**.
- Todas las propuestas cumplen y superan el **margen mínimo corporativo del 28.00%**.
- Incorporan costos adicionales no gravados en la base (ej. viáticos de traslado a centros de cultivo o varaderos en Los Lagos / Aysén).
- Distribuidas a lo largo de los meses de 2026 para alimentar métricas, dashboard y calendario de actividades.
- Estados representativos: `ACCEPTED` (15), `VIEWED` (6), `SENT` (3), `DRAFT` (3), `REJECTED` (3).

---

## 9. Documentos de Cobro (Chile)

5 documentos de cobro emitidos como consecuencia de cotizaciones aprobadas (folios `DC-000001` a `DC-000005`):

| ID | Folio Documento | Cotización | Cliente Receptor | Emisión | Vencimiento | Total (CLP) | Estado | Medio de Pago / Glosa |
|---|---|---|---|---|---|---|---|---|
| `inv-01` | `DC-000001` | `COT-000001` | Austral Salmón & Mar SpA | 2026-09-05 | 2026-09-20 | $ 5.236.000 | `PAID` | Transferencia Banco Santander Cta. Cte. M&L |
| `inv-02` | `DC-000002` | `COT-000002` | Naviera y Transportes del Sur Austral | 2026-09-10 | 2026-09-25 | $ 6.485.500 | `PAID` | Transferencia Banco de Chile (15 días) |
| `inv-03` | `DC-000003` | `COT-000003` | Astillero y Maestranza Tenglo SpA | 2026-09-15 | 2026-10-05 | $ 4.284.000 | `PENDING` | Transferencia bancaria pendiente (Astillero) |
| `inv-04` | `DC-000004` | `COT-000007` | Austral Salmón & Mar SpA | 2026-09-20 | 2026-10-10 | $ 3.213.000 | `PENDING` | Documento de Cobro Electrónico Crédito 30 días |
| `inv-05` | `DC-000005` | `COT-000010` | Pesquera Reloncaví & Patagonia SpA | 2026-09-01 | 2026-09-25 | $ 2.356.200 | `OVERDUE` | Por regularizar en cobranza contable |

---

## 10. Órdenes de Operación y Peritaje Técnico en Terreno

5 órdenes de ejecución de ingeniería vinculadas a propuestas aceptadas:

| ID | Orden | Tipo | Cotización | Título de la Orden Técnica | Responsable Asignado | Estado | Avance |
|---|---|---|---|---|---|---|---|
| `op-01` | `OP-2026-0038` | `SERVICE_EXECUTION` | `COT-000001` | Ejecución de Prueba de Inclinación en Varadero | Victoria Villegas (Ingeniera Naval) | `COMPLETED` | **100%** |
| `op-02` | `OP-2026-0039` | `SERVICE_EXECUTION` | `COT-000001` | Modelado Hidrostático y Cuadernillo Estabilidad | Sebastián Morales & Camila Soto | `COMPLETED` | **100%** |
| `op-03` | `OP-2026-0045` | `SERVICE_EXECUTION` | `COT-000003` | Supervisión Técnica de Montaje y Soldadura en Casco | Felipe Muñoz (Ing. Inspector Naval) | `IN_PROGRESS` | **65%** |
| `op-04` | `OP-2026-0052` | `SERVICE_EXECUTION` | `COT-000007` | Medición de Espesores de Casco por Ultrasonido (NDT) | Equipo Peritajes M&L (Guía GD-000160) | `SCHEDULED` | **20%** |
| `op-05` | `OP-2026-0058` | `SERVICE_EXECUTION` | `COT-000007` | Tramitación de Expediente ante DIRECTEMAR | Victoria Villegas (Capitanía Puerto Montt) | `IN_PROGRESS` | **75%** |

---

## 11. Bandeja Outbox de Mensajería Simulada

| ID | Canal | Destinatario Simulado | Asunto / Extracto Técnico | Estado |
|---|---|---|---|---|
| `out-01` | `EMAIL` | `mbarrientos@australsalmon.cl` | *Propuesta Técnica COT-000001 - M&L Ingeniería Naval SpA* | `SENT` |
| `out-02` | `WHATSAPP` | `+56 9 7654 3210` | *Estimado Ing. Matías Barrientos, adjunto propuesta técnica DIRECTEMAR...* | `SENT` |

---

## 12. Criterio de Identificación: Datos Semilla vs. Datos Creados en Vivo

Para facilitar auditorías y mantención de datos:
- **Semilla:** IDs con guion corto e índice simple (`quot-1` a `quot-30`, `cust-01` a `cust-05`, `cont-01` a `cont-06`, `inv-01` a `inv-05`, `op-01` a `op-05`).
- **En Vivo (Usuario / Servidor):** Identificadores criptográficos únicos generados con UUIDv4 estándar (`crypto.randomUUID()`, ej. `quot-4f32e1...`, `cust-...`, `inv-...`), garantizando cero colisiones bajo alta concurrencia de transacciones concurrentes (S8).
