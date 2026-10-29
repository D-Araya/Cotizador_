import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  FileSearch,
  X,
  Send,
  Loader2,
  Upload,
  Bot,
  User,
  CheckCircle,
} from 'lucide-react';
import { apiRequest } from '../api.ts';
import { Skeleton } from './Skeleton.tsx';

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export function AiAssistant({ isOpen, onClose }: AiAssistantProps) {
  const [tab, setTab] = useState<'chat' | 'analyze'>('chat');

  // Chat State
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: '¡Hola! Soy tu Asesor y Consultor Técnico de Ingeniería IA para M&L Ingeniería Naval SpA. Puedo ayudarte a redactar propuestas técnicas rigurosas, sugerir combinaciones de suministros y servicios navales, resolver consultas sobre normativas DIRECTEMAR o proyectar precios para asegurar el margen mínimo corporativo. ¿En qué te colaboro hoy?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Document/Image Analyzer State
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/png');
  const [analyzePrompt, setAnalyzePrompt] = useState<string>(
    'Analiza este plano, especificación o documento de ingeniería. Extrae los requerimientos técnicos de suministros navales, memorias de cálculo, servicios técnicos identificados y recomendaciones para la propuesta.'
  );
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState<boolean>(false);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!isOpen) return null;

  async function handleSendMessage() {
    if (!inputMessage.trim() || chatLoading) return;
    const userText = inputMessage.trim();
    setInputMessage('');

    const newHistory: ChatMessage[] = [...chatMessages, { role: 'user', text: userText }];
    setChatMessages(newHistory);
    setChatLoading(true);

    const res = await apiRequest<{ reply: string }>('/api/v1/gemini/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: userText,
        history: newHistory.slice(0, -1),
        modelName: selectedModel,
      }),
    });

    setChatLoading(false);
    if (res.data?.reply) {
      setChatMessages([...newHistory, { role: 'model', text: res.data.reply }]);
    } else {
      setChatMessages([
        ...newHistory,
        { role: 'model', text: 'Lo siento, no pude procesar la respuesta en este momento.' },
      ]);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      setImageFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyzeDocument() {
    if (!imageFile || analyzeLoading) return;
    setAnalyzeLoading(true);
    setAnalysisResult(null);

    const res = await apiRequest<{ analysis: string }>('/api/v1/gemini/analyze-document', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: imageFile,
        mimeType: imageMimeType,
        prompt: analyzePrompt,
      }),
    });

    setAnalyzeLoading(false);
    if (res.data?.analysis) {
      setAnalysisResult(res.data.analysis);
    } else {
      setAnalysisResult('No se pudo analizar la imagen. Verifique el archivo.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/30">
              <Sparkles className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight">Asistente Inteligente Gemini</h2>
              <p className="text-xs text-indigo-200">Chat comercial y análisis técnico de requerimientos</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 gap-2 pt-2">
          <button
            onClick={() => setTab('chat')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'chat'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat Asesor Comercial
          </button>

          <button
            onClick={() => setTab('analyze')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              tab === 'analyze'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            Analizar Fotos y Documentos
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-hidden p-6 bg-white dark:bg-slate-900">
          {/* TAB 1: CHAT */}
          {tab === 'chat' && (
            <div className="h-full flex flex-col justify-between space-y-3">
              {/* Model selection */}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Modelo Gemini:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (Tareas generales)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Respuestas ultra-rápidas)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Recomendado)</option>
                </select>
              </div>

              {/* Message Thread */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[46vh]">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 text-xs ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.role === 'model' && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-3 rounded-xl leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-start gap-2.5 text-xs justify-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="max-w-[85%] p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700 space-y-2.5 w-80">
                      <div className="flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gemini está redactando su respuesta...</span>
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="pt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Pregúntale al asesor IA (ej: '¿Cómo explico un margen del 28% al cliente?')..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !inputMessage.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ANALYZE IMAGE / DOCUMENT */}
          {tab === 'analyze' && (
            <div className="h-full overflow-y-auto space-y-4 max-h-[60vh] pr-1">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                  Análisis Inteligente de Especificaciones y Cotizaciones
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Suba una imagen de un requerimiento, solicitud de compra o diagrama BPMN para extraer automáticamente los requerimientos.
                </p>
              </div>

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                {imageFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <img src={imageFile} alt="Preview" className="max-h-36 rounded-lg shadow-xs" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Imagen cargada correctamente (Haga clic para cambiar)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 py-4">
                    <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs font-medium">Haga clic o arrastre una imagen aquí</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">PNG, JPG, WebP hasta 10MB</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Instrucción para el análisis:</label>
                <textarea
                  rows={2}
                  value={analyzePrompt}
                  onChange={(e) => setAnalyzePrompt(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={handleAnalyzeDocument}
                disabled={!imageFile || analyzeLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                {analyzeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando imagen con Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Ejecutar Análisis con Gemini
                  </>
                )}
              </button>

              {analyzeLoading && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini está procesando la imagen y analizando requerimientos...</span>
                  </div>
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              )}

              {!analyzeLoading && analysisResult && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Resultado del Análisis:</h4>
                  <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {analysisResult}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
