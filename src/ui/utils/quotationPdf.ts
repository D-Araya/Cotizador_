import { jsPDF } from 'jspdf';
import { Quotation, CompanySettings, Customer, Contact, User } from '../../modules/types.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';

export interface PdfGenerationParams {
  quotation: Quotation;
  company: CompanySettings;
  customer?: Customer | null;
  contact?: Contact | null;
  salesRep?: User | { name?: string; email?: string; phone?: string } | null;
}

/**
 * Genera y descarga un archivo PDF vectorial oficial de la cotización técnica/comercial.
 * Utiliza jsPDF directamente para garantizar compatibilidad con sandbox de iframes y navegadores móviles.
 */
export function downloadQuotationPdf({
  quotation,
  company,
  customer,
  contact,
  salesRep,
}: PdfGenerationParams): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = margin;
      drawPageBorderAndDecorations();
    }
  };

  const drawPageBorderAndDecorations = () => {
    // Línea superior decorativa
    doc.setFillColor(30, 58, 138); // Navy blue
    doc.rect(margin, margin - 6, contentWidth, 2, 'F');
  };

  drawPageBorderAndDecorations();

  // 1. ENCABEZADO Y MEMBRETE DE LA EMPRESA
  // Barra vertical de acento
  doc.setFillColor(37, 99, 235); // Indigo/Blue
  doc.rect(margin, y, 3, 14, 'F');

  // Datos Empresa (Izquierda)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(company.name || 'M&L Ingeniería Naval SpA', margin + 6, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`RUT: ${company.rut || '77.892.410-2'}`, margin + 6, y + 9.5);
  doc.text(`${company.address || 'Puerto Montt, Región de Los Lagos, Chile'}`, margin + 6, y + 13.5);
  doc.text(`Email: ${company.email || 'contacto@mlingenieria.cl'}  |  Tel: ${company.phone || '+56 65 290 8400'}`, margin + 6, y + 17.5);

  // Datos de la Cotización (Derecha)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138); // navy
  doc.text('PROPUESTA TÉCNICO-COMERCIAL', pageWidth - margin, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(quotation.quotationNumber || 'COT-000000', pageWidth - margin, y + 10.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const issueDate = quotation.createdAt
    ? new Date(quotation.createdAt).toLocaleDateString('es-CL')
    : new Date().toLocaleDateString('es-CL');
  doc.text(`Emisión: ${issueDate}`, pageWidth - margin, y + 14.5, { align: 'right' });
  doc.text(`Validez: ${quotation.validityDays || 15} días corridos`, pageWidth - margin, y + 18, { align: 'right' });

  // Estado
  const statusText = quotation.status === 'ACCEPTED' ? 'Aceptada' : quotation.status === 'REJECTED' ? 'Rechazada' : 'Vigente';
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - margin - 35, y + 20, 35, 5.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Estado: ${statusText}`, pageWidth - margin - 17.5, y + 23.8, { align: 'center' });

  y += 29;

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // 2. FICHA CLIENTE Y ASESOR COMERCIAL (Dos columnas en tarjeta)
  const cardHeight = 31;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

  const colWidth = (contentWidth - 6) / 2;
  const col1X = margin + 4;
  const col2X = margin + colWidth + 6;

  // Columna 1: Mandante / Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MANDANTE / CLIENTE:', col1X, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const clientName = customer?.businessName || (quotation as any).customerBusinessName || 'Naviera y Transportes del Sur Austral Ltda.';
  doc.text(clientName.length > 42 ? clientName.substring(0, 40) + '...' : clientName, col1X, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`RUT: ${customer?.taxId || (quotation as any).customerTaxId || '77.210.980-3'}`, col1X, y + 14.5);
  const clientAddr = customer?.address || 'Puerto Montt, Región de Los Lagos';
  doc.text(clientAddr.length > 45 ? clientAddr.substring(0, 43) + '...' : clientAddr, col1X, y + 18.5);

  const contactName = contact?.name || 'Capitán Fernando Almonacid';
  const contactPos = contact?.position || 'Jefe de Operaciones';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`Atención: ${contactName} — ${contactPos}`, col1X, y + 23);
  if (contact?.email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(contact.email, col1X, y + 27);
  }

  // Divisoria vertical entre columnas
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + colWidth + 2, y + 2, margin + colWidth + 2, y + cardHeight - 2);

  // Columna 2: Asesor Comercial y Proyecto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ASESOR COMERCIAL RESPONSABLE:', col2X, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const repName = salesRep?.name || 'Sebastián Morales (Ingeniero Naval de Proyectos)';
  doc.text(repName, col2X, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${salesRep?.email || company.email || 'smorales@mlingenieria.cl'}`, col2X, y + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PROYECTO / OBJETO DEL SERVICIO:', col2X, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const projectName = (quotation as any).projectName || quotation.title || 'Servicios y Suministros de Ingeniería Naval';
  doc.text(projectName.length > 45 ? projectName.substring(0, 43) + '...' : projectName, col2X, y + 24.5);

  y += cardHeight + 4;

  // 3. TEXTO DE PRESENTACIÓN
  if (quotation.presentationText) {
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.setDrawColor(99, 102, 241); // indigo-500
    doc.setLineWidth(0.6);

    const splitPresText = doc.splitTextToSize(`“${quotation.presentationText}”`, contentWidth - 8);
    const boxHeight = splitPresText.length * 4 + 4;

    doc.rect(margin, y, contentWidth, boxHeight, 'F');
    // Borde izquierdo resaltado
    doc.setFillColor(79, 70, 229);
    doc.rect(margin, y, 2, boxHeight, 'F');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(splitPresText, margin + 5, y + 4.5);

    y += boxHeight + 4;
  }

  // 4. TABLA DETALLADA DE PARTIDAS / ÍTEMS (PRODUCTOS Y SERVICIOS)
  checkPageBreak(35);

  const allLines = quotation.lines && quotation.lines.length > 0 ? quotation.lines : [];

  // Encabezado de la tabla
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, y, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  const colItemX = margin + 3;
  const colUnitX = margin + 98;
  const colQtyX = margin + 118;
  const colPriceX = margin + 148;
  const colTotalX = margin + contentWidth - 3;

  doc.text('Ítem / Descripción del Servicio o Suministro', colItemX, y + 4.6);
  doc.text('Unidad', colUnitX, y + 4.6, { align: 'center' });
  doc.text('Cant.', colQtyX, y + 4.6, { align: 'center' });
  doc.text('P. Unitario', colPriceX, y + 4.6, { align: 'right' });
  doc.text('Total Neto', colTotalX, y + 4.6, { align: 'right' });

  y += 7;

  if (allLines.length === 0) {
    // Si no hay líneas específicas, agregar una fila informativa
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Servicios profesionales de ingeniería naval según propuesta técnica acordada', colItemX, y + 5.2);
    doc.text('GLOBAL', colUnitX, y + 5.2, { align: 'center' });
    doc.text('1', colQtyX, y + 5.2, { align: 'center' });
    doc.text(formatMoney(quotation.subtotal, company.currency), colPriceX, y + 5.2, { align: 'right' });
    doc.text(formatMoney(quotation.subtotal, company.currency), colTotalX, y + 5.2, { align: 'right' });
    y += 8;
  } else {
    allLines.forEach((line, idx) => {
      checkPageBreak(12);

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);

      const itemName = line.name || (line as any).description || 'Ítem de Servicio Naval';
      const codeOrSku = line.skuOrCode || (line as any).code || (line as any).sku || '';
      const unit = line.unit || 'UND';
      const qty = line.quantity || 1;
      const unitPrice = line.price ?? (line as any).unitPrice ?? 0;
      const lineSubtotal = line.subtotal ?? (unitPrice * qty);

      const splitName = doc.splitTextToSize(itemName, 90);
      const rowHeight = Math.max(7, splitName.length * 3.8 + (codeOrSku ? 3.5 : 2));

      doc.rect(margin, y, contentWidth, rowHeight, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(splitName, colItemX, y + 3.8);

      if (codeOrSku) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Ref: ${codeOrSku}`, colItemX, y + splitName.length * 3.8 + 2.5);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(unit, colUnitX, y + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(qty), colQtyX, y + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(formatMoney(unitPrice, company.currency), colPriceX, y + 4.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatMoney(lineSubtotal, company.currency), colTotalX, y + 4.5, { align: 'right' });

      y += rowHeight;
    });
  }

  // Línea inferior de la tabla
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // 5. COSTOS ADICIONALES OPCIONALES (si existen)
  if (quotation.extraCosts && quotation.extraCosts.length > 0) {
    checkPageBreak(18);
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.setLineWidth(0.3);
    const ecHeight = 6 + quotation.extraCosts.length * 4;
    doc.roundedRect(margin, y, contentWidth, ecHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14); // amber-800
    doc.text('COSTOS ADICIONALES OPCIONALES (NO INCLUIDOS EN EL TOTAL):', margin + 3, y + 4);

    let ecY = y + 7.5;
    quotation.extraCosts.forEach((ec) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 53, 15);
      doc.text(`• ${ec.name}${ec.notes ? ` (${ec.notes})` : ''}`, margin + 5, ecY);
      doc.setFont('helvetica', 'bold');
      doc.text(formatMoney(ec.subtotal, company.currency), pageWidth - margin - 3, ecY, { align: 'right' });
      ecY += 4;
    });

    y += ecHeight + 4;
  }

  // 6. RESUMEN ECONÓMICO (TOTALES)
  checkPageBreak(32);

  const totalBoxWidth = 75;
  const totalBoxX = pageWidth - margin - totalBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Neto:', totalBoxX + 4, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(formatMoney(quotation.subtotal, company.currency), totalBoxX + totalBoxWidth - 4, y + 5.5, { align: 'right' });

  const taxPct = company.taxRatePct ?? 19;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`IVA (${taxPct}%):`, totalBoxX + 4, y + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(formatMoney(quotation.taxAmount, company.currency), totalBoxX + totalBoxWidth - 4, y + 10.5, { align: 'right' });

  // Divisoria
  doc.setDrawColor(203, 213, 225);
  doc.line(totalBoxX + 3, y + 13.5, totalBoxX + totalBoxWidth - 3, y + 13.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL:', totalBoxX + 4, y + 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text(formatMoney(quotation.grandTotal, company.currency), totalBoxX + totalBoxWidth - 4, y + 19.5, { align: 'right' });

  y += 28;

  // 7. NOTAS TÉCNICAS Y CONDICIONES COMERCIALES
  checkPageBreak(28);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const notesColWidth = (contentWidth - 6) / 2;

  // Columna Notas Técnicas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('NOTAS TÉCNICAS:', margin, y + 3);

  const notesText = quotation.notes || 'Los planos y memorias técnicas se entregarán en formato DWG y PDF firmados por Ingeniero Naval colegiado para tramitación DIRECTEMAR.';
  const splitNotes = doc.splitTextToSize(notesText, notesColWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(splitNotes, margin, y + 7);

  // Columna Condiciones Comerciales
  const condX = margin + notesColWidth + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CONDICIONES COMERCIALES:', condX, y + 3);

  const termsText = quotation.terms || '1. Valores expresados en Pesos Chilenos (CLP) netos, más IVA (19%).\n2. Forma de pago: 50% anticipo al inicio de los trabajos y 50% contra entrega de planos.\n3. Plazos de entrega: Según cronograma acordado (2 a 6 semanas habituales).\n4. Validez de la cotización: 15 días corridos a contar de su fecha de emisión.';
  const splitTerms = doc.splitTextToSize(termsText, notesColWidth);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(splitTerms, condX, y + 7);

  const maxNotesHeight = Math.max(splitNotes.length * 3.4, splitTerms.length * 3.4) + 8;
  y += maxNotesHeight + 4;

  // 8. CUADRO FORMAL DE FIRMAS
  checkPageBreak(30);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const signBoxWidth = (contentWidth - 16) / 2;
  const signBox1X = margin + 4;
  const signBox2X = margin + signBoxWidth + 12;

  // Firma 1: M&L Ingeniería Naval SpA
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(signBox1X, y + 14, signBox1X + signBoxWidth, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('[Firma y Timbre Autorizado]', signBox1X + signBoxWidth / 2, y + 13, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(salesRep?.name || company.name, signBox1X + signBoxWidth / 2, y + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(company.name || 'M&L Ingeniería Naval SpA', signBox1X + signBoxWidth / 2, y + 21.5, { align: 'center' });

  // Firma 2: Mandante / Cliente
  doc.line(signBox2X, y + 14, signBox2X + signBoxWidth, y + 14);

  if (quotation.status === 'ACCEPTED' && (quotation as any).decision) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(5, 150, 105); // emerald
    doc.text(`✓ Aceptado Digitalmente por ${(quotation as any).decision.signerName}`, signBox2X + signBoxWidth / 2, y + 13, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('[Firma y Aceptación Mandante]', signBox2X + signBoxWidth / 2, y + 13, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(clientName, signBox2X + signBoxWidth / 2, y + 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`RUT: ${customer?.taxId || (quotation as any).customerTaxId || '77.210.980-3'}`, signBox2X + signBoxWidth / 2, y + 21.5, { align: 'center' });

  y += 26;

  // 9. PIE DE PÁGINA
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Documento oficial generado por Cotizador Online • M&L Ingeniería Naval SpA • Puerto Montt, Región de Los Lagos, Chile • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Descargar archivo PDF
  const filename = `Cotizacion_${quotation.quotationNumber || 'Documento'}.pdf`;
  doc.save(filename);
}
