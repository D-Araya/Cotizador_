import React, { useState, useEffect } from 'react';
import {
  Layers,
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  X,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Package,
  Wrench,
  DollarSign,
  Save,
} from 'lucide-react';
import { QuotationTemplate, QuotationTemplateLine, CatalogItem, Category } from '../../modules/types.ts';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: QuotationTemplate) => void;
  catalogItems?: CatalogItem[];
  categories?: Category[];
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
  catalogItems: propCatalogItems,
  categories: propCategories,
}: TemplatesModalProps) {
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(propCatalogItems || []);
  const [categories, setCategories] = useState<Category[]>(propCategories || []);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit / Create State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formTerms, setFormTerms] = useState<string>('');
  const [formPresentationText, setFormPresentationText] = useState<string>('');
  const [formLines, setFormLines] = useState<Array<{ catalogItemId: string; quantity: number; discountPct?: number }>>([]);
  const [saving, setSaving] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setIsEditing(false);
      setEditingTemplateId(null);
      setFeedback(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tmplRes, catRes, itemRes] = await Promise.all([
        apiRequest<QuotationTemplate[]>('/api/v1/templates'),
        apiRequest<Category[]>('/api/v1/categories'),
        apiRequest<CatalogItem[]>('/api/v1/catalog-items'),
      ]);

      if (tmplRes.data) {
        setTemplates(tmplRes.data);
      }
      if (catRes.data && (!propCategories || propCategories.length === 0)) {
        setCategories(catRes.data);
      }
      if (itemRes.data && (!propCatalogItems || propCatalogItems.length === 0)) {
        setCatalogItems(itemRes.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al cargar plantillas' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Helper to resolve catalog item name
  const getCatalogItem = (itemId: string): CatalogItem | undefined => {
    return catalogItems.find((i) => i.id === itemId);
  };

  const getItemName = (itemId: string): string => {
    const item = getCatalogItem(itemId);
    return item ? item.name : itemId;
  };

  // Open Edit Mode
  const handleOpenEdit = (tmpl: QuotationTemplate) => {
    setEditingTemplateId(tmpl.id);
    setFormName(tmpl.name);
    setFormCategoryId(tmpl.categoryId || (categories[0]?.id ?? 'cat-01'));
    setFormDescription(tmpl.description || '');
    setFormTerms(tmpl.terms || '');
    setFormPresentationText(tmpl.presentationText || '');
    setFormLines(
      tmpl.lines && tmpl.lines.length > 0
        ? tmpl.lines.map((l) => ({ catalogItemId: l.catalogItemId, quantity: l.quantity || 1, discountPct: l.discountPct || 0 }))
        : catalogItems.length > 0
        ? [{ catalogItemId: catalogItems[0].id, quantity: 1, discountPct: 0 }]
        : []
    );
    setIsEditing(true);
    setFeedback(null);
  };

  // Open Create Mode
  const handleOpenCreate = () => {
    setEditingTemplateId(null);
    setFormName('');
    setFormCategoryId(categories[0]?.id ?? 'cat-01');
    setFormDescription('');
    setFormTerms(
      '1. Anticipo 50% al inicio y 50% contra entrega de entregables aprobados por DIRECTEMAR.\n2. Plazo de ejecución: 15 días hábiles tras visita técnica en terreno.\n3. Precios en Pesos Chilenos (CLP) netos más IVA (19%).'
    );
    setFormPresentationText(
      'Es un agrado presentar nuestra propuesta técnica y económica de ingeniería naval. En M&L Ingeniería Naval SpA ejecutamos cada proyecto con estricto apego a normativas DIRECTEMAR y Casas Clasificadoras.'
    );
    setFormLines(
      catalogItems.length > 0
        ? [{ catalogItemId: catalogItems[0].id, quantity: 1, discountPct: 0 }]
        : []
    );
    setIsEditing(true);
    setFeedback(null);
  };

  // Line manipulation in Editor
  const handleAddLine = () => {
    const defaultItemId = catalogItems[0]?.id || 'serv-01';
    setFormLines([...formLines, { catalogItemId: defaultItemId, quantity: 1, discountPct: 0 }]);
  };

  const handleUpdateLine = (index: number, field: 'catalogItemId' | 'quantity', value: any) => {
    const updated = [...formLines];
    if (field === 'quantity') {
      updated[index].quantity = Math.max(1, Number(value) || 1);
    } else {
      updated[index].catalogItemId = value;
    }
    setFormLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (formLines.length <= 1) {
      setFeedback({ type: 'error', message: 'La plantilla debe contener al menos 1 ítem técnico.' });
      return;
    }
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  // Save changes
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedback({ type: 'error', message: 'El nombre de la plantilla es requerido.' });
      return;
    }
    if (formLines.length === 0) {
      setFeedback({ type: 'error', message: 'Debe incluir al menos un ítem en el alcance técnico.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        name: formName.trim(),
        categoryId: formCategoryId || (categories[0]?.id ?? 'cat-01'),
        description: formDescription.trim(),
        lines: formLines,
        terms: formTerms.trim(),
        presentationText: formPresentationText.trim(),
      };

      if (editingTemplateId) {
        // Update existing template
        const res = await apiRequest<QuotationTemplate>(`/api/v1/templates/${editingTemplateId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.error) {
          throw new Error((res.error as any).detail || 'Error al actualizar plantilla');
        }

        if (res.data) {
          setTemplates((prev) => prev.map((t) => (t.id === editingTemplateId ? res.data! : t)));
        }
        setFeedback({ type: 'success', message: `✓ Plantilla "${formName}" actualizada exitosamente.` });
      } else {
        // Create new template
        const res = await apiRequest<QuotationTemplate>('/api/v1/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.error) {
          throw new Error((res.error as any).detail || 'Error al crear plantilla');
        }

        if (res.data) {
          setTemplates((prev) => [res.data!, ...prev]);
        }
        setFeedback({ type: 'success', message: `✓ Plantilla "${formName}" creada exitosamente.` });
      }

      setIsEditing(false);
      setEditingTemplateId(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al guardar plantilla' });
    } finally {
      setSaving(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!window.confirm(`¿Está seguro de eliminar la plantilla "${tmpl?.name || 'seleccionada'}"?`)) {
      return;
    }

    try {
      const res = await apiRequest(`/api/v1/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (res.error) {
        throw new Error((res.error as any).detail || 'Error al eliminar');
      }
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setFeedback({ type: 'success', message: '✓ Plantilla eliminada con éxito.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al eliminar plantilla' });
    }
  };

  // Apply template to Wizard
  const handleUseTemplate = (tmpl: QuotationTemplate) => {
    onSelectTemplate(tmpl);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl text-slate-100 relative my-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950/50 shrink-0">
              <Layers className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 id="templates-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Plantillas Institucionales de Cotización Naval
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Modelos estandarizados de ingeniería para agilizar propuestas de varada, calibración de ejes y propulsión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {!isEditing && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-900/40 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Plantilla</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition cursor-pointer"
              title="Cerrar panel de plantillas"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            role="status"
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              feedback.type === 'error'
                ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold opacity-75 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Cargando modelos y catálogo de ingeniería...</p>
          </div>
        ) : isEditing ? (
          /* =========================================================
             MODO EDICIÓN / MODIFICACIÓN COMPLETA DE CONTENIDOS
             ========================================================= */
          <form onSubmit={handleSaveTemplate} className="mt-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la galería</span>
              </button>
              <span className="text-xs font-mono font-bold text-slate-400">
                {editingTemplateId ? 'Modificando Plantilla' : 'Nueva Plantilla'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Nombre de la Plantilla Institucional *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ej. Estudio de Estabilidad y Cuadernillo DIRECTEMAR"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Categoría Técnica *
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 text-xs text-white focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Descripción Comercial / Resumen del Alcance
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve resumen de los servicios incluidos y objetivo técnico de la propuesta..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 text-xs text-white focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Editor de Líneas y Alcance Técnico */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Alcance Técnico Incluido (Líneas de Cotización)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Defina los productos y servicios predefinidos que se cargarán en la cotización.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Ítem</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {formLines.map((line, idx) => {
                  const currentItem = getCatalogItem(line.catalogItemId);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800/80"
                    >
                      <span className="w-6 text-center text-xs font-mono font-bold text-purple-400 shrink-0">
                        #{idx + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <select
                          value={line.catalogItemId}
                          onChange={(e) => handleUpdateLine(idx, 'catalogItemId', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white focus:border-purple-500 focus:outline-none"
                        >
                          {catalogItems.map((item) => (
                            <option key={item.id} value={item.id} className="bg-slate-900 text-white">
                              {item.name} &mdash; {formatMoney(item.listPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <label className="text-[11px] text-slate-400">Cant:</label>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleUpdateLine(idx, 'quantity', e.target.value)}
                            className="w-16 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white text-center font-mono focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        {currentItem && (
                          <div className="text-[11px] font-mono text-emerald-400 font-semibold px-2">
                            {formatMoney(currentItem.listPrice * (line.quantity || 1))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="Eliminar línea del alcance"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Términos y Carta de Presentación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Términos y Condiciones Contractuales
                </label>
                <textarea
                  value={formTerms}
                  onChange={(e) => setFormTerms(e.target.value)}
                  rows={4}
                  placeholder="1. Condiciones de pago...\n2. Hitos de entrega...\n3. Normativa DIRECTEMAR..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 text-xs text-white focus:outline-none font-mono text-[11px] leading-relaxed resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Carta de Presentación Técnica Predefinida
                </label>
                <textarea
                  value={formPresentationText}
                  onChange={(e) => setFormPresentationText(e.target.value)}
                  rows={4}
                  placeholder="Texto formal de introducción para el armador / cliente..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-purple-500 text-xs text-white focus:outline-none leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#9333ea] hover:bg-[#a855f7] active:bg-[#7e22ce] text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-950/50 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Cambios en Plantilla'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* =========================================================
             VISTA PRINCIPAL: GALERÍA DE PLANTILLAS (IDÉNTICA A LA IMAGEN)
             ========================================================= */
          <div className="mt-6 space-y-6">
            {templates.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-[#0b1329] border border-slate-800 rounded-2xl p-6">
                <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No hay plantillas institucionales configuradas.</p>
                <p className="text-xs text-slate-500">Cree una nueva plantilla para agilizar la cotización de servicios estándar.</p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Crear primera plantilla
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map((tmpl) => {
                  const itemCount = tmpl.lines?.length || 0;
                  return (
                    <div
                      key={tmpl.id}
                      className="bg-[#0b1329] border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 shadow-xl relative flex flex-col justify-between transition-all duration-200 group"
                    >
                      <div>
                        {/* Top Header of Card */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs px-3 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium">
                              {itemCount} {itemCount === 1 ? 'ítem predefinido' : 'ítems predefinidos'}
                            </span>

                            {/* Acciones de modificación */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(tmpl)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/50 transition cursor-pointer"
                                title="Modificar todos los contenidos de la plantilla"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTemplate(tmpl.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                title="Eliminar plantilla"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-white mt-4 tracking-tight group-hover:text-purple-200 transition-colors">
                          {tmpl.name}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[36px]">
                          {tmpl.description || 'Plantilla técnica institucional configurada para propuestas navales.'}
                        </p>

                        {/* Alcance Técnico Incluido */}
                        <div className="mt-5 space-y-2">
                          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            ALCANCE TÉCNICO INCLUIDO:
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {tmpl.lines && tmpl.lines.length > 0 ? (
                              tmpl.lines.map((l, idx) => {
                                const resolvedName = getItemName(l.catalogItemId);
                                return (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-purple-400 font-bold">•</span>
                                    <span className="line-clamp-1">{resolvedName || `Ítem #${idx + 1}`}</span>
                                    {l.quantity > 1 && (
                                      <span className="text-slate-500 text-[10px] font-mono shrink-0">
                                        ({l.quantity}x)
                                      </span>
                                    )}
                                  </li>
                                );
                              })
                            ) : (
                              <li className="text-slate-500 italic">• Sin ítems configurados</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {/* Botón Principal (Púrpura Vibrante como en la imagen) */}
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tmpl)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#9333ea] hover:bg-[#a855f7] active:bg-[#7e22ce] text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer mt-6"
                      >
                        <Sparkles className="w-4 h-4 text-white" />
                        <span>Usar en Nueva Cotización</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplatesModal;
