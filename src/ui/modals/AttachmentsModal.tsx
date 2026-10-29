import React, { useState, useRef } from 'react';
import {
  Paperclip,
  ExternalLink,
  Trash2,
  UploadCloud,
  FileText,
  Download,
  Link as LinkIcon,
  X,
  FolderOpen,
  FileCheck,
} from 'lucide-react';
import { Quotation, QuotationAttachment } from '../../modules/types.ts';
import { Modal } from '../components/Modal.tsx';
import { sanitizeSafeUrl } from '../api.ts';

interface AttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  onAddAttachment: (data: { name: string; url: string; description?: string }) => Promise<{ success: boolean; error?: string }>;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsModal({
  isOpen,
  onClose,
  quotation,
  onAddAttachment,
  onRemoveAttachment,
}: AttachmentsModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [attName, setAttName] = useState('');
  const [attUrl, setAttUrl] = useState('');
  const [attDesc, setAttDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<{
    file: File;
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!quotation) return null;

  function processFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setError('El archivo excede el límite máximo de 20 MB.');
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm') ||
      lowerName.endsWith('.svg') ||
      lowerName.endsWith('.js') ||
      file.type === 'text/html' ||
      file.type === 'image/svg+xml'
    ) {
      setError('Formato de archivo no permitido por políticas de seguridad (HTML, SVG o scripts ejecutables).');
      return;
    }
    setError(null);
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setSelectedFile({
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
      });
      if (!attName.trim()) {
        setAttName(file.name);
      }
      setIsReadingFile(false);
    };
    reader.onerror = () => {
      setError('Error al procesar el archivo del dispositivo.');
      setIsReadingFile(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    let finalUrl = '';
    let finalName = attName.trim();

    if (activeTab === 'upload') {
      if (!selectedFile) {
        setError('Por favor selecciona o arrastra un archivo para adjuntar.');
        return;
      }
      finalUrl = selectedFile.dataUrl;
      if (!finalName) {
        finalName = selectedFile.name;
      }
    } else {
      if (!attUrl.trim()) {
        setError('Por favor ingresa la URL del archivo.');
        return;
      }
      const safeExternalUrl = sanitizeSafeUrl(attUrl.trim(), false);
      if (safeExternalUrl === '#') {
        setError('La URL ingresada no es válida. Solo se permiten enlaces seguros http:// o https://.');
        return;
      }
      finalUrl = safeExternalUrl;
    }

    if (!finalName) {
      setError('El nombre descriptivo es requerido.');
      return;
    }

    setSaving(true);
    setError(null);
    const res = await onAddAttachment({
      name: finalName,
      url: finalUrl,
      description: attDesc.trim() || undefined,
    });
    setSaving(false);

    if (res.success) {
      setAttName('');
      setAttUrl('');
      setAttDesc('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setError(res.error || 'Error al agregar archivo adjunto');
    }
  }

  function handleResetForm() {
    setAttName('');
    setAttUrl('');
    setAttDesc('');
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const attachments: QuotationAttachment[] = quotation.attachments || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleResetForm();
        onClose();
      }}
      title="Archivos y Enlaces Adjuntos"
      titleId="attachments-modal-title"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Cotización <strong className="font-mono text-slate-800 dark:text-slate-200">{quotation.quotationNumber}</strong> &bull; {quotation.customerBusinessName}
        </p>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs" aria-live="polite">
            {error}
          </div>
        )}

        {/* Existing attachments list */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            Documentos Vinculados ({attachments.length}):
          </label>
          {attachments.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center border border-slate-200/60 dark:border-slate-800">
              No hay enlaces o archivos adjuntos en esta cotización.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
              {attachments.map((att) => {
                const isDataUrl = att.url.startsWith('data:') || att.url.startsWith('blob:');
                return (
                  <div key={att.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        {isDataUrl ? <FileText className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">{att.name}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                            {isDataUrl ? 'Archivo subido' : 'Enlace web'}
                          </span>
                        </div>
                        {att.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {att.description}
                          </p>
                        )}
                        {isDataUrl ? (
                          <a
                            href={sanitizeSafeUrl(att.url)}
                            download={att.name}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 cursor-pointer"
                          >
                            <Download className="w-3 h-3 shrink-0" /> Descargar / Abrir archivo
                          </a>
                        ) : (
                          <a
                            href={sanitizeSafeUrl(att.url, false)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 text-[11px] font-mono truncate mt-0.5"
                          >
                            {att.url} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 p-1.5 rounded-lg cursor-pointer shrink-0 transition-colors"
                      title="Eliminar adjunto"
                      aria-label={`Eliminar adjunto ${att.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Container with Tabs */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900/60 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Subir Archivo (Drag & Drop / Explorar)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'url'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Enlace Externo (URL)
            </button>
          </div>

          <form onSubmit={handleAdd} className="space-y-3">
            {activeTab === 'upload' ? (
              /* Drag and Drop / Browse Upload Box */
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processFile(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.zip,.rar,.dwg"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      processFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => {
                    if (!selectedFile) {
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/50 scale-[1.01]'
                      : selectedFile
                      ? 'border-emerald-400 dark:border-emerald-600/70 bg-emerald-50/40 dark:bg-emerald-950/30'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {isReadingFile ? (
                    <div className="py-3 flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Procesando archivo...</span>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {formatFileSize(selectedFile.size)} &bull; Listo para adjuntar
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Cambiar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Quitar archivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Arrastra y suelta tu archivo aquí
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          o haz clic para explorar en tu dispositivo
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Explorar archivos
                      </button>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        PDF, Word, Excel, Planos, Imágenes, ZIP (hasta 20 MB)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="att-name-input-file" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nombre del documento *
                  </label>
                  <input
                    id="att-name-input-file"
                    type="text"
                    required
                    placeholder="Nombre descriptivo (ej. Memoria de Cálculo Hidrostática)"
                    value={attName}
                    onChange={(e) => setAttName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
              </div>
            ) : (
              /* URL Input Box */
              <div className="space-y-2 text-xs">
                <div>
                  <label htmlFor="att-name-input-url" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nombre descriptivo *
                  </label>
                  <input
                    id="att-name-input-url"
                    type="text"
                    required
                    placeholder="Nombre descriptivo (ej. Carpeta de Planos en Drive)"
                    value={attName}
                    onChange={(e) => setAttName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="att-url-input" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    URL del archivo *
                  </label>
                  <input
                    id="att-url-input"
                    type="url"
                    required
                    placeholder="URL del archivo (ej. https://drive.google.com/...)"
                    value={attUrl}
                    onChange={(e) => setAttUrl(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Descripción o nota opcional"
                value={attDesc}
                onChange={(e) => setAttDesc(e.target.value)}
                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              />
              <button
                type="submit"
                disabled={
                  saving ||
                  isReadingFile ||
                  (activeTab === 'upload' ? !selectedFile || !attName.trim() : !attUrl.trim() || !attName.trim())
                }
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
              >
                {saving ? (
                  'Guardando...'
                ) : activeTab === 'upload' ? (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    Adjuntar Archivo
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    Vincular Enlace
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              handleResetForm();
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
