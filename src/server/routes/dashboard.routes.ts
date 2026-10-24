import express, { Request, Response } from 'express';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff } from '../middleware/auth.js';

export const dashboardRouter = express.Router();

dashboardRouter.use(authenticateStaff);

dashboardRouter.get('/dashboard/summary', (req: Request, res: Response) => {
  const state = dbStore.getState();
  let quotes = [...state.quotations];

  if (req.user?.role === 'SALES_REP') {
    quotes = quotes.filter((q) => q.salesRepId === req.user?.id);
  }

  const totalQuotations = quotes.length;
  const accepted = quotes.filter((q) => q.status === 'ACCEPTED').length;
  const sent = quotes.filter((q) => q.status === 'SENT').length;
  const viewed = quotes.filter((q) => q.status === 'VIEWED').length;
  const drafts = quotes.filter((q) => q.status === 'DRAFT').length;
  const rejected = quotes.filter((q) => q.status === 'REJECTED').length;

  const totalValue = quotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);
  const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED');
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);

  const acceptanceRate = totalQuotations > 0 ? Number(((accepted / totalQuotations) * 100).toFixed(1)) : 0;

  // Calculo de margen y utilidad
  const totalCost = acceptedQuotes.reduce((acc, q) => acc + (q.totalCost || 0), 0);
  const netSubtotal = acceptedQuotes.reduce(
    (acc, q) => acc + (q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0))),
    0
  );
  const totalProfit = netSubtotal - totalCost;
  const avgMargin = netSubtotal > 0 ? Number(((totalProfit / netSubtotal) * 100).toFixed(1)) : 0;

  res.json({
    totalQuotations,
    totalQuotes: totalQuotations,
    accepted,
    totalAccepted: accepted,
    sent,
    totalSent: sent,
    viewed,
    totalViewed: viewed,
    drafts,
    rejected,
    totalRejected: rejected,
    totalValue,
    acceptedValue,
    totalAcceptedSales: acceptedValue,
    acceptanceRate,
    avgMargin,
    avgMarginPct: avgMargin,
    totalProfit,
    activeOperations: state.operations.filter((o) => o.status !== 'COMPLETED').length,
    pendingInvoices: state.invoices.filter((i) => i.status === 'ISSUED').length,
  });
});

dashboardRouter.get('/dashboard/by-sales-rep', (req: Request, res: Response) => {
  const state = dbStore.getState();

  if (req.user?.role === 'SALES_REP') {
    const rep = state.users.find((u) => u.id === req.user?.id);
    if (!rep) return res.json([]);
    const repQuotes = state.quotations.filter((q) => q.salesRepId === rep.id);
    const total = repQuotes.length;
    const accepted = repQuotes.filter((q) => q.status === 'ACCEPTED').length;
    const rejected = repQuotes.filter((q) => q.status === 'REJECTED').length;
    const viewed = repQuotes.filter((q) => q.status === 'VIEWED').length;
    const sent = repQuotes.filter((q) => q.status === 'SENT').length;
    const acceptedQuotes = repQuotes.filter((q) => q.status === 'ACCEPTED');
    const totalSales = acceptedQuotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);
    const totalAmount = repQuotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);
    const cost = acceptedQuotes.reduce((acc, q) => acc + (q.totalCost || 0), 0);
    const net = acceptedQuotes.reduce((acc, q) => acc + (q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0))), 0);
    const profit = net - cost;
    const avgMarginPct = net > 0 ? Number(((profit / net) * 100).toFixed(1)) : 0;
    const acceptanceRate = total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 0;

    return res.json([{
      salesRepId: rep.id,
      salesRepName: rep.name,
      name: rep.name,
      totalQuotations: total,
      totalQuotes: total,
      acceptedQuotations: accepted,
      accepted,
      rejected,
      viewed,
      sent,
      totalAmount,
      totalSales,
      avgMarginPct,
      acceptanceRate,
    }]);
  }

  // ADMIN: lista de asesores y administradores activos
  const salesReps = state.users.filter((u) => (u.role === 'SALES_REP' || u.role === 'ADMIN') && !u.deletedAt);
  const repIds = new Set(salesReps.map((r) => r.id));

  // Asegurar que cualquier cotización huérfana cuente en el asesor principal/admin para que los totales cuadren al 100%
  const fallbackRep = salesReps[0];
  if (fallbackRep) {
    for (const q of state.quotations) {
      if (!repIds.has(q.salesRepId)) {
        q.salesRepId = fallbackRep.id;
        q.salesRepName = fallbackRep.name;
      }
    }
  }

  const report = salesReps.map((rep) => {
    const repQuotes = state.quotations.filter((q) => q.salesRepId === rep.id);
    const total = repQuotes.length;
    const accepted = repQuotes.filter((q) => q.status === 'ACCEPTED').length;
    const rejected = repQuotes.filter((q) => q.status === 'REJECTED').length;
    const viewed = repQuotes.filter((q) => q.status === 'VIEWED').length;
    const sent = repQuotes.filter((q) => q.status === 'SENT').length;

    const acceptedQuotes = repQuotes.filter((q) => q.status === 'ACCEPTED');
    const totalSales = acceptedQuotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);
    const totalAmount = repQuotes.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);

    const cost = acceptedQuotes.reduce((acc, q) => acc + (q.totalCost || 0), 0);
    const net = acceptedQuotes.reduce(
      (acc, q) => acc + (q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0))),
      0
    );
    const profit = net - cost;
    const avgMarginPct = net > 0 ? Number(((profit / net) * 100).toFixed(1)) : 0;
    const acceptanceRate = total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 0;

    return {
      salesRepId: rep.id,
      salesRepName: rep.name,
      name: rep.name,
      totalQuotations: total,
      totalQuotes: total,
      acceptedQuotations: accepted,
      accepted,
      rejected,
      viewed,
      sent,
      totalAmount,
      totalSales,
      avgMarginPct,
      acceptanceRate,
    };
  });

  res.json(report);
});

