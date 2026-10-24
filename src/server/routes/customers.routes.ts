import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { customerCreateSchema, customerUpdateSchema, contactCreateSchema, contactUpdateSchema } from '../schemas.js';
import { generateMagicLinkToken } from '../auth.js';

export const customersRouter = express.Router();

// Todas las rutas de clientes y contactos requieren personal autenticado
customersRouter.use(authenticateStaff);

/**
 * GET /api/v1/customers
 */
customersRouter.get('/', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const { q, page, pageSize } = req.query;
  let list = state.customers.filter((c) => !c.deletedAt);

  if (q) {
    const query = String(q).toLowerCase();
    list = list.filter((c) =>
      c.businessName.toLowerCase().includes(query) || (c.taxId && c.taxId.toLowerCase().includes(query))
    );
  }

  if (page !== undefined || pageSize !== undefined) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Number(pageSize) || 20);
    const start = (p - 1) * ps;
    return res.json({
      items: list.slice(start, start + ps),
      total: list.length,
      page: p,
      pageSize: ps,
    });
  }

  res.json(list);
});

/**
 * POST /api/v1/customers
 * Tanto ADMIN como SALES_REP pueden crear clientes.
 */
customersRouter.post('/', (req: Request, res: Response) => {
  const parsed = customerCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de cliente inválidos');
  }

  const { businessName, taxId, address, salesRepId } = parsed.data;
  const state = dbStore.getState();

  const newCust = {
    id: `cust-${crypto.randomUUID()}`,
    businessName,
    taxId,
    address,
    salesRepId: req.user?.role === 'SALES_REP' ? req.user.id : (salesRepId || req.user?.id || 'usr-sales-01'),
    active: true,
    createdAt: new Date().toISOString(),
  };

  state.customers.unshift(newCust);

  dbStore.recordAudit({
    entity: 'CUSTOMERS',
    action: 'CREATE',
    entityId: newCust.id,
    entityName: newCust.businessName,
    description: `Registró nuevo cliente '${newCust.businessName}' (RUT: ${newCust.taxId}).`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'SALES_REP',
  });

  res.status(201).json(newCust);
});

/**
 * PATCH /api/v1/customers/:id
 * Lista blanca de campos actualizables.
 */
customersRouter.patch('/:id', (req: Request, res: Response) => {
  const parsed = customerUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Campos no permitidos');
  }

  const state = dbStore.getState();
  const idx = state.customers.findIndex((c) => c.id === req.params.id && !c.deletedAt);
  if (idx === -1) return sendProblem(res, 404, 'Cliente no encontrado', 'El cliente no existe.');

  state.customers[idx] = { ...state.customers[idx], ...parsed.data };

  dbStore.recordAudit({
    entity: 'CUSTOMERS',
    action: 'UPDATE',
    entityId: state.customers[idx].id,
    entityName: state.customers[idx].businessName,
    description: `Actualizó datos del cliente '${state.customers[idx].businessName}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'SALES_REP',
  });

  res.json(state.customers[idx]);
});

/**
 * DELETE /api/v1/customers/:id
 * REGLA: Solo ADMIN puede dar de baja a un cliente.
 */
customersRouter.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const cust = state.customers.find((c) => c.id === req.params.id && !c.deletedAt);
  if (!cust) return sendProblem(res, 404, 'Cliente no encontrado', 'El cliente no existe.');

  cust.deletedAt = new Date().toISOString();
  cust.active = false;

  dbStore.recordAudit({
    entity: 'CUSTOMERS',
    action: 'DELETE',
    entityId: cust.id,
    entityName: cust.businessName,
    description: `Dio de baja al cliente '${cust.businessName}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.status(204).send();
});

/**
 * GET /api/v1/customers/:id/contacts
 */
customersRouter.get('/:id/contacts', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const list = state.contacts.filter((c) => c.customerId === req.params.id && !c.deletedAt);
  res.json(list);
});

/**
 * POST /api/v1/customers/:id/contacts
 * Contactos sin contraseña: Se genera enlace mágico de 32 bytes con hash SHA-256.
 */
