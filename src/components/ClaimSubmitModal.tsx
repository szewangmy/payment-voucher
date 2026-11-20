import React, { useState, useEffect } from 'react';
import { UserProfile, ClaimVoucher, ExpenseItem } from '../types';
import { COMPANIES, GL_ACCOUNTS } from '../data/mockData';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { GoogleGenAI, Schema, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, Sparkles, X, Plus, Trash2, Check, AlertCircle, Loader2, RotateCw, CheckCircle2, Zap } from 'lucide-react';

// Configure pdfjs worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const SYSTEM_SETTINGS_COLLECTION = 'system_settings';
const GEMINI_CONFIG_DOC = 'gemini_config';

interface ClaimSubmitModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onAddClaim: (newClaim: ClaimVoucher) => void;
}

interface UploadQueueItem {
  id: string;
  fileName: string;
  status: 'scanning' | 'done' | 'error';
  errorText?: string;
  base64Data: string;
  mimeType: string;
}

export const ClaimSubmitModal: React.FC<ClaimSubmitModalProps> = ({
  currentUser,
  onClose,
  onAddClaim
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(currentUser.defaultCompanyId);
  const [payTo, setPayTo] = useState<string>(currentUser.name);
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cheque'>('cheque');
  const [bankAccountCode, setBankAccountCode] = useState<string>('320-001');
  const [chequeNo, setChequeNo] = useState<string>('');
  
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [analysisNotes, setAnalysisNotes] = useState<string | null>(null);

  const [turboMode, setTurboMode] = useState<boolean>(true);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isAnyScanning, setIsAnyScanning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Gemini Connection Status State
  const [geminiStatus, setGeminiStatus] = useState<{ connected: boolean; model: string; keySource?: string } | null>(null);
  const [activeApiKey, setActiveApiKey] = useState<string | null>(null);
  const [strictRealDateOnly, setStrictRealDateOnly] = useState<boolean>(true);

  useEffect(() => {
    const unsubPolicy = onSnapshot(doc(db, SYSTEM_SETTINGS_COLLECTION, 'security_policy'), (snap) => {
      if (snap.exists() && typeof snap.data().strictRealDateOnly === 'boolean') {
        setStrictRealDateOnly(snap.data().strictRealDateOnly);
      }
    });
    return () => unsubPolicy();
  }, []);

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const res = await fetch('/api/gemini/status');
        const data = await res.json();
        if (data.connected) {
          setGeminiStatus(data);
          setActiveApiKey('backend');
          return true;
        }
      } catch (err) {
        console.warn('Backend status endpoint unreachable');
      }
      return false;
    };

    const unsubscribe = onSnapshot(doc(db, SYSTEM_SETTINGS_COLLECTION, GEMINI_CONFIG_DOC), async (docSnap) => {
      if (docSnap.exists() && docSnap.data().apiKey) {
        const key = docSnap.data().apiKey;
        setGeminiStatus({ connected: true, model: turboMode ? 'gemini-3.5-flash-lite (Turbo)' : 'gemini-3.8-flash (Deep)', keySource: 'Shared Company Key' });
        setActiveApiKey(key);
      } else {
        const hasServerKey = await checkServerStatus();
        if (!hasServerKey) {
          setGeminiStatus({ connected: false, model: 'gemini-3.5-flash-lite' });
          setActiveApiKey(null);
        }
      }
    }, (err) => {
      console.warn('Snapshot subscription error:', err);
      checkServerStatus();
    });

    return () => unsubscribe();
  }, [turboMode]);

  // Client-side PDF pre-processor onto canvas (max 1024px width, JPEG 70%)
  const renderPdfToJpegBase64s = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const jpegBase64s: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      let width = viewport.width;
      let height = viewport.height;
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (context) {
        const scaledViewport = page.getViewport({ scale: width / viewport.width });
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        jpegBase64s.push(canvas.toDataURL('image/jpeg', 0.70));
      }
    }
    return jpegBase64s;
  };

  // Image compressor for image/* files (max 1024px width, 70% quality)
  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.70));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to read file'));
      };
      reader.onerror = (error) => reject(error || new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  };

  // Non-blocking multi-receipt parallel processing (`Promise.allSettled`)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newQueueItems: UploadQueueItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = `file-${Date.now()}-${i}`;
      const mimeType = file.type || 'image/jpeg';

      if (mimeType === 'application/pdf') {
        try {
          const pdfJpegs = await renderPdfToJpegBase64s(file);
          pdfJpegs.forEach((jpegData, pIdx) => {
            newQueueItems.push({
              id: `${itemId}-p${pIdx}`,
              fileName: `${file.name} (Page ${pIdx + 1})`,
              status: 'scanning',
              base64Data: jpegData,
              mimeType: 'image/jpeg'
            });
          });
        } catch (pdfErr) {
          console.warn('PDF canvas render failed, falling back to raw PDF base64:', pdfErr);
          const rawBase64 = await fileToBase64(file);
          newQueueItems.push({
            id: itemId,
            fileName: file.name,
            status: 'scanning',
            base64Data: rawBase64,
            mimeType: 'application/pdf'
          });
        }
      } else if (mimeType.startsWith('image/')) {
        const rawBase64 = await fileToBase64(file);
        const compressedBase64 = await compressImage(rawBase64);
        newQueueItems.push({
          id: itemId,
          fileName: file.name,
          status: 'scanning',
          base64Data: compressedBase64,
          mimeType: 'image/jpeg'
        });
      }
    }

    setUploadQueue(prev => [...prev, ...newQueueItems]);
    setIsAnyScanning(true);
    setErrorMsg(null);

    // Process concurrently with Promise.allSettled
    const scanPromises = newQueueItems.map(item => processQueueItem(item));
    await Promise.allSettled(scanPromises);
    setIsAnyScanning(false);
    e.target.value = '';
  };

  const processQueueItem = async (item: UploadQueueItem) => {
    let attempt = 1;
    const maxAttempts = 2;

    while (attempt <= maxAttempts) {
      try {
        let cleanBase64 = item.base64Data;
        let cleanMime = item.mimeType;
        if (item.base64Data.startsWith('data:')) {
          const matches = item.base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            cleanMime = matches[1];
            cleanBase64 = matches[2];
          }
        }

        const receiptSchema: Schema = {
          type: Type.OBJECT,
          properties: {
            merchantName: { type: Type.STRING },
            merchantRegNo: { type: Type.STRING },
            documentType: { type: Type.STRING },
            receiptNumber: { type: Type.STRING },
            transactionDate: { type: Type.STRING },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  amount: { type: Type.NUMBER },
                  suggestedGlCode: { type: Type.STRING }
                },
                required: ["description", "amount"]
              }
            },
            subtotal: { type: Type.NUMBER },
            sstTaxAmount: { type: Type.NUMBER },
            rounding: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            analysisNotes: { type: Type.STRING }
          },
          required: ["merchantName", "transactionDate", "totalAmount", "lineItems"]
        };

        let extractedData: any = null;

        // Try backend /api/ocr
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (activeApiKey && activeApiKey !== 'backend') {
            headers['x-gemini-api-key'] = activeApiKey;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for turbo

          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers,
            body: JSON.stringify({ image: cleanBase64, mimeType: cleanMime, turboMode }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              extractedData = json.data;
            }
          }
        } catch (netErr) {
          console.warn('Backend /api/ocr call failed, trying client SDK fallback:', netErr);
        }

        // Client SDK fallback if backend failed
        if (!extractedData && activeApiKey && activeApiKey !== 'backend') {
          const ai = new GoogleGenAI({ apiKey: activeApiKey });
          const modelToUse = turboMode ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash';
          const response = await ai.models.generateContent({
            model: modelToUse,
            contents: [
              { inlineData: { data: cleanBase64, mimeType: cleanMime } },
              { text: "Analyze Malaysian receipt. Return strict JSON: merchantName, merchantRegNo, documentType, receiptNumber, transactionDate (DD/MM/YYYY), lineItems (description, quantity, unitPrice, amount, suggestedGlCode), subtotal, sstTaxAmount, rounding, totalAmount, analysisNotes." }
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: receiptSchema,
              thinkingConfig: { thinkingLevel: 'LOW' } as any
            }
          });
          if (response.text) {
            extractedData = JSON.parse(response.text);
          }
        }

        if (!extractedData) {
          throw new Error('OCR extraction failed');
        }

        if (extractedData.analysisNotes) {
          setAnalysisNotes(extractedData.analysisNotes);
        }

        let parsedDate = voucherDate;
        if (extractedData.transactionDate) {
          const parts = extractedData.transactionDate.split(/[/.-]/);
          if (parts.length === 3) {
            if (parts[2].length === 4) {
              parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (parts[0].length === 4) {
              parsedDate = extractedData.transactionDate;
            }
          }
        }
        if (parsedDate) setVoucherDate(parsedDate);

        const newItems: ExpenseItem[] = (extractedData.lineItems || []).map((li: any, idx: number) => {
          const defaultGL = GL_ACCOUNTS[0];
          const matchedGL = GL_ACCOUNTS.find(g => 
            li.suggestedGlCode?.toLowerCase().includes(g.code.toLowerCase()) ||
            li.description?.toLowerCase().includes(g.name.toLowerCase())
          ) || defaultGL;

          const lineAmount = li.amount || (li.quantity && li.unitPrice ? li.quantity * li.unitPrice : 0);
          let thumbnail = item.base64Data.length > 200000 ? 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80' : item.base64Data;

          return {
            lineNo: items.length + idx + 1,
            date: parsedDate,
            merchant: extractedData.merchantName || 'Unknown Merchant',
            receiptNo: extractedData.receiptNumber || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
            particulars: li.description || 'General Business Expense',
            accountCode: matchedGL.code,
            accountName: matchedGL.name,
            taxCode: extractedData.sstTaxAmount > 0 ? 'SV' : 'NR',
            taxAmountRM: extractedData.sstTaxAmount ? extractedData.sstTaxAmount / (extractedData.lineItems.length || 1) : 0,
            netAmountRM: lineAmount,
            amountRM: lineAmount,
            receiptImageUrl: thumbnail,
            isDateAuthentic: extractedData.isDateAuthentic,
            dateAuditFlag: extractedData.dateAuditFlag
          };
        });

        if (newItems.length === 0) {
          const defaultGL = GL_ACCOUNTS[0];
          newItems.push({
            lineNo: items.length + 1,
            date: parsedDate,
            merchant: extractedData.merchantName || 'Unknown Merchant',
            receiptNo: extractedData.receiptNumber || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
            particulars: extractedData.documentType ? `${extractedData.documentType} - General Expense` : 'General Business Expense',
            accountCode: defaultGL.code,
            accountName: defaultGL.name,
            taxCode: 'NR',
            taxAmountRM: extractedData.sstTaxAmount || 0,
            netAmountRM: extractedData.totalAmount || 0,
            amountRM: extractedData.totalAmount || 100.00,
            receiptImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'
          });
        }

        setItems(prev => [...prev, ...newItems]);
        setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
        return;
      } catch (err: any) {
        console.warn(`Queue item ${item.fileName} attempt ${attempt} failed:`, err);
        if (attempt < maxAttempts) {
          attempt++;
          await new Promise(r => setTimeout(r, 1000));
        } else {
          setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', errorText: err.message } : q));
          break;
        }
      }
    }
  };

  const handleRetryItem = (item: UploadQueueItem) => {
    setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'scanning', errorText: undefined } : q));
    processQueueItem(item);
  };

  const addManualItem = () => {
    const defaultGL = GL_ACCOUNTS[0];
    const newItem: ExpenseItem = {
      lineNo: items.length + 1,
      date: voucherDate,
      merchant: '',
      receiptNo: '',
      particulars: '',
      accountCode: defaultGL.code,
      accountName: defaultGL.name,
      taxCode: 'NR',
      taxAmountRM: 0,
      netAmountRM: 0,
      amountRM: 0,
      receiptImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'amountRM') {
      const amt = parseFloat(value) || 0;
      const tax = updated[index].taxAmountRM || 0;
      updated[index].netAmountRM = amt - tax;
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, lineNo: idx + 1 }));
    setItems(updated);
  };

  const checkDateViolation = (dateStr: string, isAuthentic?: boolean, auditFlag?: string): string | null => {
    if (!dateStr) return 'Transaction date is missing.';
    if (isAuthentic === false) return auditFlag || 'AI Audit Flag: Document date flagged as unauthentic, altered, or placeholder.';
    if (auditFlag && auditFlag.trim().length > 0) return auditFlag;

    const todayStr = '2026-11-19';
    if (dateStr > todayStr) return `Future Date Violation: Date (${dateStr}) is after today's real date (${todayStr}).`;

    const yr = parseInt(dateStr.substring(0, 4), 10);
    if (isNaN(yr) || yr < 2024 || dateStr.startsWith('1970')) {
      return `Invalid / Fake Placeholder Date: (${dateStr}) is before year 2024 or epoch placeholder.`;
    }

    const d = new Date(dateStr);
    const today = new Date('2026-11-19');
    const diffDays = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);
    if (diffDays > 90) {
      return `Expired Receipt Warning: Receipt date (${dateStr}) is more than 90 days old (${Math.round(diffDays)} days ago).`;
    }

    return null;
  };

  const voucherDateViolation = checkDateViolation(voucherDate);
  const itemViolations = items.map(item => checkDateViolation(item.date, item.isDateAuthentic, item.dateAuditFlag));
  const hasDangerZoneViolation = Boolean(voucherDateViolation || itemViolations.some(v => v !== null));
  const firstViolationText = voucherDateViolation || itemViolations.find(v => v !== null) || null;

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(String(item.amountRM)) || 0), 0);

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        cleaned[key] = sanitizeForFirestore(obj[key]);
      }
    }
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Please add at least one receipt item.');
      return;
    }

    if (strictRealDateOnly && hasDangerZoneViolation) {
      setErrorMsg('Cannot submit claim: Danger Zone date or audit integrity violation detected.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const company = COMPANIES.find(c => c.id === selectedCompanyId) || COMPANIES[0];
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const voucherNo = `${company.voucherPrefix}2026-${randomNum}`;

      const newClaim: ClaimVoucher = {
        id: `CLM-2026-${Date.now().toString().slice(-4)}`,
        voucherNo,
        companyId: selectedCompanyId,
        companyEntityId: selectedCompanyId,
        claimantId: currentUser.id,
        createdByUid: currentUser.uid,
        payTo,
        voucherDate,
        status: 'pending',
        paymentMethod,
        bankAccountCode,
        chequeNo: paymentMethod === 'cheque' ? chequeNo : undefined,
        totalAmountRM: totalAmount,
        createdAt: new Date().toISOString().split('T')[0],
        items
      };

      const sanitized = sanitizeForFirestore(newClaim);
      await addDoc(collection(db, 'claims'), sanitized);
      setSuccessMsg('Claim submitted successfully to Firestore!');
      onAddClaim(newClaim);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error adding claim to Firestore:', err);
      setErrorMsg(`Failed to save claim to Firestore: ${err.message || err}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">New Staff Expense Claim & AI Turbo OCR</h2>
              <div className="flex items-center space-x-2 mt-0.5">
                {geminiStatus?.connected ? (
                  <span className="inline-flex items-center text-[10px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                    Google Gemini Connected ({geminiStatus.model})
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
                    Gemini API Key Missing (Configure in Team Settings)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AI Turbo Mode Toggle */}
          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <Zap className={`w-4 h-4 ${turboMode ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-xs font-medium">AI Turbo Mode</span>
            <button
              type="button"
              onClick={() => setTurboMode(!turboMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                turboMode ? 'bg-amber-500' : 'bg-slate-600'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                turboMode ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hidden sm:block">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {strictRealDateOnly && hasDangerZoneViolation && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-xl space-y-1">
              <div className="flex items-center space-x-2 font-bold text-rose-800">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>DANGER ZONE — Date & Audit Integrity Alert</span>
              </div>
              <p className="text-xs text-rose-700">{firstViolationText}</p>
              <p className="text-[11px] font-semibold text-rose-900">
                Strict Real-Date Enforcement is ACTIVE. Submission is blocked until date/audit violations are resolved.
              </p>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-sm flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {analysisNotes && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Assistive Review Tip (Gemini OCR):</span>
                <span>{analysisNotes}</span>
              </div>
            </div>
          )}

          {/* Company & Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Company Entity</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              >
                {COMPANIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Pay To (Claimant)</label>
              <input
                type="text"
                value={payTo}
                onChange={(e) => setPayTo(e.target.value)}
                required
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Voucher Date</label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                required
                className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Payment Method & Bank */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'cheque')}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Bank Account Code</label>
              <select
                value={bankAccountCode}
                onChange={(e) => setBankAccountCode(e.target.value)}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="320-001">320-001 Maybank Current Account</option>
                <option value="320-002">320-002 CIMB Bank Current Account</option>
                <option value="310-000">310-000 Petty Cash / Cash-in-Hand</option>
              </select>
            </div>

            {paymentMethod === 'cheque' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Cheque No.</label>
                <input
                  type="text"
                  placeholder="e.g. MBB 448912"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Receipt Upload & AI Turbo Scan Banner */}
          <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-6 text-center hover:bg-emerald-50 transition relative">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              {isAnyScanning ? (
                <>
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-sm font-bold text-emerald-900">⚡ AI Turbo Scan processing receipts in parallel...</p>
                  <p className="text-xs text-emerald-700">Form remains fully editable while AI extracts line items.</p>
                </>
              ) : (
                <>
                  <div className="bg-emerald-600 text-white p-3 rounded-full shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Drop multiple receipt images or PDFs here (Parallel Scan)</p>
                  <p className="text-xs text-slate-500">⚡ AI Turbo pre-processor renders PDFs & compresses images to 1024px for 2–4s extraction.</p>
                </>
              )}
            </div>
          </div>

          {/* Upload Queue Status List */}
          {uploadQueue.length > 0 && (
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Parallel Scan Queue ({uploadQueue.length})</span>
              <div className="space-y-2">
                {uploadQueue.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                    <span className="font-medium text-slate-800 truncate max-w-xs">{item.fileName}</span>
                    <div className="flex items-center space-x-2">
                      {item.status === 'scanning' && (
                        <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Scanning...
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                          <Check className="w-3 h-3 mr-1" /> Done
                        </span>
                      )}
                      {item.status === 'error' && (
                        <div className="flex items-center space-x-2">
                          <span className="text-rose-600 font-medium">Error</span>
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item)}
                            className="px-2 py-1 bg-amber-600 text-white rounded text-[10px] font-semibold"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expense Items List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Itemized Expenses ({items.length})</h3>
              <button
                type="button"
                onClick={addManualItem}
                className="text-xs inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row Manually</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                No receipt items added yet. Upload receipts above or click "Add Row Manually".
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 relative space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                        Line #{item.lineNo}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Merchant / Supplier</label>
                        <input
                          type="text"
                          value={item.merchant}
                          onChange={(e) => updateItem(idx, 'merchant', e.target.value)}
                          required
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Receipt / Ref No.</label>
                        <input
                          type="text"
                          value={item.receiptNo}
                          onChange={(e) => updateItem(idx, 'receiptNo', e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Date</label>
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => updateItem(idx, 'date', e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Amount (RM)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.amountRM}
                          onChange={(e) => updateItem(idx, 'amountRM', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 font-mono font-bold text-emerald-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Particulars (Description)</label>
                        <input
                          type="text"
                          value={item.particulars}
                          onChange={(e) => updateItem(idx, 'particulars', e.target.value)}
                          required
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">Accounts Allocation (GL Code)</label>
                        <select
                          value={item.accountCode}
                          onChange={(e) => {
                            const gl = GL_ACCOUNTS.find(g => g.code === e.target.value);
                            const updated = [...items];
                            updated[idx].accountCode = e.target.value;
                            updated[idx].accountName = gl?.name || '';
                            setItems(updated);
                          }}
                          className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                        >
                          {GL_ACCOUNTS.map(g => (
                            <option key={g.code} value={g.code}>{g.code} - {g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {item.receiptImageUrl && (
                      <div className="flex items-center space-x-2 pt-2">
                        <span className="text-[10px] text-slate-500">Attached Receipt Thumbnail:</span>
                        <a 
                          href={item.receiptImageUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-emerald-600 hover:underline font-medium"
                        >
                          View Image Preview
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Amount Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
            <span className="text-sm font-semibold">Total Claim Amount:</span>
            <span className="text-xl font-mono font-bold text-emerald-400">
              RM {totalAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0 || (strictRealDateOnly && hasDangerZoneViolation)}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting to Firestore...' : 'Submit Claim for Approval'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