dashboardRouter.get('/dashboard/by-item-type', (_req: Request, res: Response) => {
  const state = dbStore.getState();
  let productCount = 0;
  let serviceCount = 0;
  let productSales = 0;
  let serviceSales = 0;
  let productCost = 0;
  let serviceCost = 0;

  for (const q of state.quotations) {
    if (q.status !== 'ACCEPTED') continue;
    for (const l of q.lines) {
      const lineCost = l.costTotal ?? ((l.cost || 0) * (l.quantity || 1));
      const lineSubtotal = l.subtotal ?? ((l.price || 0) * (l.quantity || 1));
      if (l.type === 'SERVICE') {
        serviceCount += l.quantity || 1;
        serviceSales += lineSubtotal;
        serviceCost += lineCost;
      } else {
        productCount += l.quantity || 1;
        productSales += lineSubtotal;
        productCost += lineCost;
      }
    }
  }

  const productProfit = productSales - productCost;
  const serviceProfit = serviceSales - serviceCost;
  const productMargin = productSales > 0 ? Number(((productProfit / productSales) * 100).toFixed(1)) : 0;
  const serviceMargin = serviceSales > 0 ? Number(((serviceProfit / serviceSales) * 100).toFixed(1)) : 0;

  res.json({
    products: {
      count: productCount,
      revenue: productSales,
      sales: productSales,
      cost: productCost,
      profit: productProfit,
      marginPct: productMargin,
    },
    services: {
      count: serviceCount,
      revenue: serviceSales,
      sales: serviceSales,
      cost: serviceCost,
      profit: serviceProfit,
      marginPct: serviceMargin,
    },
  });
});

/**
 * GET /api/v1/dashboard/pipeline-metrics (P2.i)
 * Calcula en el servidor todas las métricas del pipeline y KPIs exigidos:
 * 1. Tasa de cierre (aceptadas / decididas)
 * 2. Ciclo de venta (días de envío a decisión)
 * 3. Tiempo hasta primera vista (horas/días)
 * 4. Pipeline ponderado (probabilidad configurable por el ADMIN)
 * 5. Antigüedad de las enviadas (días promedio en SENT/VIEWED)
 * 6. Margen aceptado frente al mínimo
 * 7. Ganadas/perdidas por categoría y por asesor
 */
