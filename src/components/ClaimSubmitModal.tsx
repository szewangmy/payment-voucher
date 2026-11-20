import React, { useState, useEffect } from 'react';
import { UserProfile, ClaimVoucher, ExpenseItem } from '../types';
import { COMPANIES, GL_ACCOUNTS } from '../data/mockData';
import { Upload, Sparkles, X, Plus, Trash2, Check, AlertCircle, Loader2, RotateCw, CheckCircle2 } from 'lucide-react';

interface ClaimSubmitModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onAddClaim: (newClaim: ClaimVoucher) => void;
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

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [ocrStatusText, setOcrStatusText] = useState<string>('Step 1/3: Reading document...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<{ base64: string; mimeType: string } | null>(null);

  // Gemini Connection Status State
  const [geminiStatus, setGeminiStatus] = useState<{ connected: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch('/api/gemini/status')
      .then(res => res.json())
      .then(data => setGeminiStatus(data))
      .catch(() => setGeminiStatus({ connected: false, model: 'gemini-3.8-flash' }));
  }, []);

  // Robust FileReader helper with both onload and onerror attached
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64 string'));
        }
      };
      reader.onerror = (error) => reject(error || new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  };

  // Image compression helper for image/* files (skips PDF)
  const compressImageIfNeeded = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
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
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Handle Receipt Upload & AI OCR via backend proxy
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mimeType = file.type || 'image/jpeg';
      
      setOcrStatusText('Step 1/3: Reading document...');
      setIsAnalyzing(true);
      setErrorMsg(null);

      try {
        let base64Data = await fileToBase64(file);

        if (mimeType.startsWith('image/')) {
          base64Data = await compressImageIfNeeded(base64Data);
        }

        setLastUploadedFile({ base64: base64Data, mimeType });
        await processImageWithOCR(base64Data, mimeType);
      } catch (err: any) {
        console.error('File Read Error:', err);
        setErrorMsg('Failed to read document file. Please try another image or PDF.');
        setIsAnalyzing(false);
      }
    }
    e.target.value = '';
  };

  const processImageWithOCR = async (base64Data: string, mimeType: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);

    let attempt = 1;
    const maxAttempts = 3;

    try {
      while (attempt <= maxAttempts) {
        try {
          if (attempt === 1) {
            setOcrStatusText('Step 2/3: Analyzing with Google Gemini 3.8 Flash...');
          } else {
            setOcrStatusText(`AI server is busy—retrying automatically (Attempt ${attempt}/3)...`);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data, mimeType }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || 'Gemini OCR extraction failed');
          }

          setOcrStatusText('Step 3/3: Populating particulars & GL codes...');
          const extracted = json.data;

          if (extracted.analysisNotes) {
            setAnalysisNotes(extracted.analysisNotes);
          }

          // Parse transaction date to YYYY-MM-DD if in DD/MM/YYYY
          let parsedDate = voucherDate;
          if (extracted.transactionDate) {
            const parts = extracted.transactionDate.split(/[/.-]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                // DD/MM/YYYY
                parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else if (parts[0].length === 4) {
                // YYYY-MM-DD
                parsedDate = extracted.transactionDate;
              }
            }
          }
          if (parsedDate) {
            setVoucherDate(parsedDate);
          }

          // Convert line items
          const newItems: ExpenseItem[] = (extracted.lineItems || []).map((li: any, idx: number) => {
            const defaultGL = GL_ACCOUNTS[0];
            const matchedGL = GL_ACCOUNTS.find(g => 
              li.suggestedGlCode?.toLowerCase().includes(g.code.toLowerCase()) ||
              li.description?.toLowerCase().includes(g.name.toLowerCase())
            ) || defaultGL;

            const lineAmount = li.amount || (li.quantity && li.unitPrice ? li.quantity * li.unitPrice : 0);

            // Compress image thumbnail if image under 200KB to prevent Firestore 1 MiB limit issues
            let thumbnail = mimeType === 'application/pdf' ? 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80' : base64Data;
            if (thumbnail.length > 200000) {
              thumbnail = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80';
            }

            return {
              lineNo: items.length + idx + 1,
              date: parsedDate,
              merchant: extracted.merchantName || 'Unknown Merchant',
              receiptNo: extracted.receiptNumber || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
              particulars: li.description || 'General Business Expense',
              accountCode: matchedGL.code,
              accountName: matchedGL.name,
              taxCode: extracted.sstTaxAmount > 0 ? 'SV' : 'NR',
              taxAmountRM: extracted.sstTaxAmount ? extracted.sstTaxAmount / (extracted.lineItems.length || 1) : 0,
              netAmountRM: lineAmount,
              amountRM: lineAmount,
              receiptImageUrl: thumbnail
            };
          });

          if (newItems.length === 0) {
            const defaultGL = GL_ACCOUNTS[0];
            newItems.push({
              lineNo: items.length + 1,
              date: parsedDate,
              merchant: extracted.merchantName || 'Unknown Merchant',
              receiptNo: extracted.receiptNumber || `RCP-${Math.floor(1000 + Math.random() * 9000)}`,
              particulars: extracted.documentType ? `${extracted.documentType} - General Expense` : 'General Business Expense',
              accountCode: defaultGL.code,
              accountName: defaultGL.name,
              taxCode: 'NR',
              taxAmountRM: extracted.sstTaxAmount || 0,
              netAmountRM: extracted.totalAmount || 0,
              amountRM: extracted.totalAmount || 100.00,
              receiptImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80'
            });
          }

          setItems(prev => [...prev, ...newItems]);
          setErrorMsg(null);
          return;
        } catch (err: any) {
          console.warn(`OCR attempt ${attempt} failed:`, err);
          if (err.name === 'AbortError') {
            throw new Error('OCR request timed out after 25 seconds.');
          }
          if (attempt < maxAttempts) {
            attempt++;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      console.error('OCR Process Error:', err);
      setErrorMsg('Gemini OCR is temporarily busy due to high traffic. You can click Retry Scan or enter the item manually below.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetryScan = () => {
    if (lastUploadedFile) {
      processImageWithOCR(lastUploadedFile.base64, lastUploadedFile.mimeType);
    }
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

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(String(item.amountRM)) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Please add at least one receipt item.');
      return;
    }

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

    onAddClaim(newClaim);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 p-2 rounded-lg text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">New Staff Expense Claim & AI Receipt OCR</h2>
              <div className="flex items-center space-x-2 mt-0.5">
                {geminiStatus?.connected ? (
                  <span className="inline-flex items-center text-[10px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                    Google Gemini Connected ({geminiStatus.model})
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
                    Gemini API Key Missing (Using Manual Fallback)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {errorMsg && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <span>{errorMsg}</span>
              </div>
              {lastUploadedFile && (
                <button
                  type="button"
                  onClick={handleRetryScan}
                  disabled={isAnalyzing}
                  className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition shrink-0"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry Scan</span>
                </button>
              )}
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

          {/* Receipt Upload & AI OCR Banner */}
          <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/50 rounded-xl p-6 text-center hover:bg-emerald-50 transition relative">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-sm font-bold text-emerald-900">{ocrStatusText}</p>
                  <p className="text-xs text-emerald-700">Extracting merchant, date, invoice number & amounts automatically</p>
                </>
              ) : (
                <>
                  <div className="bg-emerald-600 text-white p-3 rounded-full shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Drop receipt / invoice images here, or click to upload</p>
                  <p className="text-xs text-slate-500">Supports JPG, PNG, WebP & PDF. Gemini 3.8 Flash OCR will auto-fill particulars.</p>
                </>
              )}
            </div>
          </div>

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
                No receipt items added yet. Upload a receipt above or click "Add Row Manually".
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
              disabled={isAnalyzing || items.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
            >
              Submit Claim for Approval
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
