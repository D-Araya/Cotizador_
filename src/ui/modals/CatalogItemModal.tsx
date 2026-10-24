import React, { useState, useEffect } from 'react';
import { Package, Wrench, AlertCircle, DollarSign } from 'lucide-react';
import { CatalogItem, Category, CompanySettings, User } from '../../modules/types.ts';
import { MarginPolicy } from '../../shared-kernel/pricing/MarginPolicy.ts';
import { formatMoney } from '../../shared-kernel/formatMoney.ts';
import { Modal } from '../components/Modal.tsx';

interface CatalogItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CatalogItem | null;
  categories: Category[];
  company: CompanySettings;
  user: User;
  onSave: (itemData: Partial<CatalogItem>) => Promise<{ success: boolean; error?: string }>;
}

export function CatalogItemModal({
  isOpen,
  onClose,
  item,
  categories,
  company,
  user,
  onSave,
}: CatalogItemModalProps) {
  const isCreate = !item;
  const [itemType, setItemType] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [skuOrCode, setSkuOrCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('UND');
  const [description, setDescription] = useState('');
  const [unitCost, setUnitCost] = useState(0);
  const [marginPct, setMarginPct] = useState(company.minMarginPct || 25);
  const [listPrice, setListPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setItemType(item.type);
      setSkuOrCode(item.type === 'PRODUCT' ? (item.sku || '') : (item.code || ''));
      setCategoryId(item.categoryId || (categories[0]?.id || ''));
      setName(item.name || '');
      setUnit(item.unit || (item.type === 'PRODUCT' ? 'UND' : 'SERVICIO'));
      setDescription(item.description || '');
      setUnitCost(item.unitCost || 0);
      const computedMargin =
        item.listPrice > 0
          ? ((item.listPrice - item.unitCost) / item.listPrice) * 100
          : company.minMarginPct || 25;
      setMarginPct(Number(computedMargin.toFixed(1)));
      setListPrice(item.listPrice || 0);
    } else {
      setItemType('PRODUCT');
      setSkuOrCode(`PRD-${Math.floor(1000 + Math.random() * 9000)}`);
      setCategoryId(categories[0]?.id || 'cat-01');
      setName('');
      setUnit('UND');
      setDescription('');
      setUnitCost(10000);
      setMarginPct(company.minMarginPct || 25);
      const calculatedPrice = MarginPolicy.calculatePriceFromMargin(10000, company.minMarginPct || 25);
      setListPrice(calculatedPrice);
    }
    setError(null);
  }, [item, isOpen, categories, company]);

  function handleCostOrMarginChange(newCost: number, newMargin: number) {
    setUnitCost(newCost);
    setMarginPct(newMargin);
    try {
      const newPrice = MarginPolicy.calculatePriceFromMargin(newCost, newMargin);
      setListPrice(newPrice);
    } catch {
      // Ignore
    }
  }

  function handlePriceChange(newPrice: number) {
    setListPrice(newPrice);
    try {
      const newMargin = MarginPolicy.calculateMarginFromPrice(unitCost, newPrice);
      setMarginPct(newMargin);
    } catch {
      // Ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !skuOrCode.trim()) return;

    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      type: itemType,
      name: name.trim(),
      categoryId: categoryId || categories[0]?.id,
      unit,
      description: description.trim() || undefined,
      unitCost,
      listPrice,
    };

    if (itemType === 'PRODUCT') {
      payload.sku = skuOrCode.trim();
    } else {
      payload.code = skuOrCode.trim();
    }

    const res = await onSave(payload as unknown as Partial<CatalogItem>);
    setSaving(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Error al guardar el ítem');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? 'Añadir Nuevo Ítem al Catálogo' : 'Editar Ítem del Catálogo'}
      titleId="catalog-modal-title"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2" aria-live="polite">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Item Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Tipo de Ítem *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setItemType('PRODUCT');
                if (unit === 'SERVICIO' || unit === 'HORA') setUnit('UND');
              }}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                itemType === 'PRODUCT'
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs">Producto Físico</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bienes tangibles con SKU y control de stock
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setItemType('SERVICE');
                if (unit === 'UND') setUnit('SERVICIO');
              }}
              className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all text-left ${
                itemType === 'SERVICE'
                  ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-xs">Servicio Profesional</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Consultoría, mano de obra, horas y soporte
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Identifier and Category Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="cat-item-sku" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {itemType === 'PRODUCT' ? 'Código SKU *' : 'Código de Servicio *'}
            </label>
            <input
              id="cat-item-sku"
              type="text"
              required
              placeholder={itemType === 'PRODUCT' ? 'Ej. PROD-5010' : 'Ej. SRV-7020'}
              value={skuOrCode}
              onChange={(e) => setSkuOrCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cat-item-category" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Categoría *
            </label>
            <select
              id="cat-item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Item Name */}
        <div className="space-y-1">
          <label htmlFor="cat-item-name" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Nombre del Ítem *
          </label>
          <input
            id="cat-item-name"
            type="text"
            required
            placeholder={
              itemType === 'PRODUCT'
                ? 'Ej. Kit de Ánodos de Sacrificio de Zinc para Casco 5.5 kg'
                : 'Ej. Estudio de Estabilidad y Cuadernillo Técnico DIRECTEMAR'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Unit */}
        <div className="space-y-1.5">
          <label htmlFor="cat-item-unit" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Unidad de Medida *
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(itemType === 'PRODUCT'
              ? ['UND', 'PAQUETE', 'CAJA', 'METRO', 'KG', 'PIEZA', 'SET']
              : ['HORA', 'MES', 'GLOBAL', 'VISITA', 'PROYECTO', 'SERVICIO', 'DIA']
            ).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer transition-colors ${
                  unit === u
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <input
            id="cat-item-unit"
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value.toUpperCase())}
            className="w-full mt-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label htmlFor="cat-item-desc" className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Descripción / Alcance Técnico
          </label>
          <textarea
            id="cat-item-desc"
            rows={2}
            placeholder="Detalle especificaciones técnicas, marca, garantía, alcance o requisitos de entrega..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Financial & Margin Calculator Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Calculadora Financiera de Costo, Margen y Precio
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Mínimo exigido: <strong>{company?.minMarginPct || 25}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label htmlFor="cat-item-cost" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Costo Unitario (CLP) *
              </label>
              <input
                id="cat-item-cost"
                type="number"
                step="1"
                min="0"
                value={unitCost}
                onChange={(e) => handleCostOrMarginChange(parseFloat(e.target.value) || 0, marginPct)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cat-item-margin" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Margen sobre Venta (%)
              </label>
              <input
                id="cat-item-margin"
                type="number"
                step="0.5"
                min="0"
                max="99"
                value={marginPct}
                onChange={(e) => handleCostOrMarginChange(unitCost, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cat-item-price" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                Precio de Lista (CLP) *
              </label>
              <input
                id="cat-item-price"
                type="number"
                step="1"
                min={unitCost}
                value={listPrice}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border font-mono ${
              marginPct >= (company?.minMarginPct || 25)
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
            }`}>
              {marginPct >= (company?.minMarginPct || 25)
                ? '✓ Cumple margen corporativo'
                : '⚠️ Margen por debajo del sugerido'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Ganancia unitaria: <strong className="font-mono text-slate-900 dark:text-white">{formatMoney(Math.max(0, listPrice - unitCost))}</strong>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {saving ? 'Guardando...' : isCreate ? 'Añadir al Catálogo' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
