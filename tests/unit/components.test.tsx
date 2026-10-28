// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QuotationWizard } from '../../src/ui/components/QuotationWizard.tsx';
import { PublicQuotationView } from '../../src/ui/components/PublicQuotationView.tsx';
import { ClientPortal } from '../../src/ui/components/ClientPortal.tsx';
import { AppLayout } from '../../src/ui/layouts/AppLayout.tsx';
import { RevisionsModal } from '../../src/ui/modals/RevisionsModal.tsx';
import { LoginPage } from '../../src/ui/pages/LoginPage.tsx';
import { User, CompanySettings, Customer, Quotation } from '../../src/modules/types.ts';
import { ROLE_PERMISSIONS } from '../../src/shared-kernel/permissions.ts';

// Mock api requests
vi.mock('../../src/ui/api.ts', () => {
  const mockApiRequest = vi.fn();
  return {
    apiRequest: mockApiRequest,
    getActiveApiUser: vi.fn(),
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
    setActiveApiUser: vi.fn(),
    clearClientSession: vi.fn(),
    subscribeToQuotationSync: vi.fn().mockReturnValue(() => {}),
    notifyQuotationSync: vi.fn(),
    api: {
      get: vi.fn().mockImplementation((url: string, opt?: any) => mockApiRequest(url, { ...opt, method: 'GET' })),
      post: vi.fn().mockImplementation((url: string, body?: any, opt?: any) => mockApiRequest(url, { ...opt, method: 'POST', body: JSON.stringify(body) })),
      put: vi.fn().mockImplementation((url: string, body?: any, opt?: any) => mockApiRequest(url, { ...opt, method: 'PUT', body: JSON.stringify(body) })),
      delete: vi.fn().mockImplementation((url: string, opt?: any) => mockApiRequest(url, { ...opt, method: 'DELETE' })),
    },
  };
});

import { apiRequest, getActiveApiUser } from '../../src/ui/api.ts';

