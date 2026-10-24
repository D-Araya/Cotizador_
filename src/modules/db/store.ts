import {
  User,
  Customer,
  Contact,
  Category,
  CatalogItem,
  CompanySettings,
  Quotation,
  OutboxMessage,
  QuotationLine,
  ExtraCostLine,
  StatusHistoryEntry,
  Invoice,
  OperationOrder,
  AuditLog,
  QuotationTemplate,
} from '../types.ts';
import { MarginPolicy } from '../../shared-kernel/pricing/MarginPolicy.ts';

export interface DatabaseState {
  users: User[];
  customers: Customer[];
  contacts: Contact[];
  categories: Category[];
  catalogItems: CatalogItem[];
  company: CompanySettings;
  quotations: Quotation[];
  outbox: OutboxMessage[];
  invoices: Invoice[];
  operations: OperationOrder[];
  auditLogs: AuditLog[];
  templates: QuotationTemplate[];
  sequenceNumber: number;
}

// Initial Company Data
export const initialCompany: CompanySettings = {
  id: 'comp-01',
  name: 'M&L Ingeniería Naval SpA',
  legalName: 'M&L Ingeniería Naval y Servicios Marítimos SpA',
  rut: '77.892.410-2',
  address: 'Puerto Montt, Región de Los Lagos, Chile',
  phone: '+56 65 290 8400',
  email: 'contacto@mlingenieria.cl',
  currency: 'CLP',
  taxRatePct: 19.0,
  minMarginPct: 28.0,
  hardMinMarginPct: 18.0,
  ufRate: 38500.0,
  defaultPresentationText:
    'Es un agrado presentarle nuestra propuesta técnica y económica para los servicios de ingeniería naval y marítima requeridos. En M&L Ingeniería Naval SpA desarrollamos proyectos con alta rigurosidad técnica, plazos de entrega comprometidos y estricto apego a las normativas de DIRECTEMAR, SOLAS y Casas Clasificadoras, atendiendo los sectores acuícola, pesquero y de transporte marítimo del sur austral de Chile.',
  defaultTerms:
    '1. Valores expresados en Pesos Chilenos (CLP) netos, más IVA (19%).\n2. Forma de pago: 50% de anticipo al inicio de los trabajos y 50% contra entrega conforme de planos visados o memoria técnica aprobada.\n3. Plazos de entrega: Según cronograma técnico acordado (habitual 2 a 6 semanas según envergadura del proyecto y revisiones).\n4. Entregables: Planos en formato digital DWG y PDF alta resolución firmados por Ingeniero Naval colegiado, memoria de cálculo y cuadernillo de estabilidad para tramitación DIRECTEMAR.\n5. Validez de la cotización: 15 días hábiles a contar de su fecha de emisión.',
  sessionTimeoutMinutes: 60,
  lossReasons: ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro'],
  pipelineProbabilities: {
    DRAFT: 10,
    SENT: 30,
    VIEWED: 50,
    CHANGES_REQUESTED: 40,
    ACCEPTED: 100,
    REJECTED: 0,
    EXPIRED: 0,
  },
};

// Initial Users con hash scrypt seguro (clave por defecto: admin123)
const DEFAULT_SALT = 'ml_seed_salt_2026';
const DEFAULT_HASH = '032362d6f69a5d869462e6184e0d4dff031a46ca3760852cb20c127c5a4ab536a9baa99c46e5811622ba34269feed9cf43d6ee2d1ba29f00e0a3950e67474feb';

export const initialUsers: User[] = [
  {
    id: 'usr-admin-01',
    email: 'admin@mlingenieria.cl',
    name: 'Victoria Villegas Cárcamo (Gerente General & Ingeniera Naval)',
    role: 'ADMIN',
    phone: '+56 9 8765 4321',
    active: true,
    passwordSalt: DEFAULT_SALT,
    passwordHash: DEFAULT_HASH,
  },
  {
    id: 'usr-sales-01',
    email: 'smorales@mlingenieria.cl',
    name: 'Sebastián Morales (Ingeniero Naval de Proyectos)',
    role: 'SALES_REP',
    phone: '+56 9 9123 4567',
    active: true,
    passwordSalt: DEFAULT_SALT,
    passwordHash: DEFAULT_HASH,
  },
  {
    id: 'usr-sales-02',
    email: 'csoto@mlingenieria.cl',
    name: 'Camila Soto (Ingeniera Calculista)',
    role: 'SALES_REP',
    phone: '+56 9 8456 7890',
    active: true,
    passwordSalt: DEFAULT_SALT,
    passwordHash: DEFAULT_HASH,
  },
  {
    id: 'usr-sales-03',
    email: 'fmunoz@mlingenieria.cl',
    name: 'Felipe Muñoz (Ingeniero Inspector Naval)',
    role: 'SALES_REP',
    phone: '+56 9 7321 6540',
    active: true,
    passwordSalt: DEFAULT_SALT,
    passwordHash: DEFAULT_HASH,
  },
  {
    id: 'usr-client-01',
    email: 'mbarrientos@australsalmon.cl',
    name: 'Ing. Matías Barrientos',
    role: 'CUSTOMER_CONTACT',
    phone: '+56 9 7654 3210',
    active: true,
    customerId: 'cust-01',
    contactId: 'cont-01',
  },
];

// Initial Categories
export const initialCategories: Category[] = [
  { id: 'cat-01', name: 'Diseño y Planos Navales', description: 'Diseño, desarrollo, elaboración y modificación de planos navales (formas, disposición general, estructura de casco)', active: true },
  { id: 'cat-02', name: 'Estudios de Estabilidad y Arqueo', description: 'Estudios de estabilidad sin avería y en avería, pruebas de inclinación y cuadernillos técnicos bajo DIRECTEMAR / SOLAS', active: true },
  { id: 'cat-03', name: 'Cálculos y Análisis Técnicos', description: 'Cálculos estructurales de escantillonado, potencia propulsiva, análisis de esfuerzo y resistencia de materiales', active: true },
  { id: 'cat-04', name: 'Inspecciones Técnicas y Asesoría', description: 'Inspecciones técnicas de condición de casco, medición de espesores por ultrasonido y consultoría ante la Autoridad Marítima', active: true },
  { id: 'cat-05', name: 'Apoyo Técnico a Obra y Suministros', description: 'Supervisión técnica de construcción y carena en astilleros, junto con suministros certificados (ánodos, planchas navales)', active: true },
];

