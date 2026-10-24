import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Skeleton,
  KpiCardSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
  CalendarSkeleton,
  TimelineSkeleton,
  InvoicesGridSkeleton,
  OperationsGridSkeleton,
  QuotationDocumentSkeleton,
} from '../../src/ui/components/Skeleton.tsx';

describe('Skeleton Components Tests', () => {
  it('renderiza Skeleton base con clases animate-pulse', () => {
    const html = renderToString(<Skeleton className="h-4 w-32 custom-class" />);
    expect(html).toContain('animate-pulse');
    expect(html).toContain('custom-class');
  });

  it('renderiza KpiCardSkeleton', () => {
    const html = renderToString(<KpiCardSkeleton />);
    expect(html).toContain('animate-pulse');
  });

  it('renderiza KpiGridSkeleton con la cantidad solicitada', () => {
    const html = renderToString(<KpiGridSkeleton count={3} />);
    expect(html).toContain('grid');
  });

  it('renderiza TableSkeleton con número de filas y columnas personalizado', () => {
    const html = renderToString(<TableSkeleton rows={5} cols={4} />);
    expect(html).toContain('divide-y');
  });

  it('renderiza CalendarSkeleton con los 7 días de la semana', () => {
    const html = renderToString(<CalendarSkeleton />);
    expect(html).toContain('grid-cols-7');
  });

  it('renderiza TimelineSkeleton', () => {
    const html = renderToString(<TimelineSkeleton />);
    expect(html).toContain('animate-pulse');
  });

  it('renderiza InvoicesGridSkeleton', () => {
    const html = renderToString(<InvoicesGridSkeleton />);
    expect(html).toContain('grid');
  });

  it('renderiza OperationsGridSkeleton', () => {
    const html = renderToString(<OperationsGridSkeleton />);
    expect(html).toContain('grid');
  });

  it('renderiza QuotationDocumentSkeleton', () => {
    const html = renderToString(<QuotationDocumentSkeleton />);
    expect(html).toContain('max-w-4xl');
  });
});
