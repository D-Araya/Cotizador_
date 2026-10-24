import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { apiRouter } from '../../src/server/app.js';

function getRoutesFromLayer(stack: any[], prefix = ''): Array<{ path: string; method: string }> {
  const routes: Array<{ path: string; method: string }> = [];

  for (const layer of stack) {
    if (layer.route) {
      const routePath = prefix + layer.route.path;
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) {
          routes.push({ path: routePath, method: method.toUpperCase() });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      // Subrouter
      let subPrefix = prefix;
      if (layer.regexp) {
        const source = layer.regexp.source;
        // Extraer prefijo de regex de Express como ^\\/quotations\\/?(?=\\/|$)
        const match = source.match(/\^\\\/([^\\?]+)/);
        if (match && match[1]) {
          subPrefix = `${prefix}/${match[1].replace(/\\\//g, '/')}`;
        }
      }
      routes.push(...getRoutesFromLayer(layer.handle.stack, subPrefix));
    }
  }

  return routes;
}

describe('OpenAPI Contract vs Express Routes (Point 8)', () => {
  it('el archivo contracts/openapi.yaml existe y tiene esquema de seguridad Bearer', () => {
    const yamlPath = path.resolve('contracts/openapi.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);

    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content).toContain('securitySchemes');
    expect(content).toContain('bearerAuth');
    expect(content).toContain('scheme: bearer');
  });

  it('las rutas principales de Express están documentadas en el contrato OpenAPI', () => {
    const yamlContent = fs.readFileSync(path.resolve('contracts/openapi.yaml'), 'utf-8');
    const expressRoutes = getRoutesFromLayer(apiRouter.stack);

    // Lista de rutas centrales que deben estar presentes en ambos
    const expectedCorePaths = [
      '/auth/login',
      '/quotations',
      '/public/quotations',
      '/customers',
      '/catalog-items',
      '/categories',
      '/invoices',
      '/operations',
      '/notifications',
      '/audit-logs',
      '/dashboard/summary',
    ];

    for (const corePath of expectedCorePaths) {
      const existsInExpress = expressRoutes.some((r) => r.path.includes(corePath.replace(/^\//, '')));
      expect(existsInExpress).toBe(true);

      // Debe estar en el yaml
      expect(yamlContent).toContain(corePath);
    }
  });

  it('el contrato OpenAPI incluye esquemas de paginación', () => {
    const yamlContent = fs.readFileSync(path.resolve('contracts/openapi.yaml'), 'utf-8');
    expect(yamlContent).toContain('page:');
    expect(yamlContent).toContain('pageSize:');
  });
});