// Initial Products & Services (Catalog)
export const initialCatalog: CatalogItem[] = [
  // Products / Suministros Navales
  {
    id: 'prod-01',
    type: 'PRODUCT',
    sku: 'ANOD-ZN-5K5',
    name: 'Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg',
    description: 'Ánodo de zinc de alta pureza ASTM B418 con alma de platina de acero soldable para protección catódica de cascos de acero',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'Cathodic Marine',
    unitCost: 28000,
    listPrice: 42000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'prod-02',
    type: 'PRODUCT',
    sku: 'ANOD-AL-8KG',
    name: 'Ánodo de Soldar Aluminio para Embarcaciones de Cultivo 8 kg',
    description: 'Ánodo de aleación aluminio-indio-zinc ideal para embarcaciones de acuicultura y ambientes de agua salobre austral',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'Cathodic Marine',
    unitCost: 35000,
    listPrice: 52000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'prod-03',
    type: 'PRODUCT',
    sku: 'PL-ACERO-10MM',
    name: 'Plancha de Acero Naval Certificado Grado A 10mm x 1500 x 6000 mm',
    description: 'Plancha estructural para casco y mamparos con certificado de calidad de fábrica trazable según norma IACS',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'CAP Acero Naval',
    unitCost: 480000,
    listPrice: 680000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'prod-04',
    type: 'PRODUCT',
    sku: 'VALV-BRONCE-4P',
    name: 'Válvula de Fondo de Bronce Naval Bridada 4" Tipo Globo',
    description: 'Válvula de toma de mar y descarga en bronce naval RG5 con volante ascendente, apta para inspección DIRECTEMAR',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'Marine Valves Co.',
    unitCost: 185000,
    listPrice: 275000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'prod-05',
    type: 'PRODUCT',
    sku: 'BOMB-ACH-24V',
    name: 'Bomba de Achique y Sentina Marina Sumergible 24V Heavy Duty',
    description: 'Capacidad 3700 GPH, carcasa termoplástica reforzada resistente a hidrocarburos y eje de acero inoxidable 316',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'Rule Marine',
    unitCost: 140000,
    listPrice: 210000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'prod-06',
    type: 'PRODUCT',
    sku: 'GRILL-G80-12T',
    name: 'Juego de Grilletes y Cáncamos Forjados Grado 80 de 12 Toneladas',
    description: 'Set certificado para maniobras de izaje y aseguramiento de naves en dique o varadero con factor de seguridad 4:1',
    categoryId: 'cat-05',
    unit: 'UND',
    brand: 'Crosby Marine',
    unitCost: 52000,
    listPrice: 78000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },

  // Services / Servicios Reales del Objeto Social M&L
  {
    id: 'serv-01',
    type: 'SERVICE',
    code: 'SRV-ESTAB-01',
    name: 'Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR',
    description: 'Realización de estudio de estabilidad sin avería y en avería según normativa DIRECTEMAR / SOLAS, modelado hidrostático 3D en Maxsurf y cuadernillo técnico.',
    categoryId: 'cat-02',
    unit: 'GLOBAL',
    estimatedDuration: '3 semanas',
    unitCost: 1800000,
    listPrice: 2600000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-02',
    type: 'SERVICE',
    code: 'SRV-PRUEBA-INC',
    name: 'Prueba de Inclinación y Medición de Calados en Terreno',
    description: 'Ejecución de prueba de inclinación en varadero o muelle, traslación de pesos sólidos, medición de péndulos, calados y determinación de centro de gravedad (KG, LCG).',
    categoryId: 'cat-02',
    unit: 'GLOBAL',
    estimatedDuration: '2 días en terreno',
    unitCost: 1200000,
    listPrice: 1800000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-03',
    type: 'SERVICE',
    code: 'SRV-PLANOS-DG',
    name: 'Diseño y Elaboración de Planos Navales (Disposición y Formas)',
    description: 'Diseño, desarrollo, elaboración y modificación de planos navales en AutoCAD/Rhino: líneas de formas, disposición general, mamparos y compartimentado.',
    categoryId: 'cat-01',
    unit: 'GLOBAL',
    estimatedDuration: '4 semanas',
    unitCost: 2200000,
    listPrice: 3200000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-04',
    type: 'SERVICE',
    code: 'SRV-ESCANT-01',
    name: 'Cálculo de Escantillonado y Análisis Estructural según Clasificadora',
    description: 'Cálculos y análisis técnicos de cuadernas, baos, varengas y planchas de casco conforme a reglas de Casas Clasificadoras (ABS, DNV, Lloyd\'s Register).',
    categoryId: 'cat-03',
    unit: 'GLOBAL',
    estimatedDuration: '2 semanas',
    unitCost: 1500000,
    listPrice: 2250000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-05',
    type: 'SERVICE',
    code: 'SRV-INSP-CASCO',
    name: 'Inspección Técnica de Condición de Casco y Espesores Ultrasonido',
    description: 'Inspecciones en materias de ingeniería naval y marítima: inspección visual de casco, timón y línea de ejes, medición de espesores en varadero y reporte técnico.',
    categoryId: 'cat-04',
    unit: 'VISITA',
    estimatedDuration: '3 días',
    unitCost: 950000,
    listPrice: 1450000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-06',
    type: 'SERVICE',
    code: 'SRV-ASES-DIR',
    name: 'Asesoría y Consultoría para Tramitación DIRECTEMAR',
    description: 'Asesorías, consultorías y asistencia técnica en ingeniería naval para regularizaciones de naves, modificaciones mayores y expedientes de aprobación.',
    categoryId: 'cat-04',
    unit: 'GLOBAL',
    estimatedDuration: '3 semanas',
    unitCost: 800000,
    listPrice: 1250000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-07',
    type: 'SERVICE',
    code: 'SRV-APOYO-OBRA',
    name: 'Apoyo Técnico a Obra de Construcción y Reparación Naval',
    description: 'Apoyo técnico para construcción, reparación, modificación y mantenimiento de embarcaciones en astilleros y maestranzas de la zona sur austral.',
    categoryId: 'cat-05',
    unit: 'MES',
    estimatedDuration: '30 días',
    unitCost: 2400000,
    listPrice: 3600000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'serv-08',
    type: 'SERVICE',
    code: 'SRV-HORA-NAV',
    name: 'Hora de Consultoría en Ingeniería Naval Especializada',
    description: 'Hora de asesoría y resolución de consultas técnicas por Ingeniero Naval colegiado (diseño, hidrostática, propulsión o modificación de naves).',
    categoryId: 'cat-04',
    unit: 'HORA',
    estimatedDuration: 'Por requerimiento',
    unitCost: 55000,
    listPrice: 85000,
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'kit-01',
    type: 'SERVICE',
    code: 'KIT-INSP-CARENA',
    name: 'Kit Integral de Carena y Medición de Espesores Ultrasonido',
    description: 'Servicio compuesto: Inspección pericial de casco y timón + Medición de espesores por ultrasonido + Asesoría técnica DIRECTEMAR.',
    categoryId: 'cat-04',
    unit: 'GLOBAL',
    estimatedDuration: '4 días en terreno',
    isKit: true,
    kitItems: [
      { catalogItemId: 'serv-05', quantity: 1 }, // unitCost: 950000, listPrice: 1450000
      { catalogItemId: 'serv-06', quantity: 1 }, // unitCost: 800000, listPrice: 1250000
    ],
    unitCost: 1750000, // 950000 + 800000
    listPrice: 2700000, // 1450000 + 1250000
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
];

// Initial Customers (Industrias Objetivo: Acuicultura, Transporte Austral, Astilleros y Pesca)
export const initialCustomers: Customer[] = [
  {
    id: 'cust-01',
    businessName: 'Austral Salmón & Mar SpA',
    taxId: '76.543.210-4',
    address: 'Ruta 5 Sur Km 1025, Parque Industrial, Puerto Montt, Región de Los Lagos',
    salesRepId: 'usr-sales-01',
    active: true,
    createdAt: '2026-09-02T09:00:00Z',
  },
  {
    id: 'cust-02',
    businessName: 'Naviera y Transportes del Sur Austral Ltda.',
    taxId: '77.210.980-3',
    address: 'Av. Angelmó 1850, Puerto Montt, Región de Los Lagos',
    salesRepId: 'usr-sales-01',
    active: true,
    createdAt: '2026-09-03T10:30:00Z',
  },
  {
    id: 'cust-03',
    businessName: 'Astillero y Maestranza Tenglo SpA',
    taxId: '76.890.123-5',
    address: 'Caleta Anahuac s/n, Sector Isla Tenglo, Puerto Montt',
    salesRepId: 'usr-sales-02',
    active: true,
    createdAt: '2026-09-05T14:15:00Z',
  },
  {
    id: 'cust-04',
    businessName: 'Pesquera Reloncaví & Patagonia SpA',
    taxId: '76.321.654-2',
    address: 'Camino a Chinquihue Km 8.5, Calbuco, Región de Los Lagos',
    salesRepId: 'usr-sales-02',
    active: true,
    createdAt: '2026-09-08T11:00:00Z',
  },
  {
    id: 'cust-05',
    businessName: 'Servicios Marítimos y Cabotaje Chiloé Ltda.',
    taxId: '77.654.321-1',
    address: 'Sector Muelle Fiscal s/n, Castro, Chiloé, Región de Los Lagos',
    salesRepId: 'usr-sales-03',
    active: true,
    createdAt: '2026-09-10T16:00:00Z',
  },
];

// Initial Contacts
export const initialContacts: Contact[] = [
  {
    id: 'cont-01',
    customerId: 'cust-01',
    name: 'Ing. Matías Barrientos',
    position: 'Gerente de Operaciones y Flota',
    email: 'mbarrientos@australsalmon.cl',
    phone: '+56 9 7654 3210',
    active: true,
    portalTokenHash: '5a69190d7de11a6e537639851053dbe4a624f24090862147a591a414b4e73b5c',
    portalTokenExpiresAt: '2027-12-31T23:59:59Z',
    portalTokenRevoked: false,
    createdAt: '2026-09-02T09:30:00Z',
  },
  {
    id: 'cont-02',
    customerId: 'cust-01',
    name: 'Rodrigo Cárdenas',
    position: 'Subgerente de Mantenimiento Naval',
    email: 'rcardenas@australsalmon.cl',
    phone: '+56 9 8123 4567',
    active: true,
    portalTokenRevoked: false,
    createdAt: '2026-09-02T09:35:00Z',
  },
  {
    id: 'cont-03',
    customerId: 'cust-02',
    name: 'Capitán Fernando Almonacid',
    position: 'Jefe de Navegación y Flota Austral',
    email: 'falmonacid@surtransporte.cl',
    phone: '+56 9 9234 5678',
    active: true,
    portalTokenRevoked: false,
    createdAt: '2026-09-03T11:00:00Z',
  },
  {
    id: 'cont-04',
    customerId: 'cust-03',
    name: 'Ing. Esteban Paredes',
    position: 'Jefe Técnico de Varadero',
    email: 'eparedes@astillerotenglo.cl',
    phone: '+56 9 9345 6789',
    active: true,
    portalTokenRevoked: false,
    createdAt: '2026-09-05T14:30:00Z',
  },
  {
    id: 'cont-05',
    customerId: 'cust-04',
    name: 'Marcela Triviño',
    position: 'Gerente de Operaciones Pesqueras',
    email: 'mtrivino@pesquerareloncavi.cl',
    phone: '+56 9 9456 7890',
    active: true,
    portalTokenRevoked: false,
    createdAt: '2026-09-08T11:30:00Z',
  },
  {
    id: 'cont-06',
    customerId: 'cust-05',
    name: 'Daniel Subiabre',
    position: 'Superintendente de Flota de Cabotaje',
    email: 'dsubiabre@cabotajechiloe.cl',
    phone: '+56 9 9567 8901',
    active: true,
    portalTokenRevoked: false,
    createdAt: '2026-09-10T16:30:00Z',
  },
];

// Seed generator for ~30 realistic quotations across past months
function generateSeedQuotations(): Quotation[] {
  const quotations: Quotation[] = [];
  const statuses: Array<'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED'> = [
    'ACCEPTED',
    'ACCEPTED',
    'ACCEPTED',
    'VIEWED',
    'SENT',
    'REJECTED',
    'ACCEPTED',
    'DRAFT',
    'VIEWED',
    'ACCEPTED',
  ];

  const salesReps = ['usr-sales-01', 'usr-sales-02', 'usr-sales-03', 'usr-sales-04'];
  const customerIds = ['cust-01', 'cust-02', 'cust-03', 'cust-04', 'cust-05'];

  for (let i = 1; i <= 30; i++) {
    const numStr = String(i).padStart(6, '0');
    const qNum = `COT-${numStr}`;
    const custId = customerIds[(i - 1) % customerIds.length];
    const contactsOfCust = initialContacts.filter((c) => c.customerId === custId);
    const contact = contactsOfCust[(i - 1) % contactsOfCust.length];
    const salesRepId = salesReps[(i - 1) % salesReps.length];
    const status = statuses[(i - 1) % statuses.length];

    // Dates across months: from 2026-01 up to 2026-09
    const month = ((i % 9) + 1).toString().padStart(2, '0');
    const day = ((i * 3) % 27 + 1).toString().padStart(2, '0');
    const createdAt = `2026-${month}-${day}T10:00:00Z`;

    // Pick 1-2 products and 1-2 services
    const p1 = initialCatalog[i % 5];
    const p2 = initialCatalog[(i + 2) % 10];
    const s1 = initialCatalog[10 + (i % 4)];
    const s2 = initialCatalog[10 + ((i + 2) % 8)];

    // Build quotation lines
    const line1Margin = 28.0;
    const line1Price = MarginPolicy.calculatePriceFromMargin(p1.unitCost, line1Margin);
    const line2Margin = 26.5;
    const line2Price = MarginPolicy.calculatePriceFromMargin(p2.unitCost, line2Margin);
    const line3Margin = 38.0;
    const line3Price = MarginPolicy.calculatePriceFromMargin(s1.unitCost, line3Margin);

    const lines: QuotationLine[] = [
      {
        id: `ql-${i}-1`,
        catalogItemId: p1.id,
        type: p1.type,
        skuOrCode: (p1 as any).sku,
        name: p1.name,
        unit: (p1 as any).unit,
        cost: p1.unitCost,
        price: line1Price,
        marginPct: line1Margin,
        quantity: (i % 3) + 1,
        subtotal: Number((line1Price * ((i % 3) + 1)).toFixed(2)),
        costTotal: Number((p1.unitCost * ((i % 3) + 1)).toFixed(2)),
      },
      {
        id: `ql-${i}-2`,
        catalogItemId: s1.id,
        type: s1.type,
        skuOrCode: (s1 as any).code,
        name: s1.name,
        unit: (s1 as any).unit,
        cost: s1.unitCost,
        price: line3Price,
        marginPct: line3Margin,
        quantity: 1,
        subtotal: line3Price,
        costTotal: s1.unitCost,
      },
    ];

    if (i % 2 === 0) {
      lines.push({
        id: `ql-${i}-3`,
        catalogItemId: p2.id,
        type: p2.type,
        skuOrCode: (p2 as any).sku,
        name: p2.name,
        unit: (p2 as any).unit,
        cost: p2.unitCost,
        price: line2Price,
        marginPct: line2Margin,
        quantity: 2,
        subtotal: Number((line2Price * 2).toFixed(2)),
        costTotal: Number((p2.unitCost * 2).toFixed(2)),
      });
    }

    const totals = MarginPolicy.calculateQuotationTotals(lines, 28.0);
    const subtotal = totals.totalSale;
    const taxAmount = Math.round(subtotal * 0.19);
    const grandTotal = subtotal + taxAmount;

    const extraCosts: ExtraCostLine[] = [];
    if (i % 3 === 0) {
      extraCosts.push({
        id: `ec-${i}-1`,
        type: 'SERVICE',
        name: 'Traslado técnico y viáticos a centro de cultivo / varadero en Los Lagos',
        unit: 'GLOBAL',
        cost: 150000,
        price: 220000,
        quantity: 1,
        subtotal: 220000,
        notes: 'Gastos operacionales de traslado marítimo/terrestre no gravados en la cotización base',
      });
    }

    const publicToken = `tok_${i}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;

    const history: StatusHistoryEntry[] = [
      {
        id: `hist-${i}-1`,
        fromStatus: null,
        toStatus: 'DRAFT',
        actor: 'Sistema',
        actorRole: 'SYSTEM',
        comment: 'Apertura de propuesta técnica preliminar de ingeniería naval',
        timestamp: createdAt,
      },
    ];

    if (status !== 'DRAFT') {
      history.push({
        id: `hist-${i}-2`,
        fromStatus: 'DRAFT',
        toStatus: 'SENT',
        actor: 'Sebastián Morales',
        actorRole: 'SALES_REP',
        comment: 'Propuesta técnica y comercial enviada al cliente por Email y WhatsApp',
        timestamp: `2026-${month}-${day}T11:00:00Z`,
      });
    }

    if (status === 'VIEWED' || status === 'ACCEPTED' || status === 'REJECTED') {
      history.push({
        id: `hist-${i}-3`,
        fromStatus: 'SENT',
        toStatus: 'VIEWED',
        actor: contact.name,
        actorRole: 'CUSTOMER_CONTACT',
        comment: 'El armador/cliente revisó la propuesta técnica en el portal en línea',
        timestamp: `2026-${month}-${day}T14:30:00Z`,
      });
    }

    if (status === 'ACCEPTED') {
      history.push({
        id: `hist-${i}-4`,
        fromStatus: 'VIEWED',
        toStatus: 'ACCEPTED',
        actor: contact.name,
        actorRole: 'CUSTOMER_CONTACT',
        comment: 'Propuesta técnica aprobada formalmente. Términos contractuales y cronograma aceptados.',
        timestamp: `2026-${month}-${day}T16:45:00Z`,
      });
    } else if (status === 'REJECTED') {
      history.push({
        id: `hist-${i}-4`,
        fromStatus: 'VIEWED',
        toStatus: 'REJECTED',
        actor: contact.name,
        actorRole: 'CUSTOMER_CONTACT',
        comment: 'Cliente decidió aplazar proyecto para el próximo ciclo de carena en astillero',
        timestamp: `2026-${month}-${day}T17:10:00Z`,
      });
    }

    quotations.push({
      id: `quot-${i}`,
      quotationNumber: qNum,
      customerId: custId,
      contactId: contact.id,
      salesRepId,
      status,
      createdAt,
      updatedAt: createdAt,
      validityDays: 15,
      publicToken,
      sentAt: status !== 'DRAFT' ? `2026-${month}-${day}T11:00:00Z` : undefined,
      validUntil: status !== 'DRAFT' ? `2026-${month}-${day}T23:59:59Z` : undefined,
      minMarginPctApplied: 28.0,
      presentationText: initialCompany.defaultPresentationText,
      notes: 'Los planos y memorias técnicas se entregarán en formato DWG y PDF firmados por Ingeniero Naval colegiado para tramitación DIRECTEMAR.',
      terms: initialCompany.defaultTerms,
      termsAccepted: status === 'ACCEPTED',
      acceptedAt: status === 'ACCEPTED' ? `2026-${month}-${day}T16:45:00Z` : undefined,
      rejectedAt: status === 'REJECTED' ? `2026-${month}-${day}T17:10:00Z` : undefined,
      lossReason: status === 'REJECTED' ? 'proyecto aplazado' : undefined,
      rejectionReason:
        status === 'REJECTED' ? 'Cliente decidió aplazar proyecto para el próximo ciclo de carena en astillero' : undefined,
      firstViewedAt:
        status === 'VIEWED' || status === 'ACCEPTED' || status === 'REJECTED'
          ? `2026-${month}-${day}T14:30:00Z`
          : undefined,
      nextActionAt:
        i === 4
          ? new Date().toISOString().split('T')[0] + 'T15:00:00Z' // Hoy
          : i === 5
          ? '2026-09-01T10:00:00Z' // Atrasada (overdue)
          : undefined,
      nextActionNote:
        i === 4
          ? 'Llamar a armador para seguimiento de planos de disposición general'
          : i === 5
          ? 'Reunión de aclaración sobre alcance de prueba de inclinación (vencida)'
          : undefined,
      lines,
      extraCosts,
      statusHistory: history,
      totalCost: totals.totalCost,
      totalSale: totals.totalSale,
      profit: totals.profit,
      marginPct: totals.marginPct,
      subtotal,
      taxAmount,
      grandTotal,
      extraCostsTotal: extraCosts.reduce((acc, ec) => acc + ec.subtotal, 0),
    });
  }

  return quotations;
}

// Initial Outbox Messages
export const initialOutbox: OutboxMessage[] = [
  {
    id: 'out-01',
    quotationId: 'quot-1',
    channel: 'EMAIL',
    recipient: 'mbarrientos@australsalmon.cl',
    recipientName: 'Ing. Matías Barrientos',
    subject: 'Propuesta Técnica COT-000001 - M&L Ingeniería Naval SpA',
    body: 'Estimado/a Ing. Matías Barrientos, adjuntamos la propuesta técnica para el estudio de estabilidad y prueba de inclinación conforme a normativas DIRECTEMAR.',
    status: 'SENT',
    retries: 0,
    createdAt: '2026-09-04T11:00:00Z',
    sentAt: '2026-09-04T11:00:15Z',
  },
  {
    id: 'out-02',
    quotationId: 'quot-1',
    channel: 'WHATSAPP',
    recipient: '+56 9 7654 3210',
    recipientName: 'Ing. Matías Barrientos',
    body: 'Estimado Ing. Matías Barrientos, le enviamos la cotización de ingeniería naval de M&L Ingeniería Naval. Puede revisarla y descargarla en el portal con el enlace enviado.',
    status: 'SENT',
    retries: 0,
    createdAt: '2026-09-04T11:00:00Z',
    sentAt: '2026-09-04T11:00:05Z',
  },
];

// Initial Invoices (Documentos de Cobro Chilenos vinculados a cotizaciones aprobadas)
export const initialInvoices: Invoice[] = [
  {
    id: 'inv-01',
    invoiceNumber: 'DC-000001',
    quotationId: 'quot-1',
    quotationNumber: 'COT-000001',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    customerTaxId: '76.543.210-4',
    issueDate: '2026-09-05',
    dueDate: '2026-09-20',
    subtotal: 4400000,
    taxAmount: 836000,
    total: 5236000,
    status: 'PAID',
    paymentMethod: 'Transferencia Banco Santander Cta. Cte. M&L Ingeniería Naval SpA',
    paymentTerms: '50% Anticipo y 50% contra entrega de Cuadernillo DIRECTEMAR',
    paidAt: '2026-09-18T15:20:00Z',
    items: [
      {
        id: 'inv-item-1',
        description: 'Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR',
        quantity: 1,
        unitPrice: 2600000,
        total: 2600000,
      },
      {
        id: 'inv-item-2',
        description: 'Prueba de Inclinación y Medición de Calados en Terreno',
        quantity: 1,
        unitPrice: 1800000,
        total: 1800000,
      },
    ],
  },
  {
    id: 'inv-02',
    invoiceNumber: 'DC-000002',
    quotationId: 'quot-2',
    quotationNumber: 'COT-000002',
    customerId: 'cust-02',
    customerBusinessName: 'Naviera y Transportes del Sur Austral Ltda.',
    customerTaxId: '77.210.980-3',
    issueDate: '2026-09-10',
    dueDate: '2026-09-25',
    subtotal: 5450000,
    taxAmount: 1035500,
    total: 6485500,
    status: 'PAID',
    paymentMethod: 'Transferencia Banco de Chile',
    paymentTerms: 'Crédito a 15 días tras entrega de planos visados',
    paidAt: '2026-09-24T11:45:00Z',
    items: [
      {
        id: 'inv-item-3',
        description: 'Diseño y Elaboración de Planos Navales (Disposición y Formas)',
        quantity: 1,
        unitPrice: 3200000,
        total: 3200000,
      },
      {
        id: 'inv-item-4',
        description: 'Cálculo de Escantillonado y Análisis Estructural según Clasificadora',
        quantity: 1,
        unitPrice: 2250000,
        total: 2250000,
      },
    ],
  },
  {
    id: 'inv-03',
    invoiceNumber: 'DC-000003',
    quotationId: 'quot-3',
    quotationNumber: 'COT-000003',
    customerId: 'cust-03',
    customerBusinessName: 'Astillero y Maestranza Tenglo SpA',
    customerTaxId: '76.890.123-5',
    issueDate: '2026-09-15',
    dueDate: '2026-10-05',
    subtotal: 3600000,
    taxAmount: 684000,
    total: 4284000,
    status: 'PENDING',
    paymentMethod: 'Transferencia bancaria pendiente (Astillero Tenglo)',
    paymentTerms: '50% contra visado de inspección de casco',
    items: [
      {
        id: 'inv-item-5',
        description: 'Apoyo Técnico a Obra de Construcción y Reparación Naval',
        quantity: 1,
        unitPrice: 3600000,
        total: 3600000,
      },
    ],
  },
  {
    id: 'inv-04',
    invoiceNumber: 'DC-000004',
    quotationId: 'quot-7',
    quotationNumber: 'COT-000007',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    customerTaxId: '76.543.210-4',
    issueDate: '2026-09-20',
    dueDate: '2026-10-10',
    subtotal: 2700000,
    taxAmount: 513000,
    total: 3213000,
    status: 'PENDING',
    paymentMethod: 'Documento de Cobro Electrónico Crédito 30 días',
    paymentTerms: 'Crédito 30 días fecha documento',
    items: [
      {
        id: 'inv-item-7',
        description: 'Inspección Técnica de Condición de Casco y Espesores Ultrasonido',
        quantity: 1,
        unitPrice: 1450000,
        total: 1450000,
      },
      {
        id: 'inv-item-8',
        description: 'Asesoría y Consultoría para Tramitación DIRECTEMAR',
        quantity: 1,
        unitPrice: 1250000,
        total: 1250000,
      },
    ],
  },
  {
    id: 'inv-05',
    invoiceNumber: 'DC-000005',
    quotationId: 'quot-10',
    quotationNumber: 'COT-000010',
    customerId: 'cust-04',
    customerBusinessName: 'Pesquera Reloncaví & Patagonia SpA',
    customerTaxId: '76.321.654-2',
    issueDate: '2026-09-01',
    dueDate: '2026-09-25',
    subtotal: 1980000,
    taxAmount: 376200,
    total: 2356200,
    status: 'OVERDUE',
    paymentMethod: 'Por regularizar cobranza',
    paymentTerms: 'Contado contra informe pericial',
    items: [
      {
        id: 'inv-item-9',
        description: 'Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg',
        quantity: 20,
        unitPrice: 42000,
        total: 840000,
      },
      {
        id: 'inv-item-10',
        description: 'Inspección Técnica de Condición de Casco y Espesores Ultrasonido',
        quantity: 1,
        unitPrice: 1140000,
        total: 1140000,
      },
    ],
  },
];

// Initial Operations & Technical Inspections in Field
export const initialOperations: OperationOrder[] = [
  {
    id: 'op-01',
    orderNumber: 'OP-2026-0038',
    quotationId: 'quot-1',
    quotationNumber: 'COT-000001',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    type: 'SERVICE_EXECUTION',
    title: 'Ejecución de Prueba de Inclinación en Varadero Chinquihue',
    description: 'Verificación de calados, traslado de pesos calibrados y medición de péndulo en barcaza de ensilaje.',
    status: 'COMPLETED',
    progressPct: 100,
    assignedStaff: 'Victoria Villegas Cárcamo (Ingeniera Naval)',
    scheduledDate: '2026-09-06',
    completedDate: '2026-09-06T15:30:00Z',
    deliveryAddress: 'Astillero y Varadero Chinquihue Km 6.5, Puerto Montt',
    guideNumber: 'GD-000124',
    itemsIncluded: ['Prueba de Inclinación', 'Planilla de Calados y Pesas', 'Memoria de Centro de Gravedad'],
    milestones: [
      { id: 'ms-01-1', name: 'Medición de Calados e Inspección de Estanqueidad', date: '2026-09-06', status: 'COMPLETED', completedAt: '2026-09-06T11:00:00Z' },
      { id: 'ms-01-2', name: 'Traslación de Pesos y Lectura de Péndulos', date: '2026-09-06', status: 'COMPLETED', completedAt: '2026-09-06T15:30:00Z' },
    ],
    deliverables: [
      { id: 'dl-01-1', name: 'Acta Oficial de Prueba de Inclinación', status: 'DELIVERED', link: 'https://docs.mlingenieria.cl/op-01/acta-prueba.pdf' },
      { id: 'dl-01-2', name: 'Planilla Técnica de Calados y Péndulos', status: 'DELIVERED', link: 'https://docs.mlingenieria.cl/op-01/calados.xlsx' },
    ],
  },
  {
    id: 'op-02',
    orderNumber: 'OP-2026-0039',
    quotationId: 'quot-1',
    quotationNumber: 'COT-000001',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    type: 'SERVICE_EXECUTION',
    title: 'Modelado Hidrostático y Cuadernillo Técnico de Estabilidad',
    description: 'Modelado digital 3D en Maxsurf, curvas hidrostáticas, brazos adrizantes GZ y expediente DIRECTEMAR.',
    status: 'COMPLETED',
    progressPct: 100,
    assignedStaff: 'Sebastián Morales & Camila Soto',
    scheduledDate: '2026-09-08',
    completedDate: '2026-09-08T18:00:00Z',
    deliveryAddress: 'Oficina Técnica Puerto Montt & Entrega Digital',
    itemsIncluded: ['Cuadernillo de Estabilidad Visado', 'Archivos Maxsurf / AutoCAD DWG'],
    milestones: [
      { id: 'ms-02-1', name: 'Modelado 3D de Líneas y Compartimentado', date: '2026-09-07', status: 'COMPLETED', completedAt: '2026-09-07T17:00:00Z' },
      { id: 'ms-02-2', name: 'Emisión de Cuadernillo Técnico de Estabilidad', date: '2026-09-08', status: 'COMPLETED', completedAt: '2026-09-08T18:00:00Z' },
    ],
    deliverables: [
      { id: 'dl-02-1', name: 'Cuadernillo de Estabilidad en PDF Visado', status: 'DELIVERED', link: 'https://docs.mlingenieria.cl/op-02/cuadernillo.pdf' },
    ],
  },
  {
    id: 'op-03',
    orderNumber: 'OP-2026-0045',
    quotationId: 'quot-3',
    quotationNumber: 'COT-000003',
    customerId: 'cust-03',
    customerBusinessName: 'Astillero y Maestranza Tenglo SpA',
    type: 'SERVICE_EXECUTION',
    title: 'Supervisión Técnica de Montaje y Soldadura en Casco',
    description: 'Verificación técnica en terreno de escantillonado de cuadernas y planchas de acero grado A en varadero.',
    status: 'IN_PROGRESS',
    progressPct: 67,
    assignedStaff: 'Felipe Muñoz (Ingeniero Inspector Naval)',
    scheduledDate: '2026-09-16',
    deliveryAddress: 'Varadero Isla Tenglo, Caleta Anahuac, Puerto Montt',
    guideNumber: 'GD-000142',
    itemsIncluded: ['Informe de Avance de Obra N.º 2', 'Control Dimensional de Estructura'],
    milestones: [
      { id: 'ms-03-1', name: 'Control Dimensional y Trazado de Cuadernas', date: '2026-09-16', status: 'COMPLETED', completedAt: '2026-09-16T14:00:00Z' },
      { id: 'ms-03-2', name: 'Inspección Visual de Cordones de Soldadura', date: '2026-09-18', status: 'COMPLETED', completedAt: '2026-09-18T16:00:00Z' },
      { id: 'ms-03-3', name: 'Alineación de Eje y Mamparo de Colisión', date: '2026-09-25', status: 'IN_PROGRESS' },
    ],
    deliverables: [
      { id: 'dl-03-1', name: 'Informe Técnico de Avance N.º 1', status: 'DELIVERED', link: 'https://docs.mlingenieria.cl/op-03/avance1.pdf' },
      { id: 'dl-03-2', name: 'Control Dimensional Estructural DWG', status: 'READY', link: 'https://docs.mlingenieria.cl/op-03/dimensional.dwg' },
    ],
  },
  {
    id: 'op-04',
    orderNumber: 'OP-2026-0052',
    quotationId: 'quot-7',
    quotationNumber: 'COT-000007',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    type: 'SERVICE_EXECUTION',
    title: 'Medición de Espesores de Casco por Ultrasonido en Varada',
    description: 'Mapeo pericial de pérdidas de espesor en pantoque, fondo y espejo de lancha de transporte de personal.',
    status: 'IN_PROGRESS',
    progressPct: 25,
    assignedStaff: 'Equipo de Inspección No Destructiva M&L',
    scheduledDate: '2026-09-22',
    deliveryAddress: 'Varadero Tenglo / Puerto Montt',
    guideNumber: 'GD-000160',
    itemsIncluded: ['Mapeo de Espesores por Ultrasonido', 'Reporte Pericial de Desgaste'],
    milestones: [
      { id: 'ms-04-1', name: 'Calibración de Equipos y Preparación Superficial', date: '2026-09-22', status: 'COMPLETED', completedAt: '2026-09-22T10:00:00Z' },
      { id: 'ms-04-2', name: 'Medición de Espesores en Planchas de Fondo', date: '2026-09-23', status: 'IN_PROGRESS' },
      { id: 'ms-04-3', name: 'Medición en Espejo y Mamparo de Proa', date: '2026-09-24', status: 'PENDING' },
      { id: 'ms-04-4', name: 'Elaboración de Cartografía de Desgaste', date: '2026-09-25', status: 'PENDING' },
    ],
    deliverables: [
      { id: 'dl-04-1', name: 'Reporte Pericial Preliminar', status: 'PENDING', link: 'https://docs.mlingenieria.cl/op-04/reporte-preliminar.pdf' },
    ],
  },
  {
    id: 'op-05',
    orderNumber: 'OP-2026-0058',
    quotationId: 'quot-7',
    quotationNumber: 'COT-000007',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    type: 'SERVICE_EXECUTION',
    title: 'Tramitación de Expediente de Aprobación ante DIRECTEMAR',
    description: 'Gestión técnica y seguimiento de observaciones de ingeniería con la Capitanía de Puerto de Puerto Montt.',
    status: 'IN_PROGRESS',
    progressPct: 75,
    assignedStaff: 'Victoria Villegas Cárcamo',
    scheduledDate: '2026-09-24',
    deliveryAddress: 'Capitanía de Puerto de Puerto Montt / DIRECTEMAR',
    itemsIncluded: ['Expediente de Modificación de Nave', 'Oficio de Solicitud Técnica'],
    milestones: [
      { id: 'ms-05-1', name: 'Ingreso de Expediente en Capitanía de Puerto', date: '2026-09-24', status: 'COMPLETED', completedAt: '2026-09-24T11:00:00Z' },
      { id: 'ms-05-2', name: 'Revisión por Comisión Inspectora Naval', date: '2026-09-26', status: 'COMPLETED', completedAt: '2026-09-26T14:00:00Z' },
      { id: 'ms-05-3', name: 'Levantamiento de Observaciones Técnicas', date: '2026-09-28', status: 'COMPLETED', completedAt: '2026-09-28T16:00:00Z' },
      { id: 'ms-05-4', name: 'Retiro de Resolución de Aprobación Oficial', date: '2026-10-02', status: 'IN_PROGRESS' },
    ],
    deliverables: [
      { id: 'dl-05-1', name: 'Oficio de Ingreso Timbrado', status: 'DELIVERED', link: 'https://docs.mlingenieria.cl/op-05/oficio-ingreso.pdf' },
      { id: 'dl-05-2', name: 'Resolución de Autorización DIRECTEMAR', status: 'PENDING' },
    ],
  },
];

// Initial Quotation Templates (P2.j)
export const initialTemplates: QuotationTemplate[] = [
  {
    id: 'tmpl-01',
    name: 'Estudio de Estabilidad y Cuadernillo DIRECTEMAR',
    categoryId: 'cat-02',
    categoryName: 'Estudios de Estabilidad y Arqueo',
    description: 'Plantilla integral para pruebas de inclinación y cuadernillo oficial de estabilidad sin avería',
    lines: [
      { catalogItemId: 'serv-01', quantity: 1 },
      { catalogItemId: 'serv-02', quantity: 1 },
    ],
    terms: '1. Anticipo 50% al inicio y 50% contra entrega de cuadernillo aprobado por DIRECTEMAR.\n2. Plazo estimado: 3 semanas hábiles tras prueba de inclinación en varadero.\n3. Entregables en DWG y PDF firmado por Ingeniero Naval colegiado.',
    presentationText: 'Es un agrado presentar nuestra propuesta técnica para el estudio de estabilidad y confección del cuadernillo técnico bajo normativas de DIRECTEMAR.',
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'tmpl-02',
    name: 'Inspección Pericial de Casco y Espesores en Varada',
    categoryId: 'cat-04',
    categoryName: 'Inspecciones Técnicas y Asesoría',
    description: 'Servicio pericial en astillero: medición de ultrasonido y certificación de condición estructural',
    lines: [
      { catalogItemId: 'serv-05', quantity: 1 },
      { catalogItemId: 'serv-06', quantity: 1 },
    ],
    terms: '1. Pago contra entrega de informe pericial con mapeo digital de espesores.\n2. Coordinación de visita técnica con 48 hrs de antelación en varadero.',
    presentationText: 'Presentamos nuestra propuesta de inspección no destructiva por ultrasonido para acreditación de espesores de casco ante la Autoridad Marítima.',
    active: true,
    createdAt: '2026-09-01T10:00:00Z',
  },
];

// Initial Audit Logs
export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-01',
    entity: 'COMPANY',
    action: 'UPDATE',
    entityId: 'comp-01',
    entityName: 'M&L Ingeniería Naval SpA',
    description: 'Constitución societaria en Puerto Montt, Región de Los Lagos, y fijación del margen mínimo técnico al 28.0%.',
    actorId: 'usr-admin-01',
    actorName: 'Victoria Villegas Cárcamo (Gerente General & Ingeniera Naval)',
    actorRole: 'ADMIN',
    timestamp: '2026-09-01T09:15:00.000Z',
  },
  {
    id: 'log-02',
    entity: 'USERS',
    action: 'CREATE',
    entityId: 'usr-sales-01',
    entityName: 'Sebastián Morales',
    description: 'Habilitación de acceso al panel comercial y de proyectos como Ingeniero Naval de Proyectos.',
    actorId: 'usr-admin-01',
    actorName: 'Victoria Villegas Cárcamo (Gerente General & Ingeniera Naval)',
    actorRole: 'ADMIN',
    timestamp: '2026-09-01T10:30:00.000Z',
  },
  {
    id: 'log-03',
    entity: 'CATALOG',
    action: 'CREATE',
    entityId: 'serv-01',
    entityName: 'Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR',
    description: 'Alta de servicio del objeto social en catálogo técnico con código SRV-ESTAB-01 y precio $ 2.600.000 CLP.',
    actorId: 'usr-admin-01',
    actorName: 'Victoria Villegas Cárcamo (Gerente General & Ingeniera Naval)',
    actorRole: 'ADMIN',
    timestamp: '2026-09-01T11:00:00.000Z',
  },
  {
    id: 'log-04',
    entity: 'CUSTOMERS',
    action: 'CREATE',
    entityId: 'cust-01',
    entityName: 'Austral Salmón & Mar SpA',
    description: 'Registro de cliente corporativo de la industria salmonera (RUT 76.543.210-4, Puerto Montt).',
    actorId: 'usr-sales-01',
    actorName: 'Sebastián Morales',
    actorRole: 'SALES_REP',
    timestamp: '2026-09-02T14:20:00.000Z',
  },
  {
    id: 'log-05',
    entity: 'CONTACTS',
    action: 'CREATE',
    entityId: 'cont-01',
    entityName: 'Ing. Matías Barrientos',
    description: 'Alta de contacto clave del armador y credenciales para el portal de clientes (mbarrientos@australsalmon.cl).',
    actorId: 'usr-sales-01',
    actorName: 'Sebastián Morales',
    actorRole: 'SALES_REP',
    timestamp: '2026-09-02T14:45:00.000Z',
  },
  {
    id: 'log-06',
    entity: 'CATALOG',
    action: 'CREATE',
    entityId: 'serv-03',
    entityName: 'Diseño y Elaboración de Planos Navales (Disposición y Formas)',
    description: 'Incorporación de servicio de desarrollo de planos navales en DWG/PDF según estatuto societario.',
    actorId: 'usr-sales-01',
    actorName: 'Sebastián Morales',
    actorRole: 'SALES_REP',
    timestamp: '2026-09-03T16:10:00.000Z',
  },
  {
    id: 'log-07',
    entity: 'QUOTATIONS',
    action: 'STATUS_CHANGE',
    entityId: 'quot-01',
    entityName: 'COT-000001',
    description: 'Propuesta técnica de estudio de estabilidad aprobada formalmente por el cliente vía Portal B2B.',
    actorId: 'usr-client-01',
    actorName: 'Ing. Matías Barrientos',
    actorRole: 'CUSTOMER_CONTACT',
    timestamp: '2026-09-04T18:00:00.000Z',
  },
];

class MemoryStore {
  private state: DatabaseState;

  constructor() {
    this.state = {
      users: [...initialUsers],
      customers: [...initialCustomers],
      contacts: [...initialContacts],
      categories: [...initialCategories],
      catalogItems: [...initialCatalog],
      company: { ...initialCompany },
      quotations: generateSeedQuotations(),
      outbox: [...initialOutbox],
      invoices: [...initialInvoices],
      operations: [...initialOperations],
      auditLogs: [...initialAuditLogs],
      templates: [...initialTemplates],
      sequenceNumber: 31,
    };
  }

  public reset(): void {
    this.state = {
      users: JSON.parse(JSON.stringify(initialUsers)),
      customers: JSON.parse(JSON.stringify(initialCustomers)),
      contacts: JSON.parse(JSON.stringify(initialContacts)),
      categories: JSON.parse(JSON.stringify(initialCategories)),
      catalogItems: JSON.parse(JSON.stringify(initialCatalog)),
      company: JSON.parse(JSON.stringify(initialCompany)),
      quotations: generateSeedQuotations(),
      outbox: JSON.parse(JSON.stringify(initialOutbox)),
      invoices: JSON.parse(JSON.stringify(initialInvoices)),
      operations: JSON.parse(JSON.stringify(initialOperations)),
      auditLogs: JSON.parse(JSON.stringify(initialAuditLogs)),
      templates: JSON.parse(JSON.stringify(initialTemplates)),
      sequenceNumber: 31,
    };
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public restoreState(newState: Partial<DatabaseState>): void {
    if (newState.company) this.state.company = JSON.parse(JSON.stringify(newState.company));
    if (Array.isArray(newState.users)) this.state.users = JSON.parse(JSON.stringify(newState.users));
    if (Array.isArray(newState.customers)) this.state.customers = JSON.parse(JSON.stringify(newState.customers));
    if (Array.isArray(newState.contacts)) this.state.contacts = JSON.parse(JSON.stringify(newState.contacts));
    if (Array.isArray(newState.categories)) this.state.categories = JSON.parse(JSON.stringify(newState.categories));
    if (Array.isArray(newState.catalogItems)) this.state.catalogItems = JSON.parse(JSON.stringify(newState.catalogItems));
    if (Array.isArray(newState.quotations)) this.state.quotations = JSON.parse(JSON.stringify(newState.quotations));
    if (Array.isArray(newState.invoices)) this.state.invoices = JSON.parse(JSON.stringify(newState.invoices));
    if (Array.isArray(newState.operations)) this.state.operations = JSON.parse(JSON.stringify(newState.operations));
    if (Array.isArray(newState.outbox)) this.state.outbox = JSON.parse(JSON.stringify(newState.outbox));
    if (Array.isArray(newState.auditLogs)) this.state.auditLogs = JSON.parse(JSON.stringify(newState.auditLogs));
    if (Array.isArray(newState.templates)) this.state.templates = JSON.parse(JSON.stringify(newState.templates));
    if (typeof newState.sequenceNumber === 'number') this.state.sequenceNumber = newState.sequenceNumber;
  }

  public getCompany(): CompanySettings {
    return this.state.company;
  }

  public updateCompany(data: Partial<CompanySettings>): CompanySettings {
    this.state.company = { ...this.state.company, ...data };
    return this.state.company;
  }

  public getNextQuotationNumber(): string {
    const num = this.state.sequenceNumber++;
    return `COT-${String(num).padStart(6, '0')}`;
  }

  public recordAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const log: AuditLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    return log;
  }

  public addOutbox(msg: {
    quotationId?: string;
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
    recipientName: string;
    subject?: string;
    body: string;
    recipientEmail?: string;
    recipientPhone?: string;
    quotationNumber?: string;
  }): OutboxMessage {
    const newMsg: OutboxMessage = {
      ...msg,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retries: 0,
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING',
    };
    this.state.outbox.unshift(newMsg);
    return newMsg;
  }
}

export const dbStore = new MemoryStore();