customersRouter.post('/:id/contacts', (req: Request, res: Response) => {
  const parsed = contactCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de contacto inválidos');
  }

  const state = dbStore.getState();
  const customer = state.customers.find((c) => c.id === req.params.id && !c.deletedAt);
  if (!customer) return sendProblem(res, 404, 'Cliente no encontrado', 'El cliente no existe.');

  const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();

  const newContact = {
    id: `cont-${crypto.randomUUID()}`,
    customerId: req.params.id,
    name: parsed.data.name,
    position: parsed.data.position,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    active: true,
    portalTokenHash: tokenHash,
    portalTokenExpiresAt: expiresAt,
    portalTokenRevoked: false,
    createdAt: new Date().toISOString(),
  };

  state.contacts.push(newContact);

  dbStore.recordAudit({
    entity: 'CONTACTS',
    action: 'CREATE',
    entityId: newContact.id,
    entityName: newContact.name,
    description: `Registró contacto '${newContact.name}' para el cliente '${customer.businessName}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'SALES_REP',
  });

  res.status(201).json({
    ...newContact,
    initialMagicToken: rawToken,
  });
});

/**
 * PATCH /api/v1/contacts/:id
 */
customersRouter.patch('/contacts/:id', (req: Request, res: Response) => {
  const parsed = contactUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Campos inválidos');
  }

  const state = dbStore.getState();
  const idx = state.contacts.findIndex((c) => c.id === req.params.id && !c.deletedAt);
  if (idx === -1) return sendProblem(res, 404, 'Contacto no encontrado', 'El contacto no existe.');

  state.contacts[idx] = { ...state.contacts[idx], ...parsed.data };
  res.json(state.contacts[idx]);
});

/**
 * DELETE /api/v1/contacts/:id
 * REGLA: Solo ADMIN puede dar de baja a un contacto.
 */
customersRouter.delete('/contacts/:id', requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && !c.deletedAt);
  if (!contact) return sendProblem(res, 404, 'Contacto no encontrado', 'No existe.');

  contact.deletedAt = new Date().toISOString();
  contact.active = false;
  contact.portalTokenRevoked = true;

  res.status(204).send();
});

/**
 * POST /api/v1/contacts/:id/magic-link
 * Genera un nuevo enlace mágico de acceso para el contacto.
 */
customersRouter.post('/contacts/:id/magic-link', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && !c.deletedAt);
  if (!contact) return sendProblem(res, 404, 'Contacto no encontrado', 'No existe.');

  const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();
  contact.portalTokenHash = tokenHash;
  contact.portalTokenExpiresAt = expiresAt;
  contact.portalTokenRevoked = false;

  const origin = req.get('origin') || `http://${req.get('host') || 'localhost:3000'}`;
  const magicUrl = `/portal?magicToken=${rawToken}`;
  const fullMagicUrl = `${origin}${magicUrl}`;

  state.outbox.unshift({
    id: `out-${crypto.randomUUID()}`,
    channel: 'EMAIL',
    recipient: contact.email,
    recipientEmail: contact.email,
    recipientName: contact.name,
    recipientPhone: contact.phone,
    subject: `Enlace de acceso a Portal de Clientes - ${state.company.name}`,
    body: `Estimado/a ${contact.name},\n\nLe enviamos su enlace directo de acceso al Portal de Clientes:\n${fullMagicUrl}\n\nEste enlace es válido por 30 días.\n\nAtentamente,\n${state.company.name}`,
    bodyPreview: `Enlace de acceso al portal para ${contact.name}`,
    status: 'PENDING',
    retries: 0,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
  });

  dbStore.recordAudit({
    entity: 'CONTACTS',
    action: 'UPDATE',
    entityId: contact.id,
    entityName: contact.name,
    description: `Generó y envió enlace de acceso al portal para '${contact.name}' a la bandeja de salida.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'SALES_REP',
  });

  res.json({
    success: true,
    magicToken: rawToken,
    magicUrl,
    fullUrl: fullMagicUrl,
    expiresAt,
  });
});

/**
 * POST /api/v1/contacts/:id/revoke-access
 * Revoca el acceso al portal del contacto.
 */
customersRouter.post('/contacts/:id/revoke-access', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && !c.deletedAt);
  if (!contact) return sendProblem(res, 404, 'Contacto no encontrado', 'No existe.');

  contact.portalTokenRevoked = true;

  dbStore.recordAudit({
    entity: 'CONTACTS',
    action: 'UPDATE',
    entityId: contact.id,
    entityName: contact.name,
    description: `Revocó acceso al portal para '${contact.name}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'SALES_REP',
  });

  res.json({ success: true, message: 'Acceso revocado con éxito' });
});
