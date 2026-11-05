import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import suratService from '../services/suratService';
import {
  Send,
  Bot,
  User as UserIcon,
  CheckCircle2,
  Circle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import type { DynamicFieldDef } from '../types';

interface Message {
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

interface AIChatDrawerProps {
  initialDocumentType?: string;
  onDraftReady?: (data: {
    kode_surat: string;
    collected_slots: Record<string, any>;
    promptContext: string;
  }) => void;
}

// Architectural Note:
// Integrates stateful session management with the backend Chat Workflow and Redis slot memory.
// Automatically displays slot-filling progression and transitions directly to formal drafting.

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  initialDocumentType,
  onDraftReady,
}) => {
  const navigate = useNavigate();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<string | null>(initialDocumentType || null);
  const [collectedSlots, setCollectedSlots] = useState<Record<string, any>>({});
  const [requiredFields, setRequiredFields] = useState<DynamicFieldDef[]>([]);
  const [isReadyToDraft, setIsReadyToDraft] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    initChatThread();
  }, [initialDocumentType]);

  const initChatThread = async () => {
    setIsLoading(true);
    try {
      const initRes = await suratService.initChat(
        'Konsultasi Pengajuan Surat',
        initialDocumentType || null
      );
      setThreadId(initRes.thread_id);
      setMessages([
        {
          sender: 'assistant',
          text:
            'Halo! Saya asisten cerdas persuratan kampus berbasis Agentic AI. ' +
            'Silakan jelaskan surat dinas yang Anda perlukan dan tujuannya dalam bahasa alami. ' +
            'Saya akan membantu memvalidasi kelengkapan data sebelum diteruskan ke dosen.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setCollectedSlots({});
      setRequiredFields([]);
      setIsReadyToDraft(false);
    } catch {
      setMessages([
        {
          sender: 'system',
          text: 'Gagal menginisialisasi sesi percakapan. Pastikan koneksi backend aktif.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !threadId || isLoading) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const userMsgObj: Message = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      const response = await suratService.sendChatMessage(threadId, userText);

      if (response.detected_intent) {
        setDetectedIntent(response.detected_intent);
      }
      if (response.kode_surat) {
        setDetectedIntent(response.kode_surat);
      }
      if (response.collected_slots) {
        setCollectedSlots(response.collected_slots);
      }
      if (response.required_fields) {
        setRequiredFields(response.required_fields);
      }

      if (response.state === 'READY_TO_DRAFT' || response.status === 'ready_to_draft') {
        setIsReadyToDraft(true);
      }

      const botMsgObj: Message = {
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsgObj]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: 'Terjadi gangguan saat memproses pesan ke agen AI. Silakan coba kembali.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToForm = () => {
    const promptSummary = messages
      .filter((m) => m.sender === 'user')
      .map((m) => m.text)
      .join('\n');

    if (onDraftReady && detectedIntent) {
      onDraftReady({
        kode_surat: detectedIntent,
        collected_slots: collectedSlots,
        promptContext: promptSummary,
      });
      return;
    }

    navigate('/surat/new', {
      state: {
        prefilledKodeSurat: detectedIntent,
        prefilledPayload: collectedSlots,
        prefilledPrompt: promptSummary,
      },
    });
  };

  return (
    <div className="flex flex-col h-[650px] bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-slate-200">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold tracking-tight">
              Konsultasi & Ekstraksi Draf Surat AI
            </h3>
            <p className="text-[10px] text-slate-400">
              {detectedIntent
                ? `Terdeteksi: ${detectedIntent}`
                : 'Menunggu analisis jenis surat dari percakapan'}
            </p>
          </div>
        </div>

        <button
          onClick={initChatThread}
          title="Mulai sesi baru"
          className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat History */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-50/50 space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2 max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white'
                    : msg.sender === 'assistant'
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {msg.sender === 'user' ? (
                  <UserIcon className="w-3 h-3" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
              </div>

              <div
                className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 text-white'
                    : msg.sender === 'assistant'
                    ? 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <span
                  className={`block text-[9px] mt-1 ${
                    msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-2 max-w-[70%]">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3 h-3" />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 shadow-xs flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-150"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-300"></span>
                <span className="text-[11px] ml-1">Menganalisa konteks...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Slot Checklist Sidebar */}
        <div className="w-64 border-l border-slate-200 bg-white p-3.5 flex flex-col overflow-y-auto">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 pb-2 border-b border-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Ekstraksi Atribut</span>
          </div>

          <div className="mt-2.5 flex-1 space-y-2">
            {requiredFields.length > 0 ? (
              requiredFields.map((field) => {
                const isFilled =
                  collectedSlots[field.field] !== undefined &&
                  collectedSlots[field.field] !== null &&
                  collectedSlots[field.field] !== '';

                return (
                  <div
                    key={field.field}
                    className={`p-2 rounded border text-xs ${
                      isFilled
                        ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate pr-1">{field.label}</span>
                      {isFilled ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      )}
                    </div>
                    {isFilled && (
                      <div className="text-[11px] text-slate-700 font-mono mt-1 truncate">
                        {String(collectedSlots[field.field])}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <HelpCircle className="w-6 h-6 mb-1 text-slate-300" />
                <p className="text-[11px] leading-tight">
                  Tuliskan keperluan surat Anda di kolom pesan untuk mendeteksi atribut yang wajib
                  diisi.
                </p>
              </div>
            )}
          </div>

          {/* Quick Action when ready */}
          {isReadyToDraft && (
            <div className="pt-3 border-t border-slate-200">
              <button
                onClick={handleProceedToForm}
                className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition shadow-xs"
              >
                <span>Proses Draf Surat</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ketik konteks pengajuan surat Anda di sini..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
        >
          <Send className="w-3.5 h-3.5 mr-1.5" />
          Kirim
        </button>
      </form>
    </div>
  );
};

export default AIChatDrawer;
