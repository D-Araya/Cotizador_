import crypto from 'node:crypto';
import { Request } from 'express';
import { repos } from '../repositories/index.js';
import { AuditLog } from '../../modules/types.js';

export interface AuditActor {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface RecordAuditParams {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  before?: any;
  after?: any;
  actor?: AuditActor;
}

export class AuditService {
  /**
   * Extrae el actor real de la petición Express autenticada
   */
  static getActorFromRequest(req: Request): AuditActor {
    if (req.user) {
      return {
        id: req.user.id,
        name: req.user.name || req.user.email,
        role: req.user.role,
        email: req.user.email,
      };
    }
    if (req.clientUser) {
      return {
        id: req.clientUser.contactId,
        name: req.clientUser.name || req.clientUser.email,
        role: 'CLIENT',
        email: req.clientUser.email,
      };
    }
    return {
      id: 'system',
      name: 'Sistema / Proceso Automático',
      role: 'SYSTEM',
    };
  }

  /**
   * Registra una entrada de auditoría inmutable (append-only)
   */
  static async record(params: RecordAuditParams): Promise<AuditLog> {
    const actor = params.actor || {
      id: 'system',
      name: 'Sistema',
      role: 'SYSTEM',
    };

    const entry: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role as any,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityId,
      description: params.summary,
      summary: params.summary,
      before: params.before ? JSON.parse(JSON.stringify(params.before)) : undefined,
      after: params.after ? JSON.parse(JSON.stringify(params.after)) : undefined,
    };

    return repos.auditRepo.create(entry);
  }

  /**
   * Atajo para auditar directamente desde un handler de ruta con el request
   */
  static async logFromReq(
    req: Request,
    action: string,
    entity: string,
    entityId: string,
    summary: string,
    before?: any,
    after?: any
  ): Promise<AuditLog> {
    const actor = this.getActorFromRequest(req);
    return this.record({
      action,
      entity,
      entityId,
      summary,
      before,
      after,
      actor,
    });
  }
}
