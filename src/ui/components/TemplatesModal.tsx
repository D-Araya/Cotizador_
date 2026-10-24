import React, { useState, useEffect } from 'react';
import { QuotationTemplate, CatalogItem } from '../../modules/types.ts';
import { apiRequest } from '../api.ts';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: QuotationTemplate) => void;
  catalogItems: CatalogItem[];
}

export function TemplatesModal({
  isOpen,
  onClose,
  onSelectTemplate,
  catalogItems,
}: TemplatesModalProps) {
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<QuotationTemplate[]>('/api/v1/templates');
      if (res.data) {
        setTemplates(res.data);
        if (res.data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(res.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleApply = () => {
    if (activeTemplate) {
      onSelectTemplate(activeTemplate);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        <div className="flex justify-between items-start pb-3 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>📑</span> Plantillas de Cotización (P2.j)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Seleccione una plantilla preconfigurada con líneas de servicio y términos contractuales por categoría.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Cargando plantillas de cotización...
          </div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            No hay plantillas de cotización configuradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Lista lateral de plantillas */}
            <div className="md:col-span-1 border border-slate-700/80 rounded-xl overflow-hidden divide-y divide-slate-700/60 bg-slate-900/60 max-h-80 overflow-y-auto">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tmpl.id)}
                  className={`w-full text-left p-3 text-xs transition flex flex-col gap-1 ${
                    activeTemplate?.id === tmpl.id
                      ? 'bg-cyan-950/60 text-cyan-200 border-l-4 border-cyan-400 font-semibold'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <span className="font-bold block text-sm">{tmpl.name}</span>
                  <span className="text-[10px] text-slate-400">{tmpl.categoryName || 'Categoría'}</span>
                  <span className="text-[10px] text-slate-400">{tmpl.lines.length} ítem(s)</span>
                </button>
              ))}
            </div>

            {/* Vista previa de plantilla seleccionada */}
            {activeTemplate && (
              <div className="md:col-span-2 space-y-4 bg-slate-900/40 p-4 rounded-xl border border-slate-700">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{activeTemplate.name}</h4>
                  <span className="text-xs text-cyan-400 font-medium">{activeTemplate.categoryName}</span>
                  {activeTemplate.description && (
                    <p className="text-xs text-slate-400 mt-1">{activeTemplate.description}</p>
                  )}
                </div>

                {/* Líneas incluidas */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 block">Líneas preconfiguradas:</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {activeTemplate.lines.map((l, i) => {
                      const item = catalogItems.find((ci) => ci.id === l.catalogItemId);
                      return (
                        <div key={i} className="flex justify-between items-center text-xs bg-slate-800/80 p-2 rounded border border-slate-700/60">
                          <span className="text-slate-200 font-medium">
                            {l.quantity}x {item?.name || l.catalogItemId}
                          </span>
                          <span className="text-slate-400">
                            {item?.type === 'PRODUCT' ? (item as any).sku : (item as any)?.code || 'SERVICIOS'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Términos y Carta */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 block">Términos contractuales:</span>
                  <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-[11px] text-slate-300 max-h-24 overflow-y-auto whitespace-pre-line">
                    {activeTemplate.terms}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!activeTemplate}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
          >
            Cargar Plantilla al Asistente
          </button>
        </div>
      </div>
    </div>
  );
}
