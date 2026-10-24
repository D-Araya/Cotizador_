import {
  QuotationRepository,
  CustomerRepository,
  ContactRepository,
  CatalogRepository,
  InvoiceRepository,
  OperationRepository,
  AuditRepository,
  NotificationRepository,
  CompanyRepository,
  UserRepository,
  CounterRepository,
} from './types.js';
import {
  MemoryQuotationRepository,
  MemoryCustomerRepository,
  MemoryContactRepository,
  MemoryCatalogRepository,
  MemoryInvoiceRepository,
  MemoryOperationRepository,
  MemoryAuditRepository,
  MemoryNotificationRepository,
  MemoryCompanyRepository,
  MemoryUserRepository,
  MemoryCounterRepository,
} from './memory/index.js';

export interface RepositoryContainer {
  backend: 'memory' | 'firestore';
  isDemoMode: boolean;
  quotationRepo: QuotationRepository;
  customerRepo: CustomerRepository;
  contactRepo: ContactRepository;
  catalogRepo: CatalogRepository;
  invoiceRepo: InvoiceRepository;
  operationRepo: OperationRepository;
  auditRepo: AuditRepository;
  notificationRepo: NotificationRepository;
  companyRepo: CompanyRepository;
  userRepo: UserRepository;
  counterRepo: CounterRepository;
}

let container: RepositoryContainer;

export async function initRepositories(): Promise<RepositoryContainer> {
  if (container) return container;

  const requestedBackend = (process.env.DATA_BACKEND || 'memory').toLowerCase();

  if (requestedBackend === 'firestore') {
    try {
      const { initializeApp, getApps } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');

      const app = getApps().length === 0 ? initializeApp() : getApps()[0];
      const db = getFirestore(app);

      // Prueba de verificación de conectividad a Firestore
      await db.collection('system').limit(1).get();

      const {
        FirestoreQuotationRepository,
        FirestoreCustomerRepository,
        FirestoreContactRepository,
        FirestoreCatalogRepository,
        FirestoreInvoiceRepository,
        FirestoreOperationRepository,
        FirestoreAuditRepository,
        FirestoreNotificationRepository,
        FirestoreCompanyRepository,
        FirestoreUserRepository,
        FirestoreCounterRepository,
      } = await import('./firestore/index.js');

      console.log('✅ [Persistence] Conectado a base de datos Firestore (firebase-admin)');

      container = {
        backend: 'firestore',
        isDemoMode: false,
        quotationRepo: new FirestoreQuotationRepository(db),
        customerRepo: new FirestoreCustomerRepository(db),
        contactRepo: new FirestoreContactRepository(db),
        catalogRepo: new FirestoreCatalogRepository(db),
        invoiceRepo: new FirestoreInvoiceRepository(db),
        operationRepo: new FirestoreOperationRepository(db),
        auditRepo: new FirestoreAuditRepository(db),
        notificationRepo: new FirestoreNotificationRepository(db),
        companyRepo: new FirestoreCompanyRepository(db),
        userRepo: new FirestoreUserRepository(db),
        counterRepo: new FirestoreCounterRepository(db),
      };
      return container;
    } catch (err: any) {
      console.warn(
        `⚠️ [Persistence] No fue posible conectar con Firestore con credenciales de administrador: ${err.message}. Operando en memoria.`
      );
    }
  }

  // Fallback o configuración default en Memoria (Modo Demostración)
  container = {
    backend: 'memory',
    isDemoMode: true,
    quotationRepo: new MemoryQuotationRepository(),
    customerRepo: new MemoryCustomerRepository(),
    contactRepo: new MemoryContactRepository(),
    catalogRepo: new MemoryCatalogRepository(),
    invoiceRepo: new MemoryInvoiceRepository(),
    operationRepo: new MemoryOperationRepository(),
    auditRepo: new MemoryAuditRepository(),
    notificationRepo: new MemoryNotificationRepository(),
    companyRepo: new MemoryCompanyRepository(),
    userRepo: new MemoryUserRepository(),
    counterRepo: new MemoryCounterRepository(),
  };

  return container;
}

// Inicialización síncrona inmediata con repositorios en memoria por defecto
const defaultContainer: RepositoryContainer = {
  backend: 'memory',
  isDemoMode: true,
  quotationRepo: new MemoryQuotationRepository(),
  customerRepo: new MemoryCustomerRepository(),
  contactRepo: new MemoryContactRepository(),
  catalogRepo: new MemoryCatalogRepository(),
  invoiceRepo: new MemoryInvoiceRepository(),
  operationRepo: new MemoryOperationRepository(),
  auditRepo: new MemoryAuditRepository(),
  notificationRepo: new MemoryNotificationRepository(),
  companyRepo: new MemoryCompanyRepository(),
  userRepo: new MemoryUserRepository(),
  counterRepo: new MemoryCounterRepository(),
};

container = defaultContainer;

export const repos = defaultContainer;