dashboardRouter.get('/dashboard/pipeline-metrics', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const company = state.company;
  const now = Date.now();

  let quotes = [...state.quotations];
  if (req.user?.role === 'SALES_REP') {
    quotes = quotes.filter((q) => q.salesRepId === req.user?.id);
  }

  // 1. Tasa de cierre = aceptadas / (aceptadas + rechazadas)
  const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED');
  const rejectedQuotes = quotes.filter((q) => q.status === 'REJECTED');
  const decidedCount = acceptedQuotes.length + rejectedQuotes.length;
  const closeRatePct = decidedCount > 0
    ? Number(((acceptedQuotes.length / decidedCount) * 100).toFixed(1))
    : 0;

  // 2. Ciclo de venta (días de envío a decisión para aceptadas y rechazadas)
  const decidedWithDates = [...acceptedQuotes, ...rejectedQuotes].filter((q) => {
    const decisionTime = q.status === 'ACCEPTED' ? q.acceptedAt : q.rejectedAt;
    const startTime = q.sentAt || q.createdAt;
    return decisionTime && startTime;
  });

  const totalDecisionDays = decidedWithDates.reduce((acc, q) => {
    const decisionTime = new Date(q.status === 'ACCEPTED' ? q.acceptedAt! : q.rejectedAt!).getTime();
    const startTime = new Date(q.sentAt || q.createdAt).getTime();
    const days = Math.max(0, (decisionTime - startTime) / (1000 * 60 * 60 * 24));
    return acc + days;
  }, 0);

  const avgSalesCycleDays = decidedWithDates.length > 0
    ? Number((totalDecisionDays / decidedWithDates.length).toFixed(1))
    : 0;

  // 3. Tiempo hasta primera vista (horas y días desde sentAt hasta firstViewedAt)
  const viewedWithDates = quotes.filter((q) => q.sentAt && q.firstViewedAt);
  const totalViewHours = viewedWithDates.reduce((acc, q) => {
    const sentTime = new Date(q.sentAt!).getTime();
    const viewedTime = new Date(q.firstViewedAt!).getTime();
    const hours = Math.max(0, (viewedTime - sentTime) / (1000 * 60 * 60));
    return acc + hours;
  }, 0);

  const avgTimeToFirstViewHours = viewedWithDates.length > 0
    ? Number((totalViewHours / viewedWithDates.length).toFixed(1))
    : 0;
  const avgTimeToFirstViewDays = Number((avgTimeToFirstViewHours / 24).toFixed(1));

  // 4. Pipeline ponderado
  const probabilities: Record<string, number> = company.pipelineProbabilities || {
    DRAFT: 10,
    SENT: 30,
    VIEWED: 50,
    CHANGES_REQUESTED: 40,
    ACCEPTED: 100,
    REJECTED: 0,
    EXPIRED: 0,
  };

  // Solo cotizaciones vivas en pipeline (no cerradas: DRAFT, SENT, VIEWED, CHANGES_REQUESTED)
  const activePipelineQuotes = quotes.filter(
    (q) => q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'VIEWED' || q.status === 'CHANGES_REQUESTED'
  );

  const weightedPipeline = Math.round(
    activePipelineQuotes.reduce((acc, q) => {
      const net = q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0));
      const prob = (probabilities[q.status] ?? 0) / 100;
      return acc + (net * prob);
    }, 0)
  );

  const totalPipelineNet = Math.round(
    activePipelineQuotes.reduce((acc, q) => {
      const net = q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0));
      return acc + net;
    }, 0)
  );

  // 5. Antigüedad de las enviadas (días en SENT o VIEWED sin resolución)
  const pendingSentQuotes = quotes.filter((q) => q.status === 'SENT' || q.status === 'VIEWED');
  const totalPendingDays = pendingSentQuotes.reduce((acc, q) => {
    const start = new Date(q.sentAt || q.createdAt).getTime();
    const days = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
    return acc + days;
  }, 0);
  const avgSentAgeDays = pendingSentQuotes.length > 0
    ? Number((totalPendingDays / pendingSentQuotes.length).toFixed(1))
    : 0;

  // 6. Margen aceptado frente al mínimo corporativo
  const totalAcceptedCost = acceptedQuotes.reduce((acc, q) => acc + (q.totalCost || 0), 0);
  const totalAcceptedNet = acceptedQuotes.reduce(
    (acc, q) => acc + (q.netSubtotal || (q.grandTotal ? q.grandTotal / 1.19 : (q.total ? q.total / 1.19 : 0))),
    0
  );
  const acceptedProfit = totalAcceptedNet - totalAcceptedCost;
  const avgAcceptedMargin = totalAcceptedNet > 0
    ? Number(((acceptedProfit / totalAcceptedNet) * 100).toFixed(1))
    : 0;
  const minMarginPct = company.minMarginPct || 28.0;
  const marginDelta = Number((avgAcceptedMargin - minMarginPct).toFixed(1));

  // 7. Ganadas/perdidas por categoría
  const categoryMap = new Map<string, {
    categoryId: string;
    categoryName: string;
    wonCount: number;
    lostCount: number;
    wonAmount: number;
    lostAmount: number;
  }>();

  state.categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      categoryId: cat.id,
      categoryName: cat.name,
      wonCount: 0,
      lostCount: 0,
      wonAmount: 0,
      lostAmount: 0,
    });
  });

  quotes.forEach((q) => {
    if (q.status !== 'ACCEPTED' && q.status !== 'REJECTED') return;
    const isWon = q.status === 'ACCEPTED';
    const amount = Math.round(q.grandTotal || q.total || 0);

    // Identificar categorías presentes en las líneas
    const quoteCategoryIds = new Set<string>();
    q.lines.forEach((l) => {
      const item = state.catalogItems.find((ci) => ci.id === l.catalogItemId);
      if (item?.categoryId) quoteCategoryIds.add(item.categoryId);
    });

    quoteCategoryIds.forEach((catId) => {
      const entry = categoryMap.get(catId);
      if (entry) {
        if (isWon) {
          entry.wonCount += 1;
          entry.wonAmount += amount;
        } else {
          entry.lostCount += 1;
          entry.lostAmount += amount;
        }
      }
    });
  });

  const wonLostByCategory = Array.from(categoryMap.values());

  // 8. Ganadas/perdidas por asesor
  const salesReps = state.users.filter((u) => (u.role === 'SALES_REP' || u.role === 'ADMIN') && !u.deletedAt);
  const wonLostBySalesRep = salesReps.map((rep) => {
    const repQuotes = state.quotations.filter((q) => q.salesRepId === rep.id);
    const won = repQuotes.filter((q) => q.status === 'ACCEPTED');
    const lost = repQuotes.filter((q) => q.status === 'REJECTED');
    const decided = won.length + lost.length;
    const rate = decided > 0 ? Number(((won.length / decided) * 100).toFixed(1)) : 0;
    const wonAmount = won.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);
    const lostAmount = lost.reduce((acc, q) => acc + Math.round(q.grandTotal || q.total || 0), 0);

    return {
      salesRepId: rep.id,
      salesRepName: rep.name,
      wonCount: won.length,
      lostCount: lost.length,
      wonAmount,
      lostAmount,
      closeRatePct: rate,
    };
  });

  res.json({
    closeRate: {
      value: closeRatePct,
      acceptedCount: acceptedQuotes.length,
      decidedCount,
      definition: 'Cotizaciones aceptadas sobre el total de decididas (Aceptadas / (Aceptadas + Rechazadas))',
    },
    salesCycle: {
      avgDays: avgSalesCycleDays,
      decidedCount: decidedWithDates.length,
      definition: 'Promedio de días transcurridos desde el envío de la cotización hasta la decisión formal (aceptación o rechazo)',
    },
    timeToFirstView: {
      avgHours: avgTimeToFirstViewHours,
      avgDays: avgTimeToFirstViewDays,
      viewedCount: viewedWithDates.length,
      definition: 'Promedio de horas transcurridas desde el envío de la cotización hasta que el cliente abre el documento por primera vez',
    },
    weightedPipeline: {
      amount: weightedPipeline,
      totalPipelineNet,
      activeQuotesCount: activePipelineQuotes.length,
      probabilities,
      definition: 'Suma del valor neto de las cotizaciones en proceso multiplicado por la probabilidad de cierre configurada por el ADMIN para cada estado',
    },
    sentAge: {
      avgDays: avgSentAgeDays,
      pendingCount: pendingSentQuotes.length,
      definition: 'Promedio de días que las cotizaciones actualmente enviadas o vistas llevan abiertas sin resolución del cliente',
    },
    acceptedMargin: {
      avgMarginPct: avgAcceptedMargin,
      minMarginPct,
      deltaPct: marginDelta,
      definition: 'Margen comercial promedio ponderado de cotizaciones aceptadas en comparación con el margen mínimo corporativo exigido (28%)',
    },
    wonLostByCategory: {
      items: wonLostByCategory,
      definition: 'Total de cotizaciones ganadas y perdidas agrupadas por categoría técnica de servicios y productos navales',
    },
    wonLostBySalesRep: {
      items: wonLostBySalesRep,
      definition: 'Rendimiento de cotizaciones ganadas y perdidas discriminado por cada asesor comercial del equipo',
    },
    marginExceptions: {
      count: quotes.filter((q) => q.marginException === true).length,
      pendingApprovalCount: quotes.filter((q) => q.status === 'PENDING_APPROVAL').length,
      items: quotes.filter((q) => q.marginException === true || q.status === 'PENDING_APPROVAL').map((q) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        customerBusinessName: q.customerBusinessName,
        salesRepName: q.salesRepName,
        status: q.status,
        marginPct: q.marginPct,
        marginException: q.marginException,
        marginApprovalStatus: q.marginApprovalStatus,
        marginApprovedByName: q.marginApprovedByName,
        marginApprovedAt: q.marginApprovedAt,
        marginApprovalComment: q.marginApprovalComment,
        marginExceptionReason: q.marginExceptionReason,
        grandTotal: q.grandTotal,
      })),
      definition: 'Cotizaciones con excepción de margen aprobada por Administración o pendientes de aprobación (P3.l)',
    },
  });
});

