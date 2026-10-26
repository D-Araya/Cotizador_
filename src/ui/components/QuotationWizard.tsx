import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  FileCheck,
  Send,
  Save,
  HelpCircle,
  Paperclip,
  ExternalLink,
  Layers,
  X,
} from 'lucide-react';
import {
  User,
  Customer,
  Contact,
  CatalogItem,
  Category,
  QuotationLine,
  ExtraCostLine,
  CompanySettings,
  QuotationTemplate,
} from '../../modules/types.ts';
import { MarginPolicy } from '../../shared-kernel/pricing/MarginPolicy.ts';
import { computeTotals } from '../../shared-kernel/pricing/computeTotals.ts';
import { ItemTypeBadge } from './CommonBadges.tsx';
import { Skeleton } from './Skeleton.tsx';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { DocumentToDraftModal } from './DocumentToDraftModal.tsx';
import { TemplatesModal } from './TemplatesModal.tsx';

interface WizardProps {
  company: CompanySettings;
  salesRepId: string;
  currentUser?: User;
  usersList?: User[];
  onFinished: (quotationId: string) => void;
  onCancel: () => void;
  initialStep?: number;
  initialLines?: QuotationLine[];
  initialTemplate?: QuotationTemplate | null;
}

export function QuotationWizard({
  company,
  salesRepId,
  currentUser,
  usersList,
  onFinished,
  onCancel,
  initialStep = 1,
  initialLines = [],
  initialTemplate,
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Step 1 State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [chosenSalesRepId, setChosenSalesRepId] = useState<string>(salesRepId);
  const [currency, setCurrency] = useState<string>(company.currency || 'CLP');
  const [createdQuotationId, setCreatedQuotationId] = useState<string>('');

  // Step 2 State (Lines)
  const [lines, setLines] = useState<QuotationLine[]>(initialLines);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(0);
  const [marginExceptionReason, setMarginExceptionReason] = useState<string>('');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [showAiDraftModal, setShowAiDraftModal] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);

  // Save as Template Modal State
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [saveTemplateName, setSaveTemplateName] = useState<string>('');
  const [saveTemplateCategoryId, setSaveTemplateCategoryId] = useState<string>('');
  const [saveTemplateDescription, setSaveTemplateDescription] = useState<string>('');
  const [saveTemplateIncludeTerms, setSaveTemplateIncludeTerms] = useState<boolean>(true);
  const [saveTemplateIncludePresentation, setSaveTemplateIncludePresentation] = useState<boolean>(true);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [saveTemplateSuccessMsg, setSaveTemplateSuccessMsg] = useState<string | null>(null);
  const [saveTemplateErrorMsg, setSaveTemplateErrorMsg] = useState<string | null>(null);

  // Step 3 State (Extra Costs)
  const [extraCosts, setExtraCosts] = useState<ExtraCostLine[]>([]);
  const [extraCostName, setExtraCostName] = useState<string>('');
  const [extraCostUnit, setExtraCostUnit] = useState<string>('GLOBAL');
  const [extraCostPrice, setExtraCostPrice] = useState<number>(150);
  const [extraCostNotes, setExtraCostNotes] = useState<string>('');

  // Step 4 State (Texts and preview + Attachments P3.n)
  const [presentationText, setPresentationText] = useState<string>(company.defaultPresentationText);
  const [notes, setNotes] = useState<string>('Entrega según cronograma técnico. Precios expresados en Pesos Chilenos (CLP) netos más IVA (19%). Planos y memorias firmadas por Ingeniero Naval colegiado.');
  const [terms, setTerms] = useState<string>(company.defaultTerms);
  const [validityDays, setValidityDays] = useState<number>(15);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; url: string; description?: string }>>([]);
  const [newAttName, setNewAttName] = useState<string>('');
  const [newAttUrl, setNewAttUrl] = useState<string>('');
  const [newAttDesc, setNewAttDesc] = useState<string>('');

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState<boolean>(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  // Keyboard accessibility: Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === 'Escape' &&
        !showSendConfirmModal &&
        !showCatalogModal &&
        !showAiDraftModal &&
        !showTemplatesModal &&
        !showSaveTemplateModal
      ) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSendConfirmModal,
    showCatalogModal,
    showAiDraftModal,
    showTemplatesModal,
    showSaveTemplateModal,
    onCancel,
  ]);

  // Auto-save draft on changes (Requirement 4)
  useEffect(() => {
    if (!createdQuotationId || currentStep < 2) return;
    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      const res = await apiRequest(`/api/v1/quotations/${createdQuotationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          presentationText,
          notes,
          terms,
          validityDays,
        }),
      });
      if (res.error) {
        setAutoSaveStatus('error');
        setAutoSaveError(res.error.detail || 'Fallo de autoguardado del borrador');
      } else {
        setAutoSaveStatus('saved');
        setAutoSaveError(null);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [createdQuotationId, currentStep, presentationText, notes, terms, validityDays]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      const [custRes, catRes, categoriesRes] = await Promise.all([
        apiRequest<Customer[]>('/api/v1/customers'),
        apiRequest<CatalogItem[]>('/api/v1/catalog-items'),
        apiRequest<Category[]>('/api/v1/categories'),
      ]);
      if (custRes.data) setCustomers(custRes.data);
      if (catRes.data) setCatalogItems(catRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      setLoadingData(false);
    }
    loadData();
  }, []);

  // When initialTemplate is passed, pre-populate lines and terms
  useEffect(() => {
    if (initialTemplate && catalogItems.length > 0) {
      handleApplyTemplate(initialTemplate);
    }
  }, [initialTemplate, catalogItems]);

  // When customer changes, load their contacts
  useEffect(() => {
    if (!selectedCustomerId) {
      setContacts([]);
      setSelectedContactId('');
      return;
    }
    async function loadContacts() {
      const res = await apiRequest<Contact[]>(`/api/v1/customers/${selectedCustomerId}/contacts`);
      if (res.data) {
        setContacts(res.data);
        if (res.data.length > 0) {
          setSelectedContactId(res.data[0].id);
        } else {
          setSelectedContactId('');
        }
      }
    }
    loadContacts();
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // Live consolidated margin and discount calculation using computeTotals (canonical source of truth)
  const totals = computeTotals(
    lines.map((l) => ({
      cost: l.cost,
      price: l.price,
      quantity: l.quantity,
      marginPct: l.marginPct,
      discountPct: l.discountPct || 0,
    })),
    company.minMarginPct,
    company.taxRatePct,
    globalDiscountPct,
    company.hardMinMarginPct,
    company.ufRate
  );

  const subtotal = totals.netSubtotal;
  const taxAmount = totals.taxAmount;
  const grandTotal = totals.grandTotal;

  // STEP 1: Continue -> Create draft on backend (or advance if already created)
  async function handleAdvanceStep1() {
    if (!selectedCustomerId || !selectedContactId) {
      setErrorMsg('Debe seleccionar un cliente y un contacto para continuar.');
      return;
    }

    // Do not create duplicate drafts if already created
    if (createdQuotationId) {
      setErrorMsg(null);
      setCurrentStep(2);
      return;
    }

    setErrorMsg(null);
    setSaving(true);

    const res = await apiRequest('/api/v1/quotations', {
      method: 'POST',
      body: JSON.stringify({
        customerId: selectedCustomerId,
        contactId: selectedContactId,
        salesRepId: chosenSalesRepId || salesRepId,
        currency,
      }),
    });

    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al crear borrador');
      return;
    }

    setCreatedQuotationId(res.data.id);
    setCurrentStep(2);
  }

  // STEP 2: Add line from catalog
  function handleAddCatalogItem(item: CatalogItem) {
    const itemMargin = item.listPrice > 0 && item.listPrice >= item.unitCost
      ? parseFloat((((item.listPrice - item.unitCost) / item.listPrice) * 100).toFixed(2))
      : Math.max(company.minMarginPct, 28.0);

    const price = item.listPrice > 0 ? item.listPrice : MarginPolicy.calculatePriceFromMargin(item.unitCost, itemMargin);

    const newLine: QuotationLine = {
      id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      catalogItemId: item.id,
      type: item.type,
      skuOrCode: item.type === 'PRODUCT' ? (item as any).sku : (item as any).code,
      name: item.name,
      unit: (item as any).unit || 'UND',
      cost: item.unitCost,
      price: price,
      discountPct: 0,
      marginPct: itemMargin,
      quantity: 1,
      subtotal: price,
      costTotal: item.unitCost,
    };

    setLines([...lines, newLine]);
    setShowCatalogModal(false);
  }

  // Update line: Bidirectional margin <-> price recalculation and discounts!
  function handleUpdateLine(
    index: number,
    field: 'quantity' | 'cost' | 'price' | 'marginPct' | 'discountPct',
    value: number
  ) {
    const updated = [...lines];
    const line = { ...updated[index] };

    if (field === 'discountPct') {
      line.discountPct = Math.max(0, Math.min(99.9, value));
    } else if (field === 'quantity') {
      line.quantity = value > 0 ? value : 1;
      const res = MarginPolicy.computeLine({
        cost: line.cost,
        price: line.price,
        quantity: line.quantity,
      });
      line.subtotal = res.subtotal;
      line.costTotal = res.costTotal;
    } else if (field === 'cost') {
      line.cost = value >= 0 ? value : 0;
      // Recalculate price preserving current margin
      try {
        const newPrice = MarginPolicy.calculatePriceFromMargin(line.cost, line.marginPct);
        line.price = newPrice;
        const res = MarginPolicy.computeLine({
          cost: line.cost,
          price: newPrice,
          quantity: line.quantity,
        });
        line.subtotal = res.subtotal;
        line.costTotal = res.costTotal;
      } catch (err: any) {
        console.error(err);
      }
    } else if (field === 'marginPct') {
      line.marginPct = value;
      try {
        const newPrice = MarginPolicy.calculatePriceFromMargin(line.cost, value);
        line.price = newPrice;
        const res = MarginPolicy.computeLine({
          cost: line.cost,
          price: newPrice,
          quantity: line.quantity,
        });
        line.subtotal = res.subtotal;
        line.costTotal = res.costTotal;
      } catch (err: any) {
        console.error(err);
      }
    } else if (field === 'price') {
      line.price = value;
      try {
        const newMargin = MarginPolicy.calculateMarginFromPrice(line.cost, value);
        line.marginPct = newMargin;
        const res = MarginPolicy.computeLine({
          cost: line.cost,
          price: value,
          quantity: line.quantity,
        });
        line.subtotal = res.subtotal;
        line.costTotal = res.costTotal;
      } catch (err: any) {
        console.error(err);
      }
    }

    updated[index] = line;
    setLines(updated);
  }

  function handleRemoveLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  function handleApplyTemplate(tmpl: QuotationTemplate) {
    const newLines: QuotationLine[] = [];
    tmpl.lines.forEach((tl, idx) => {
      const item = catalogItems.find((ci) => ci.id === tl.catalogItemId);
      if (item) {
        const margin = item.listPrice > 0
          ? Number((((item.listPrice - item.unitCost) / item.listPrice) * 100).toFixed(1))
          : 0;
        newLines.push({
          id: `line-${Date.now()}-${idx}`,
          catalogItemId: item.id,
          type: item.type,
          skuOrCode: item.type === 'PRODUCT' ? (item as any).sku : (item as any).code,
          name: item.name,
          unit: (item as any).unit || (item.type === 'PRODUCT' ? 'UND' : 'SERVICIO'),
          cost: item.unitCost,
          price: item.listPrice,
          marginPct: margin,
          quantity: tl.quantity || 1,
          subtotal: item.listPrice * (tl.quantity || 1),
          costTotal: item.unitCost * (tl.quantity || 1),
          discountPct: tl.discountPct || 0,
          discountAmount: 0,
          originalUnitPrice: item.listPrice,
        });
      }
    });

    setLines(newLines);
    if (tmpl.terms) setTerms(tmpl.terms);
    if (tmpl.presentationText) setPresentationText(tmpl.presentationText);
  }

  function handleApplyAiSuggestions(aiLines: QuotationLine[], aiPresentationText?: string) {
    setLines(aiLines);
    if (aiPresentationText) setPresentationText(aiPresentationText);
  }

  // STEP 2: Advance to Step 3 (P3.l Validates hard floor and margin exception)
  async function handleAdvanceStep2() {
    if (lines.length === 0) {
      setErrorMsg('Debe agregar al menos un producto o servicio a la cotización.');
      return;
    }

    const hardFloor = company.hardMinMarginPct !== undefined ? company.hardMinMarginPct : 0;
    if (totals.marginPct < hardFloor) {
      setErrorMsg(
        `El margen actual (${totals.marginPct.toFixed(2)}%) es inferior al piso duro no negociable (${hardFloor}%). La cotización está estrictamente bloqueada.`
      );
      return;
    }

    if (!totals.meetsMinimum && !marginExceptionReason.trim()) {
      setErrorMsg(
        `El margen actual (${totals.marginPct.toFixed(2)}%) está por debajo del mínimo corporativo (${company.minMarginPct.toFixed(2)}%). Debe indicar un motivo comercial o técnico para solicitar aprobación de excepción a Administración.`
      );
      return;
    }

    setErrorMsg(null);
    setSaving(true);

    const res = await apiRequest(`/api/v1/quotations/${createdQuotationId}/lines`, {
      method: 'PUT',
      body: JSON.stringify({
        lines: lines.map((l) => ({
          catalogItemId: l.catalogItemId,
          quantity: l.quantity,
          price: l.price,
          marginPct: l.marginPct,
          discountPct: l.discountPct || 0,
          description: l.name,
        })),
        discountPct: globalDiscountPct,
        marginExceptionReason: marginExceptionReason.trim() || undefined,
      }),
    });

    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al guardar líneas de cotización');
      return;
    }

    setCurrentStep(3);
  }

  // STEP 3: Extra costs
  function handleAddExtraCost() {
    if (!extraCostName.trim()) return;
    const newExtra: ExtraCostLine = {
      id: `ec-${Date.now()}`,
      type: 'SERVICE',
      name: extraCostName.trim(),
      unit: extraCostUnit,
      cost: 0,
      price: extraCostPrice,
      quantity: 1,
      subtotal: extraCostPrice,
      notes: extraCostNotes || undefined,
    };
    setExtraCosts([...extraCosts, newExtra]);
    setExtraCostName('');
    setExtraCostPrice(150);
    setExtraCostNotes('');
  }

  function handleRemoveExtraCost(index: number) {
    setExtraCosts(extraCosts.filter((_, i) => i !== index));
  }

  async function handleAdvanceStep3() {
    setErrorMsg(null);
    setSaving(true);

    const res = await apiRequest(`/api/v1/quotations/${createdQuotationId}/extra-costs`, {
      method: 'PUT',
      body: JSON.stringify({ extraCosts }),
    });

    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al guardar costos adicionales');
      return;
    }

    setCurrentStep(4);
  }

  // STEP 4: Open Save as Template Modal
  function handleOpenSaveTemplateModal() {
    setSaveTemplateErrorMsg(null);
    setSaveTemplateSuccessMsg(null);
    const defaultName = selectedCustomer?.businessName
      ? `Plantilla: ${selectedCustomer.businessName}`
      : lines.length > 0
      ? `Plantilla: ${lines[0].name}`
      : 'Nueva Plantilla de Cotización';
    setSaveTemplateName(defaultName);
    const firstCat = lines.length > 0 && lines[0].catalogItemId
      ? catalogItems.find((c) => c.id === lines[0].catalogItemId)?.categoryId
      : undefined;
    setSaveTemplateCategoryId(firstCat || categories[0]?.id || 'cat-01');
    setSaveTemplateDescription(`Plantilla técnica basada en la cotización actual con ${lines.length} partida(s).`);
    setSaveTemplateIncludeTerms(true);
    setSaveTemplateIncludePresentation(true);
    setShowSaveTemplateModal(true);
  }

  // STEP 4: Confirm Save as Template
  async function handleConfirmSaveTemplate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!saveTemplateName.trim()) {
      setSaveTemplateErrorMsg('Debe ingresar un nombre para la plantilla.');
      return;
    }
    if (lines.length === 0) {
      setSaveTemplateErrorMsg('La cotización no contiene partidas técnicas para guardar como plantilla.');
      return;
    }

    setSavingTemplate(true);
    setSaveTemplateErrorMsg(null);
    setSaveTemplateSuccessMsg(null);

    const templateLines = lines.map((l) => {
      let catalogItemId = l.catalogItemId;
      if (!catalogItemId) {
        const found = catalogItems.find((ci) => ci.name.toLowerCase() === l.name.toLowerCase());
        catalogItemId = found?.id || catalogItems[0]?.id || 'serv-01';
      }
      return {
        catalogItemId,
        quantity: Math.max(1, l.quantity || 1),
        discountPct: l.discountPct || 0,
      };
    });

    const payload = {
      name: saveTemplateName.trim(),
      categoryId: saveTemplateCategoryId || categories[0]?.id || 'cat-01',
      description: saveTemplateDescription.trim(),
      lines: templateLines,
      terms: saveTemplateIncludeTerms ? terms : company.defaultTerms,
      presentationText: saveTemplateIncludePresentation ? presentationText : company.defaultPresentationText,
    };

    const res = await apiRequest('/api/v1/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setSavingTemplate(false);

    if (res.error) {
      setSaveTemplateErrorMsg((res.error as any).detail || 'Error al guardar la plantilla.');
      return;
    }

    setSaveTemplateSuccessMsg(`¡Plantilla "${saveTemplateName.trim()}" guardada exitosamente! Ya está disponible para su uso.`);
  }

  // STEP 4: Save draft
  async function handleSaveDraft() {
    setSaving(true);
    await apiRequest(`/api/v1/quotations/${createdQuotationId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        presentationText,
        notes,
        terms,
        validityDays,
      }),
    });
    setSaving(false);
    onFinished(createdQuotationId);
  }

  // STEP 4: Send Quotation to Client (triggers QuotationSent event & outbox notifications)
  async function handleConfirmSend() {
    if (autoSaveError) {
      setErrorMsg(`Aviso crítico: El guardado automático falló (${autoSaveError}). Debe resolver el error antes de enviar la cotización.`);
      return;
    }

    setShowSendConfirmModal(false);
    setSaving(true);

    // Save final texts first and verify success
    const patchRes = await apiRequest(`/api/v1/quotations/${createdQuotationId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        presentationText,
        notes,
        terms,
        validityDays,
      }),
    });

    if (patchRes.error) {
      setSaving(false);
      setErrorMsg(`Aviso: Falló el guardado del borrador antes del envío (${patchRes.error.detail || 'Error de guardado'}). Envío cancelado para evitar inconsistencias.`);
      return;
    }

    const res = await apiRequest(`/api/v1/quotations/${createdQuotationId}/send`, {
      method: 'POST',
    });

    setSaving(false);
    if (res.error) {
      setErrorMsg(res.error.detail || 'Error al enviar la cotización');
      return;
    }

    onFinished(createdQuotationId);
  }

  // STEP 4: Add Attachment (P3.n Enlaces a archivos)
  async function handleAddAttachment() {
    if (!newAttName.trim() || !newAttUrl.trim()) return;
    if (createdQuotationId) {
      const res = await apiRequest(`/api/v1/quotations/${createdQuotationId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          name: newAttName.trim(),
          url: newAttUrl.trim(),
          description: newAttDesc.trim() || undefined,
        }),
      });
      if (res.data) {
        setAttachments([...attachments, res.data]);
        setNewAttName('');
        setNewAttUrl('');
        setNewAttDesc('');
      } else if (res.error) {
        alert(res.error.detail || 'Error al agregar archivo adjunto');
      }
    } else {
      const newAtt = {
        id: `att-${Date.now()}`,
        name: newAttName.trim(),
        url: newAttUrl.trim(),
        description: newAttDesc.trim() || undefined,
      };
      setAttachments([...attachments, newAtt]);
      setNewAttName('');
      setNewAttUrl('');
      setNewAttDesc('');
    }
  }

  // STEP 4: Remove Attachment (P3.n)
  async function handleRemoveAttachment(attId: string) {
    if (createdQuotationId) {
      await apiRequest(`/api/v1/quotations/${createdQuotationId}/attachments/${attId}`, {
        method: 'DELETE',
      });
    }
    setAttachments(attachments.filter((a) => a.id !== attId));
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      {/* Step Progress Bar */}
      <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 text-white border-b border-slate-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide uppercase text-indigo-400">
              Asistente de Cotización
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-sm font-medium text-slate-300">
              Paso {currentStep} de 4
            </span>
            {createdQuotationId && (
              <span className="text-xs ml-3 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/80" aria-live="polite">
                {autoSaveStatus === 'saving' && (
                  <span className="text-amber-400 font-medium animate-pulse">● Autoguardando borrador...</span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-emerald-400 font-medium">✓ Borrador autoguardado</span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="text-rose-400 font-medium">⚠️ Error de autoguardado</span>
                )}
              </span>
            )}
          </div>

          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar y volver al listado
          </button>
        </div>

        {/* Stepper pills */}
        <div className="grid grid-cols-4 gap-2 mt-4 max-w-4xl mx-auto">
          {[
            { step: 1, title: '1. Cliente y Contacto' },
            { step: 2, title: '2. Detalle y Margen' },
            { step: 3, title: '3. Costos Extra' },
            { step: 4, title: '4. Vista Previa y Envío' },
          ].map((s) => (
            <div
              key={s.step}
              className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                currentStep === s.step
                  ? 'bg-indigo-600 text-white shadow-md'
                  : currentStep > s.step
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-400'
              }`}
            >
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-5xl mx-auto">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Atención requerida:</p>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 1: REGISTRO DE DATOS DEL CLIENTE                   */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          loadingData ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-72" />
                <Skeleton className="h-4 w-96" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
                <div className="space-y-3 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 1: Selección de Cliente y Contacto
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Seleccione la empresa cliente de la cartera corporativa y el contacto destinatario de la propuesta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cliente selector */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Empresa Cliente *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Seleccione una empresa --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} (RUT: {c.taxId})
                    </option>
                  ))}
                </select>

                {selectedCustomer && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">
                      {selectedCustomer.businessName}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700 dark:text-slate-200">RUT:</span> {selectedCustomer.taxId}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Dirección:</span> {selectedCustomer.address}
                    </p>
                  </div>
                )}
              </div>

              {/* Contacto selector */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Contacto de la Empresa *
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  disabled={!selectedCustomerId || contacts.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/40 disabled:text-slate-400"
                >
                  {contacts.length === 0 && <option value="">Sin contactos registrados</option>}
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} &mdash; {c.position}
                    </option>
                  ))}
                </select>

                {selectedContact && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">
                      {selectedContact.name} ({selectedContact.position})
                    </p>
                    <p>
                      <span className="font-medium text-slate-700 dark:text-slate-200">Email:</span> {selectedContact.email}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700 dark:text-slate-200">WhatsApp:</span> {selectedContact.phone}
                    </p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium pt-1">
                      ℹ️ A este email y teléfono se remitirá la propuesta y credenciales del portal.
                    </p>
                  </div>
                )}
              </div>

              {/* Selector de Asesor Comercial (Solo Admin puede cotizar a nombre de un asesor) */}
              {currentUser?.role === 'ADMIN' && usersList && usersList.length > 0 && (
                <div className="space-y-3 md:col-span-2 p-4 rounded-lg bg-indigo-50/50 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-700">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Asesor Comercial Responsable (Cotizar a nombre de) *
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Como Administrador, puede emitir la cotización a nombre del asesor comercial responsable de la cuenta. Las cifras y comisiones computarán para este asesor.
                  </p>
                  <select
                    value={chosenSalesRepId}
                    onChange={(e) => setChosenSalesRepId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {usersList.filter((u) => (u.role === 'SALES_REP' || u.role === 'ADMIN') && !u.deletedAt).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'ADMIN' ? '🛡️ Administrador' : '💼 Asesor Comercial'}) &mdash; {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleAdvanceStep1}
                aria-label="Siguiente"
                disabled={!selectedCustomerId || !selectedContactId || saving}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {saving ? 'Creando borrador...' : 'Siguiente: Paso 2 Detalle'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          )
        )}

        {/* ======================================================== */}
        {/* PASO 2: INGRESAR DETALLE DE COTIZACIÓN + REGLA DE MARGEN */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Paso 2: Detalle de Productos y Servicios
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Agregue ítems del catálogo. Escriba el margen % o el precio unitario y se recalcularán mutuamente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(true)}
                  className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Cargar líneas y términos desde una plantilla predefinida"
                >
                  <span>📑</span>
                  <span>Cargar Plantilla</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCatalogModal(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Ítem del Catálogo</span>
                </button>
              </div>
            </div>

            {/* Lines Table */}
            {lines.length === 0 ? (
              <div className="p-8 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400">
                <Search className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No hay líneas en la cotización</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Haga clic en &quot;Agregar Ítem del Catálogo&quot; para seleccionar productos o servicios.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Ítem / Descripción</th>
                      <th className="py-2.5 px-2 text-center">Unidad</th>
                      <th className="py-2.5 px-2 text-center w-20">Cant.</th>
                      <th className="py-2.5 px-2 text-right w-24">Costo Unit.</th>
                      <th className="py-2.5 px-2 text-center w-24">Margen %</th>
                      <th className="py-2.5 px-2 text-right w-28">Precio Base</th>
                      <th className="py-2.5 px-2 text-center w-20">Desc. %</th>
                      <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <ItemTypeBadge type={line.type} />
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{line.name}</p>
                          {line.skuOrCode && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {line.skuOrCode}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-slate-600 dark:text-slate-400">
                          {line.unit}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            step={line.unit === 'UND' || line.unit === 'CAJA' ? '1' : '0.1'}
                            min="0.01"
                            value={line.quantity}
                            onChange={(e) => handleUpdateLine(idx, 'quantity', parseFloat(e.target.value) || 1)}
                            className="w-16 px-1.5 py-1 text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.cost}
                            onChange={(e) => handleUpdateLine(idx, 'cost', parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="99.9"
                              value={line.marginPct}
                              onChange={(e) => handleUpdateLine(idx, 'marginPct', parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-1 text-center rounded border border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={line.cost}
                            value={line.price}
                            onChange={(e) => handleUpdateLine(idx, 'price', parseFloat(e.target.value) || line.cost)}
                            className="w-24 px-1.5 py-1 text-right rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="99"
                              value={line.discountPct || 0}
                              onChange={(e) => handleUpdateLine(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                              className="w-14 px-1 py-1 text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            />
                            <span className="text-slate-500 text-[10px]">%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {formatMoney(line.subtotal, company.currency)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                            title="Eliminar línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Global Discount input */}
            {lines.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Descuento Comercial Global (%)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Aplica sobre el subtotal neto de todas las líneas. Al cliente se le informará el ahorro total.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="99"
                    value={globalDiscountPct}
                    onChange={(e) => setGlobalDiscountPct(Math.max(0, Math.min(99, parseFloat(e.target.value) || 0)))}
                    className="w-20 px-2 py-1 text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">%</span>
                </div>
              </div>
            )}

            {/* LIVE TOTALS AND MARGIN POLICY VALIDATION PANEL */}
            {lines.length > 0 && (
              <div
                className={`p-5 rounded-xl border transition-all ${
                  totals.meetsMinimum
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                    : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/60'
                }`}
              >
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-center sm:text-left">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Costo Total</span>
                    <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatMoney(totals.totalCost, company.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Subtotal Bruto</span>
                    <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatMoney(totals.grossNetSubtotal, company.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ahorro Cliente</span>
                    <p className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {formatMoney(totals.totalSavings, company.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Venta Neta</span>
                    <p className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      {formatMoney(totals.netSubtotal, company.currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Margen Efectivo</span>
                    <p
                      className={`text-lg font-extrabold font-mono ${
                        totals.meetsMinimum ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {totals.marginPct.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mínimo Exigido</span>
                    <p className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                      {company.minMarginPct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Status alert message */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                  {totals.meetsMinimum ? (
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        ✓ Margen objetivo cumplido ({totals.marginPct.toFixed(2)}% &ge;{' '}
                        {company.minMarginPct.toFixed(2)}%). Puede continuar al siguiente paso.
                      </span>
                    </div>
                  ) : totals.marginPct < (company.hardMinMarginPct ?? 0) ? (
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-bold bg-rose-100/80 dark:bg-rose-950/60 p-3 rounded-lg border border-rose-300 dark:border-rose-800">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div>
                        <span className="block font-black text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                          BLOQUEO ESTRICTO: Margen inferior al Piso Duro no negociable ({company.hardMinMarginPct}%)
                        </span>
                        <span>
                          El margen actual ({totals.marginPct.toFixed(2)}%) está bajo el piso duro. Ajuste los precios o aumente el margen para poder continuar. Faltan {formatMoney(totals.shortfall, company.currency)} en venta neta.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                      <div className="flex items-start gap-2 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="block font-extrabold text-amber-950 dark:text-amber-100">
                            EXCEPCIÓN DE MARGEN (P3.l) — Pasa a Pendiente de Aprobación
                          </span>
                          <span className="font-normal text-[11px] text-amber-800 dark:text-amber-300">
                            El margen ({totals.marginPct.toFixed(2)}%) está entre el piso duro ({company.hardMinMarginPct}%) y el mínimo corporativo ({company.minMarginPct}%). La cotización no se bloquea, pero requerirá aprobación formal de Administración.
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-amber-950 dark:text-amber-200 mb-1">
                          Motivo de la excepción de margen para Administración (obligatorio):
                        </label>
                        <textarea
                          rows={2}
                          value={marginExceptionReason}
                          onChange={(e) => setMarginExceptionReason(e.target.value)}
                          placeholder="Explique el motivo comercial o estratégico (ej. cliente estratégico, volumen por flota, licitación competitiva)..."
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Paso 1: Cliente
              </button>

              <button
                type="button"
                onClick={handleAdvanceStep2}
                aria-label="Siguiente"
                disabled={
                  lines.length === 0 ||
                  saving ||
                  totals.marginPct < (company.hardMinMarginPct ?? 0) ||
                  (!totals.meetsMinimum && !marginExceptionReason.trim())
                }
                className={`px-6 py-2.5 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm ${
                  !totals.meetsMinimum
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {saving
                  ? 'Guardando...'
                  : !totals.meetsMinimum
                  ? 'Siguiente con Excepción de Margen'
                  : 'Siguiente: Paso 3 Costos Extra'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 3: DETALLE NO INCLUIDO EN LA COTIZACIÓN (COSTOS EXTRA) */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 3: Detalle no incluido en la Cotización (Costos Extra)
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Productos o servicios adicionales opcionales (instalación, movilidad, viáticos) que se muestran
                como informativos y <strong>NO suman al total de la cotización ni afectan el margen</strong>.
              </p>
            </div>

            {/* Add Extra Cost Form */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Descripción del Costo Extra</label>
                <input
                  type="text"
                  placeholder="Ej. Movilidad para entrega in-situ Lima"
                  value={extraCostName}
                  onChange={(e) => setExtraCostName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Unidad</label>
                <select
                  value={extraCostUnit}
                  onChange={(e) => setExtraCostUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="HORA">HORA</option>
                  <option value="VISITA">VISITA</option>
                  <option value="UND">UND</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Precio Ref. ({company.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraCostPrice}
                  onChange={(e) => setExtraCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddExtraCost}
                  disabled={!extraCostName.trim()}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Costo Extra
                </button>
              </div>
            </div>

            {/* Extra Costs List */}
            {extraCosts.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-xs">
                No ha ingresado costos extra para esta cotización (este paso es opcional).
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-3 text-center">Unidad</th>
                      <th className="py-2.5 px-3 text-right">Precio Informativo</th>
                      <th className="py-2.5 px-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {extraCosts.map((ec, idx) => (
                      <tr key={ec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-medium">{ec.name}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400">{ec.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {formatMoney(ec.subtotal, company.currency)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveExtraCost(idx)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Paso 2: Detalle
              </button>

              <button
                type="button"
                onClick={handleAdvanceStep3}
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {saving ? 'Guardando...' : 'Continuar al Paso 4: Vista Previa'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PASO 4: VER COTIZACIÓN (VISTA PREVIA Y ENVÍO)            */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 4: Vista Previa y Envío de la Cotización
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Revise la propuesta tal como la verá el cliente. Puede ajustar los textos de presentación, notas y validez.
              </p>
            </div>

            {/* Editable Configuration for Proposal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Texto de Presentación</label>
                <textarea
                  rows={3}
                  value={presentationText}
                  onChange={(e) => setPresentationText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notas Adicionales</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Términos y Condiciones</label>
                <textarea
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Validez de la Oferta (Días)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* P3.n Enlaces a Documentos y Archivos Adjuntos */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Documentos y Enlaces Adjuntos (P3.n)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Agregue enlaces a archivos externos (Google Drive, Dropbox, planos DWG, memorias técnicas).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nombre (ej. Plano de Estabilidad)"
                  value={newAttName}
                  onChange={(e) => setNewAttName(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="url"
                  placeholder="URL (ej. https://drive.google.com/...)"
                  value={newAttUrl}
                  onChange={(e) => setNewAttUrl(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción opcional"
                    value={newAttDesc}
                    onChange={(e) => setNewAttDesc(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    disabled={!newAttName.trim() || !newAttUrl.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-700 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between py-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{att.name}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 text-[11px]"
                        >
                          {att.url} <ExternalLink className="w-3 h-3" />
                        </a>
                        {att.description && <span className="text-slate-400 text-[11px]">({att.description})</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-rose-600 hover:text-rose-700 text-xs font-semibold cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Document Box */}
            <div className="p-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-6 text-slate-800 dark:text-slate-200 text-xs">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{company.name}</h3>
                  <p className="text-slate-500 dark:text-slate-400">RUT: {company.rut}</p>
                  <p className="text-slate-500 dark:text-slate-400">{company.address}</p>
                  <p className="text-slate-500 dark:text-slate-400">Email: {company.email} | Tel: {company.phone}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-bold text-indigo-700 dark:text-indigo-400 block">
                    COTIZACIÓN BORRADOR
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                    Validez: {validityDays} días calendario
                  </span>
                </div>
              </div>

              {/* Customer Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg grid grid-cols-2 gap-4 border border-slate-200/80 dark:border-slate-700">
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block">CLIENTE:</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedCustomer?.businessName}</p>
                  <p>RUT: {selectedCustomer?.taxId}</p>
                  <p>{selectedCustomer?.address}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block">ATENCIÓN:</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedContact?.name}</p>
                  <p>{selectedContact?.position}</p>
                  <p>Email: {selectedContact?.email}</p>
                </div>
              </div>

              {/* Presentation letter */}
              <p className="italic text-slate-600 dark:text-indigo-200 bg-slate-50/50 dark:bg-indigo-950/20 p-3 rounded border border-slate-200/60 dark:border-indigo-900/40">
                &ldquo;{presentationText}&rdquo;
              </p>

              {/* Products Group */}
              {lines.filter((l) => l.type === 'PRODUCT').length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                      <ItemTypeBadge type="PRODUCT" /> Productos
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono font-semibold">
                      Subtotal:{' '}
                      {formatMoney(
                        lines
                          .filter((l) => l.type === 'PRODUCT')
                          .reduce((acc, l) => acc + l.subtotal, 0),
                        company.currency
                      )}
                    </span>
                  </div>
                  <table className="w-full text-left">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-1">Descripción</th>
                        <th className="py-1 text-center">Unidad</th>
                        <th className="py-1 text-center">Cant.</th>
                        <th className="py-1 text-right">P. Unit</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lines
                        .filter((l) => l.type === 'PRODUCT')
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="py-1.5 font-medium text-slate-900 dark:text-white">{l.name}</td>
                            <td className="py-1.5 text-center text-slate-500 dark:text-slate-400">{l.unit}</td>
                            <td className="py-1.5 text-center font-mono">{l.quantity}</td>
                            <td className="py-1.5 text-right font-mono">
                              {formatMoney(l.price, company.currency)}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatMoney(l.subtotal, company.currency)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Services Group */}
              {lines.filter((l) => l.type === 'SERVICE').length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                      <ItemTypeBadge type="SERVICE" /> Servicios Profesionales
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono font-semibold">
                      Subtotal:{' '}
                      {formatMoney(
                        lines
                          .filter((l) => l.type === 'SERVICE')
                          .reduce((acc, l) => acc + l.subtotal, 0),
                        company.currency
                      )}
                    </span>
                  </div>
                  <table className="w-full text-left">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-1">Descripción del Servicio</th>
                        <th className="py-1 text-center">Unidad</th>
                        <th className="py-1 text-center">Cant.</th>
                        <th className="py-1 text-right">P. Unit</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lines
                        .filter((l) => l.type === 'SERVICE')
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="py-1.5 font-medium text-slate-900 dark:text-white">{l.name}</td>
                            <td className="py-1.5 text-center text-slate-500 dark:text-slate-400">{l.unit}</td>
                            <td className="py-1.5 text-center font-mono">{l.quantity}</td>
                            <td className="py-1.5 text-right font-mono">
                              {formatMoney(l.price, company.currency)}
                            </td>
                            <td className="py-1.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatMoney(l.subtotal, company.currency)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Extra Costs (Non included) */}
              {extraCosts.length > 0 && (
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-lg space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-300 block text-xs">
                    COSTOS EXTRA OPCIONALES (NO INCLUIDOS EN EL TOTAL):
                  </span>
                  {extraCosts.map((ec) => (
                    <div key={ec.id} className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>• {ec.name} ({ec.unit})</span>
                      <span className="font-mono">{formatMoney(ec.subtotal, company.currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals Summary */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-64 space-y-1.5 text-right font-mono">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span>{formatMoney(subtotal, company.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA ({company.taxRatePct}%):</span>
                    <span>{formatMoney(taxAmount, company.currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-700 pt-1">
                    <span>TOTAL:</span>
                    <span className="text-indigo-700 dark:text-indigo-400">{formatMoney(grandTotal, company.currency)}</span>
                  </div>
                  {company.ufRate ? (
                    <div className="flex justify-between text-xs font-bold text-amber-700 dark:text-amber-400 font-mono pt-0.5">
                      <span>Equivalente UF (P3.m):</span>
                      <span>{(grandTotal / company.ufRate).toFixed(2)} UF</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Attachments preview in document */}
              {attachments.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                    DOCUMENTOS Y PLANOS ADJUNTOS (P3.n):
                  </span>
                  <div className="space-y-1">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 text-xs">
                        <Paperclip className="w-3 h-3 text-indigo-500" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{att.name}:</span>
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-mono text-[11px]">
                          {att.url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Paso 3: Costos Extra
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenSaveTemplateModal}
                  disabled={saving || savingTemplate || lines.length === 0}
                  className="px-4 py-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                  title={lines.length === 0 ? 'Agregue partidas para guardar como plantilla' : 'Guardar esta cotización como plantilla reutilizable'}
                >
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Guardar como plantilla
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Guardar como Borrador
                </button>

                {!totals.meetsMinimum ? (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                    title="Guarda la cotización y la deja en estado Pendiente de Aprobación por Administración"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Enviar a Aprobación de Margen (P3.l)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSendConfirmModal(true)}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    Enviar Cotización al Cliente
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Catalog Item Selector */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                Seleccionar Producto o Servicio del Catálogo
              </h3>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer text-sm font-semibold"
              >
                &times; Cerrar
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, SKU o código..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCatalogTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                    catalogTypeFilter === 'ALL'
                      ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogTypeFilter('PRODUCT')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                    catalogTypeFilter === 'PRODUCT'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                  }`}
                >
                  Productos
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogTypeFilter('SERVICE')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                    catalogTypeFilter === 'SERVICE'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60'
                  }`}
                >
                  Servicios
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {loadingData ? (
                <div className="space-y-4 p-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-16 rounded-md" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-3 w-3/4" />
                        <div className="flex gap-4">
                          <Skeleton className="h-2.5 w-20" />
                          <Skeleton className="h-2.5 w-20" />
                          <Skeleton className="h-2.5 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                catalogItems
                .filter((item) => {
                  if (catalogTypeFilter !== 'ALL' && item.type !== catalogTypeFilter) return false;
                  if (!catalogSearch) return true;
                  const q = catalogSearch.toLowerCase();
                  return (
                    item.name.toLowerCase().includes(q) ||
                    ((item as any).sku && (item as any).sku.toLowerCase().includes(q)) ||
                    ((item as any).code && (item as any).code.toLowerCase().includes(q))
                  );
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <ItemTypeBadge type={item.type} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{item.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.description}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {item.type === 'PRODUCT' ? (
                          <>
                            <span>SKU: {(item as any).sku}</span>
                            <span>Unidad: {(item as any).unit}</span>
                          </>
                        ) : (
                          <>
                            <span>Código: {(item as any).code || 'N/A'}</span>
                            <span>Unidad: {(item as any).unit}</span>
                          </>
                        )}
                        <span>Costo: {formatMoney(item.unitCost, company.currency)}</span>
                        <span>Lista: {formatMoney(item.listPrice, company.currency)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddCatalogItem(item)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors text-xs font-semibold cursor-pointer shrink-0"
                    >
                      + Seleccionar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm send quotation */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <Send className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">¿Confirmar envío de cotización?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              La cotización pasará formalmente a estado <strong>Enviada / Pendiente</strong>.
              Se generará el enlace público interactivo y se remitirán las notificaciones al cliente:{' '}
              <strong>{selectedContact?.name}</strong> vía Email ({selectedContact?.email}) y WhatsApp ({selectedContact?.phone}).
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSendConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Revisar más
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-sm"
              >
                {saving ? 'Enviando...' : 'Sí, Enviar Cotización'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEL DOCUMENTO AL BORRADOR (IA) (P2.l) */}
      <DocumentToDraftModal
        isOpen={showAiDraftModal}
        onClose={() => setShowAiDraftModal(false)}
        onApplySuggestions={handleApplyAiSuggestions}
      />

      {/* MODAL: CARGAR PLANTILLAS (P2.j) */}
      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={handleApplyTemplate}
        catalogItems={catalogItems}
      />

      {/* MODAL: GUARDAR COMO PLANTILLA */}
      {showSaveTemplateModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="save-template-modal-title" className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/80 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="save-template-modal-title" className="font-bold text-slate-900 dark:text-white text-base">
                    Guardar como Plantilla
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Crea una plantilla reutilizable a partir de esta cotización
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveTemplateErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{saveTemplateErrorMsg}</span>
              </div>
            )}

            {saveTemplateSuccessMsg ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    ¡Plantilla guardada con éxito!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                    {saveTemplateSuccessMsg}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    Entendido, volver a la cotización
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmSaveTemplate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombre de la Plantilla <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    placeholder="ej. Inspección Carena y Varada Estándar"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Categoría
                    </label>
                    <select
                      value={saveTemplateCategoryId}
                      onChange={(e) => setSaveTemplateCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Partidas incluidas
                    </label>
                    <div className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-medium">
                      {lines.length} ítem(s) de cotización
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Descripción / Alcance general (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={saveTemplateDescription}
                    onChange={(e) => setSaveTemplateDescription(e.target.value)}
                    placeholder="Breve resumen del alcance o tipo de servicio que cubre esta plantilla..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Previews / check options */}
                <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Elementos adicionales a guardar:
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={saveTemplateIncludeTerms}
                      onChange={(e) => setSaveTemplateIncludeTerms(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Incluir términos y condiciones comerciales actuales</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={saveTemplateIncludePresentation}
                      onChange={(e) => setSaveTemplateIncludePresentation(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Incluir texto de presentación actual</span>
                  </label>
                </div>

                {/* Preview list of lines */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Partidas en la plantilla ({lines.length}):
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-900">
                    {lines.map((l, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs pt-1 first:pt-0">
                        <span className="truncate pr-2 text-slate-800 dark:text-slate-200 font-medium">
                          {l.quantity}x {l.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] shrink-0">
                          {formatMoney(l.subtotal, company.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Layers className="w-4 h-4" />
                    {savingTemplate ? 'Guardando plantilla...' : 'Guardar como Plantilla'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