describe('Pruebas de Componentes React (Vitest + Testing Library + JSDOM)', () => {
  const mockAdminUser: User = {
    id: 'usr-admin-01',
    email: 'admin@mlingenieria.cl',
    name: 'Administrador General',
    role: 'ADMIN',
    phone: '+56 9 1234 5678',
    active: true,
    permissions: ROLE_PERMISSIONS.ADMIN,
  };

  const mockSalesRepUser: User = {
    id: 'usr-sales-01',
    email: 'smorales@mlingenieria.cl',
    name: 'Sebastián Morales',
    role: 'SALES_REP',
    phone: '+56 9 8765 4321',
    active: true,
    permissions: ROLE_PERMISSIONS.SALES_REP,
  };

  const mockCompany: CompanySettings = {
    id: 'comp-01',
    name: 'M&L Ingeniería Naval',
    legalName: 'M&L Ingeniería Naval SpA',
    rut: '76.123.456-7',
    address: 'Av. Costanera 1234, Puerto Montt',
    phone: '+56 9 8765 4321',
    email: 'contacto@mlingenieria.cl',
    minMarginPct: 25,
    hardMinMarginPct: 15,
    taxRatePct: 19,
    currency: 'CLP',
    ufRate: 38500,
    defaultPresentationText: 'Presentación',
    defaultTerms: 'Términos',
    sessionTimeoutMinutes: 60,
    lossReasons: ['Precio', 'Tiempo de entrega', 'Proveedor alternativo'],
  };

  const mockCustomers: Customer[] = [
    {
      id: 'cust-01',
      businessName: 'Naviera Austral SpA',
      taxId: '76.888.999-K',
      address: 'Puerto Montt',
      salesRepId: 'usr-sales-01',
      active: true,
      createdAt: '2026-01-01',
    },
  ];

  const mockSentQuotation: any = {
    id: 'quot-pub-01',
    quotationNumber: 'COT-2026-00010',
    title: 'Servicio Mantenimiento de Motores',
    customerId: 'cust-01',
    customerBusinessName: 'Naviera Austral SpA',
    customerTaxId: '76.888.999-K',
    salesRepId: 'usr-sales-01',
    salesRepName: 'Sebastián Morales',
    salesRepEmail: 'smorales@mlingenieria.cl',
    status: 'SENT',
    revision: 1,
    currency: 'CLP',
    taxRatePct: 19,
    lines: [
      {
        id: 'line-01',
        name: 'Overhaul Motor Marino Principal',
        type: 'SERVICE' as const,
        quantity: 1,
        price: 5000000,
        cost: 3500000,
        marginPct: 30,
        subtotal: 5000000,
        costTotal: 3500000,
        unit: 'GL',
      },
    ],
    netSubtotal: 5000000,
    subtotal: 5000000,
    taxAmount: 950000,
    grandTotal: 5950000,
    total: 5950000,
    terms: 'Términos comerciales estándar de servicio naval.',
    publicToken: 'token-publico-seguro-12345',
    validUntil: new Date(Date.now() + 10 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statusHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (apiRequest as any).mockImplementation((endpoint: string) => {
      if (typeof endpoint === 'string' && endpoint.includes('/public/quotations/')) {
        return Promise.resolve({
          data: {
            quotation: mockSentQuotation,
            customer: mockCustomers[0],
            contact: { id: 'cont-01', name: '', position: '', email: 'contacto@test.cl' },
            company: mockCompany,
            salesRep: mockSalesRepUser,
          },
          status: 200,
        });
      }
      if (endpoint === '/api/v1/company') {
        return Promise.resolve({ data: mockCompany, status: 200 });
      }
      if (endpoint === '/api/v1/customers') {
        return Promise.resolve({ data: mockCustomers, status: 200 });
      }
      if (endpoint === '/api/v1/catalog-items') {
        return Promise.resolve({ data: [], status: 200 });
      }
      return Promise.resolve({ data: [], status: 200 });
    });
  });

  afterEach(() => {
    cleanup();
  });

  const mockClientUser: User = {
    id: 'usr-client-01',
    email: 'contacto@navieraaustral.cl',
    name: 'Don Carlos Naviera',
    role: 'CUSTOMER_CONTACT',
    phone: '+56 9 9999 8888',
    active: true,
    permissions: [],
  };

  // =========================================================================
  // 1. Asistente Bloquea "Siguiente" bajo el Margen Mínimo (P3.l)
  // =========================================================================
  describe('1. Asistente Bloquea "Siguiente" bajo el Margen Mínimo', () => {
    it('El botón "Siguiente" en paso 1 está deshabilitado si no se ha seleccionado cliente y contacto', async () => {
      render(
        <MemoryRouter>
          <QuotationWizard
            company={mockCompany}
            salesRepId={mockSalesRepUser.id}
            currentUser={mockSalesRepUser}
            onFinished={vi.fn()}
            onCancel={vi.fn()}
          />
        </MemoryRouter>
      );

      // Esperar que el asistente cargue y verificar que Siguiente está deshabilitado
      const nextBtn = await screen.findByRole('button', { name: /Siguiente/i });
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('El botón "Siguiente" en paso 2 está deshabilitado si el margen está bajo el piso duro', async () => {
      // Costo 100, Precio 110 -> Margen = 9.09% (inferior al piso duro de 15%)
      const lowMarginLine = {
        id: 'line-low-01',
        name: 'Servicio submarino con margen insuficiente',
        cost: 100,
        price: 110,
        quantity: 1,
        marginPct: 9.09,
        subtotal: 110,
        costTotal: 100,
        type: 'SERVICE' as const,
        unit: 'GL',
      };

      render(
        <MemoryRouter>
          <QuotationWizard
            company={mockCompany}
            salesRepId={mockSalesRepUser.id}
            currentUser={mockSalesRepUser}
            initialStep={2}
            initialLines={[lowMarginLine]}
            onFinished={vi.fn()}
            onCancel={vi.fn()}
          />
        </MemoryRouter>
      );

      const nextBtn = await screen.findByRole('button', { name: /Siguiente/i });
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // =========================================================================
  // 2. Vista Pública Acepta con Evidencia (P1.d)
  // =========================================================================
  describe('2. Vista Pública Acepta con Evidencia', () => {
    it('El botón de aceptación pública está deshabilitado hasta ingresar nombre, cargo y aceptar términos', async () => {
      render(
        <MemoryRouter>
          <PublicQuotationView token="token-publico-seguro-12345" />
        </MemoryRouter>
      );

      // Esperar a que la cotización se cargue
      const codeElements = await screen.findAllByText('COT-2026-00010');
      expect(codeElements.length).toBeGreaterThan(0);

      // Botón de aceptar cotización
      const acceptBtn = screen.getByRole('button', { name: /Aceptar y Firmar Cotización/i });
      expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);

      // Rellenar nombre del firmante
      const nameInput = screen.getByPlaceholderText(/Marcelo Barrientos/i);
      fireEvent.change(nameInput, { target: { value: 'Don Juan Valdés' } });

      // Sigue deshabilitado porque falta cargo y checkbox
      expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);

      // Rellenar cargo
      const roleInput = screen.getByPlaceholderText(/Gerente de Operaciones/i);
      fireEvent.change(roleInput, { target: { value: 'Gerente de Mantenimiento' } });

      expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);

      // Marcar checkbox de términos
      const termsCheckbox = screen.getByRole('checkbox');
      fireEvent.click(termsCheckbox);

      // Ahora que se ingresó la evidencia legal completa, el botón se habilita
      expect((acceptBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('Para personal comercial (ADMIN / ASESOR), se oculta el formulario de aceptación del cliente y se muestra el estado informativo', async () => {
      (getActiveApiUser as any).mockReturnValue(mockSalesRepUser);

      render(
        <MemoryRouter>
          <PublicQuotationView token="token-publico-seguro-12345" />
        </MemoryRouter>
      );

      // Esperar a que la cotización se cargue
      const codeElements = await screen.findAllByText('COT-2026-00010');
      expect(codeElements.length).toBeGreaterThan(0);

      // NO debe existir el botón de aceptar ni inputs de firma del cliente
      expect(screen.queryByRole('button', { name: /Aceptar y Firmar Cotización/i })).toBeNull();
      expect(screen.queryByPlaceholderText(/Marcelo Barrientos/i)).toBeNull();

      // En su lugar, debe mostrarse el bloque de estado informativo para el asesor
      expect(screen.getByText(/Estado de Decisión del Mandante/i)).toBeTruthy();
      expect(screen.getByText(/Esperando Decisión del Cliente/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Copiar Enlace para el Cliente/i })).toBeTruthy();

      (getActiveApiUser as any).mockReturnValue(undefined);
    });
  });

  // =========================================================================
  // 3. El Portal Solo Muestra Datos Propios (S3)
  // =========================================================================
  describe('3. El Portal Solo Muestra Datos Propios', () => {
    it('Carga y muestra únicamente las cotizaciones pertenecientes al cliente autenticado', async () => {
      const clientQuotations: any[] = [
        {
          id: 'quot-portal-01',
          quotationNumber: 'COT-2026-CLIENT-01',
          title: 'Carena de Casco - Embarcación Los Alerces',
          customerId: 'cust-01',
          customerBusinessName: 'Naviera Austral SpA',
          status: 'SENT',
          grandTotal: 12000000,
          total: 12000000,
          currency: 'CLP',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lines: [],
          statusHistory: [],
        },
      ];

      (apiRequest as any).mockImplementation((endpoint: string) => {
        if (endpoint === '/api/v1/portal/quotations') {
          return Promise.resolve({ data: clientQuotations, status: 200 });
        }
        if (endpoint === '/api/v1/portal/invoices') {
          return Promise.resolve({ data: [], status: 200 });
        }
        if (endpoint === '/api/v1/portal/operations') {
          return Promise.resolve({ data: [], status: 200 });
        }
        if (endpoint === '/api/v1/portal/summary') {
          return Promise.resolve({ data: { total: 1, accepted: 0, pending: 1, rejected: 0 }, status: 200 });
        }
        return Promise.resolve({ data: [], status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/portal/quotations']}>
          <Routes>
            <Route
              path="/portal/:tab"
              element={
                <ClientPortal
                  user={mockClientUser}
                  onLogout={vi.fn()}
                  onOpenPublicLink={vi.fn()}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Esperar a que la cotización del cliente aparezca en el DOM
      const quoteEl = await screen.findByText('COT-2026-CLIENT-01', {}, { timeout: 3000 });
      expect(quoteEl).toBeTruthy();
    });
  });

  // =========================================================================
  // 4. La Navegación Cambia Según los Permisos
  // =========================================================================
  describe('4. La Navegación Cambia Según los Permisos', () => {
    it('Un usuario ADMIN visualiza "Equipo Comercial" en la navegación', () => {
      render(
        <MemoryRouter>
          <AppLayout user={mockAdminUser} onLogout={vi.fn()} />
        </MemoryRouter>
      );

      expect(screen.getByText('Equipo Comercial')).toBeTruthy();
      expect(screen.getByText('Empresa & Margen')).toBeTruthy();
      expect(screen.getByText('Auditoría')).toBeTruthy();
    });

    it('Un usuario SALES_REP NO visualiza "Equipo Comercial" en la navegación', () => {
      render(
        <MemoryRouter>
          <AppLayout user={mockSalesRepUser} onLogout={vi.fn()} />
        </MemoryRouter>
      );

      expect(screen.queryByText('Equipo Comercial')).toBeNull();
      // Pero sí ve Clientes, Cotizaciones, etc.
      expect(screen.getByText('Clientes')).toBeTruthy();
      expect(screen.getByText('Cotizaciones')).toBeTruthy();
    });
  });

  // =========================================================================
  // 5. RevisionsModal maneja de forma segura listas u objetos de revisiones
  // =========================================================================
  describe('5. RevisionsModal maneja de forma segura las revisiones', () => {
    it('renderiza sin fallar cuando revisionsList es un array', () => {
      render(
        <RevisionsModal
          isOpen={true}
          onClose={vi.fn()}
          quotation={mockSentQuotation}
          revisionsList={[mockSentQuotation]}
          revisionsLoading={false}
          onOpenPublicLink={vi.fn()}
        />
      );
      expect(screen.getByText('COT-2026-00010')).toBeTruthy();
    });

    it('renderiza sin fallar cuando revisionsList llega como objeto { revisions: [...] } o no-array', () => {
      render(
        <RevisionsModal
          isOpen={true}
          onClose={vi.fn()}
          quotation={mockSentQuotation}
          revisionsList={{ revisions: [mockSentQuotation] } as any}
          revisionsLoading={false}
          onOpenPublicLink={vi.fn()}
        />
      );
      expect(screen.getByText('COT-2026-00010')).toBeTruthy();
    });
  });

  // =========================================================================
  // 6. LoginPage: Bloque de Cuentas Demo (Acceso Rápido)
  // =========================================================================
  describe('6. LoginPage: Bloque de Cuentas Demo y Acceso Rápido', () => {
    it('muestra el encabezado de Acceso Rápido con Cuentas Demo y los 3 accesos de demo', () => {
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      render(
        <MemoryRouter>
          <LoginPage onLogin={mockLogin} />
        </MemoryRouter>
      );

      // Verificar que el bloque de cuentas demo existe
      expect(screen.getByText(/Acceso Rápido con Cuentas Demo/i)).toBeTruthy();

      // Verificar cuentas demo de Admin, Asesor Comercial y Portal Cliente
      expect(screen.getByText('Victoria Villegas C.')).toBeTruthy();
      expect(screen.getByText('Sebastián Morales')).toBeTruthy();
      expect(screen.getByText('Ing. Matías Barrientos')).toBeTruthy();
    });

    it('al hacer clic en una cuenta demo ejecuta el login rápido con sus credenciales', () => {
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      render(
        <MemoryRouter>
          <LoginPage onLogin={mockLogin} />
        </MemoryRouter>
      );

      // Hacer clic en Sebastián Morales (Asesor Comercial)
      const salesButton = screen.getByText('Sebastián Morales').closest('button');
      expect(salesButton).toBeTruthy();
      fireEvent.click(salesButton!);

      expect(mockLogin).toHaveBeenCalledWith('smorales@mlingenieria.cl', 'admin123');
    });
  });

  // =========================================================================
  // Asistente: Botón "Guardar como plantilla" al lado izquierdo de "Guardar como borrador"
  // =========================================================================
  describe('Guardar como plantilla en Asistente de Cotización', () => {
    it('muestra el botón "Guardar como plantilla" al lado izquierdo de "Guardar como Borrador" y guarda la plantilla', async () => {
      const sampleLine = {
        id: 'line-test-01',
        name: 'Inspección de Casco en Varadero',
        catalogItemId: 'serv-01',
        cost: 100000,
        price: 200000,
        quantity: 1,
        marginPct: 50,
        subtotal: 200000,
        costTotal: 100000,
        type: 'SERVICE' as const,
        unit: 'GL',
      };

      (apiRequest as any).mockImplementation((url: string, opts?: any) => {
        if (url === '/api/v1/customers') return Promise.resolve({ data: mockCustomers, status: 200 });
        if (url === '/api/v1/catalog-items') return Promise.resolve({ data: [], status: 200 });
        if (url === '/api/v1/categories') return Promise.resolve({ data: [{ id: 'cat-01', name: 'Ingeniería Naval' }], status: 200 });
        if (url === '/api/v1/templates' && opts?.method === 'POST') {
          return Promise.resolve({
            data: { id: 'tmpl-new-1', name: JSON.parse(opts.body).name, lines: [] },
            status: 201,
          });
        }
        return Promise.resolve({ data: {}, status: 200 });
      });

      render(
        <MemoryRouter>
          <QuotationWizard
            company={mockCompany}
            salesRepId={mockSalesRepUser.id}
            currentUser={mockSalesRepUser}
            initialStep={4}
            initialLines={[sampleLine]}
            onFinished={vi.fn()}
            onCancel={vi.fn()}
          />
        </MemoryRouter>
      );

      // Verificar que ambos botones existen
      const saveDraftBtn = await screen.findByRole('button', { name: /Guardar como Borrador/i });
      const saveTemplateBtn = await screen.findByRole('button', { name: /Guardar como plantilla/i });

      expect(saveDraftBtn).toBeTruthy();
      expect(saveTemplateBtn).toBeTruthy();

      // Verificar que "Guardar como plantilla" está situado inmediatamente a la izquierda de "Guardar como Borrador"
      expect(saveTemplateBtn.compareDocumentPosition(saveDraftBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      // Abrir modal de guardar plantilla
      fireEvent.click(saveTemplateBtn);

      // Verificar diálogo modal
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(within(dialog).getByText('Crea una plantilla reutilizable a partir de esta cotización')).toBeTruthy();

      // Enviar formulario del modal
      const submitModalBtn = within(dialog).getByRole('button', { name: /Guardar como Plantilla/i });
      fireEvent.click(submitModalBtn);

      // Verificar mensaje de éxito
      expect(await screen.findByText(/¡Plantilla guardada con éxito!/i)).toBeTruthy();
    });
  });
});

