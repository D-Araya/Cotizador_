import React, { useState } from 'react';
import { apiRequest } from '../api.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { QuotationLine } from '../../modules/types.ts';

interface DocumentToDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySuggestions: (lines: QuotationLine[], presentationText?: string) => void;
}

export function DocumentToDraftModal({
  isOpen,
  onClose,
  onApplySuggestions,
}: DocumentToDraftModalProps) {
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [simulatedText, setSimulatedText] = useState<string>('');
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageBase64(dataUrl);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUseSampleImage = () => {
    // Imagen sintética SVG convertida a base64 representando una solicitud de armador
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
      <rect width="400" height="200" fill="#f8fafc"/>
      <text x="20" y="40" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">SOLICITUD DE COTIZACIÓN NAVAL</text>
      <text x="20" y="80" font-family="sans-serif" font-size="14" fill="#334155">1. Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR (1 GLB)</text>
      <text x="20" y="110" font-family="sans-serif" font-size="14" fill="#334155">2. Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg (4 UND)</text>
      <text x="20" y="140" font-family="sans-serif" font-size="14" fill="#334155">3. Modificación especial de compuerta estanca hidráulica (1 UND)</text>
    </svg>`;
    const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    setImageBase64(base64);
    setImagePreview(base64);
    setSimulatedText(
      'Requerimientos: 1 Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR, 4 Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg, y 1 Modificación especial de compuerta estanca hidráulica.'
    );
  };

  const handleAnalyze = async () => {
    if (!imageBase64 && !simulatedText.trim()) {
      alert('Por favor seleccione una imagen o cargue el ejemplo de prueba.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      const res = await apiRequest('/api/v1/gemini/analyze-request-image', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: imageBase64 || undefined,
          mimeType: imageBase64?.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          simulatedText: simulatedText.trim() || undefined,
        }),
      });

      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Error al analizar el documento con IA');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmAndApply = () => {
    if (!result || !Array.isArray(result.suggestedLines)) return;

    // Convertir líneas propuestas al formato QuotationLine del Wizard
    const convertedLines: QuotationLine[] = result.suggestedLines.map((l: any, idx: number) => ({
      id: `line-ai-${Date.now()}-${idx}`,
      catalogItemId: l.catalogItemId,
      type: l.type || 'SERVICE',
      skuOrCode: l.skuOrCode || '',
      name: l.name,
      unit: l.unit || 'UND',
      cost: l.cost,
      price: l.price,
      marginPct: l.marginPct,
      quantity: l.quantity,
      subtotal: l.subtotal,
      costTotal: l.costTotal,
      discountPct: 0,
      discountAmount: 0,
      originalUnitPrice: l.price,
    }));

    onApplySuggestions(convertedLines, result.draftPresentationText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Encabezado */}
        <div className="flex justify-between items-start pb-3 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h3 className="text-xl font-bold text-slate-100">
                Del Documento al Borrador (IA Aplicada)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Extrae especificaciones desde una imagen o solicitud formal, contrasta con el catálogo y redacta la carta de presentación.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Paso 1: Carga de Imagen / Documento */}
        {!result && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center space-y-3 bg-slate-900/40">
              {imagePreview ? (
                <div className="space-y-3">
                  <img
                    src={imagePreview}
                    alt="Previsualización"
                    className="max-h-48 mx-auto rounded-lg border border-slate-700 object-contain"
                  />
                  <p className="text-xs text-emerald-400 font-medium">
                    ✓ Imagen de solicitud cargada y lista para análisis
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-4xl block">📄</span>
                  <p className="text-sm font-semibold text-slate-200">
                    Arrastre o seleccione una imagen de requerimiento / orden de compra
                  </p>
                  <p className="text-xs text-slate-400">
                    Formatos JPG, PNG, WebP o capturas de pantalla de especificaciones navales.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition border border-slate-600">
                  <span>Seleccionar Archivo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleUseSampleImage}
                  className="px-4 py-2 bg-cyan-700/80 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition"
                >
                  ⚡ Cargar Imagen de Prueba Naval
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || (!imageBase64 && !simulatedText.trim())}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {analyzing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Analizando con IA y contrastando catálogo...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Analizar Documento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: Revisión y Confirmación de la Sugerencia */}
        {result && (
          <div className="space-y-5">
            {/* Resumen de Hallazgos */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-slate-300">
                  Ítems encontrados en catálogo: <strong className="text-emerald-400">{result.matchedCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="text-slate-300">
                  Sin coincidencia ("Por cotizar"): <strong className="text-amber-400">{result.unmatchedCount}</strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-400 italic">
                * Precios y costos nunca son inventados.
              </span>
            </div>

            {/* Tabla de Líneas Propuestas */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                Líneas de Cotización Propuestas
              </h4>
              <div className="border border-slate-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Ítem / Descripción</th>
                      <th className="py-2.5 px-2 text-center">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 bg-slate-800/40">
                    {result.suggestedLines.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-700/30">
                        <td className="py-2 px-3">
                          {line.matched ? (
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-semibold rounded">
                              ✓ En Catálogo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 text-[10px] font-semibold rounded">
                              ⚠️ Por cotizar ($0)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-100">
                          {line.name}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-300">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-200">
                          {line.matched ? formatMoney(line.price) : <span className="text-amber-400 italic">Por cotizar</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-100">
                          {line.matched ? formatMoney(line.subtotal) : '$0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Carta de Presentación Redactada por la IA */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                  Carta de Presentación Redactada por IA
                </h4>
                <span className="text-[11px] text-cyan-400">Generada desde las líneas propuestas</span>
              </div>
              <textarea
                value={result.draftPresentationText || ''}
                onChange={(e) =>
                  setResult({ ...result, draftPresentationText: e.target.value })
                }
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Botones de Confirmación */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                ← Volver a cargar otra imagen
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndApply}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition shadow-md flex items-center gap-2"
                >
                  <span>✓</span>
                  <span>Confirmar y Aplicar al Borrador</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
