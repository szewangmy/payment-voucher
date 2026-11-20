import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function callGeminiWithRetry(ai: GoogleGenAI, base64Data: string, detectedMime: string, receiptSchema: Schema) {
  const models = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.1-pro'];
  const maxRetriesPerModel = 3;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR request timed out after 20 seconds')), 20000)
        );

        const apiCall = ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: detectedMime
              }
            },
            {
              text: "Analyze this Malaysian receipt, invoice, or tax bill. Extract merchantName, merchantRegNo (SSM), documentType, receiptNumber, transactionDate (DD/MM/YYYY), lineItems (description, quantity, unitPrice, amount, suggestedGlCode), subtotal, sstTaxAmount, rounding, totalAmount (RM), and analysisNotes (flagging any math mismatch or missing receipt number)."
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: receiptSchema,
            thinkingConfig: { thinkingLevel: 'LOW' } as any
          }
        });

        const response: any = await Promise.race([apiCall, timeoutPromise]);

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        const errStr = String(err?.message || err);
        const isRateLimitOrUnavailable = 
          errStr.includes('503') || 
          errStr.includes('429') || 
          errStr.includes('UNAVAILABLE') || 
          errStr.includes('Resource exhausted') ||
          errStr.includes('overloaded') ||
          errStr.includes('timed out');
        
        console.warn(`OCR attempt ${attempt} for model ${model} failed: ${errStr}`);

        if (isRateLimitOrUnavailable && attempt < maxRetriesPerModel) {
          // Exponential backoff: 1.5s, 3s, 6s + random jitter
          const delay = Math.pow(2, attempt - 1) * 1500 + Math.random() * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else if (attempt === maxRetriesPerModel) {
          // Exhausted retries for this model, move to next model fallback
          break;
        } else if (!isRateLimitOrUnavailable) {
          // Non-retryable client/auth error
          throw err;
        }
      }
    }
  }
  throw new Error('Gemini OCR is temporarily busy due to high traffic. You can click Retry Scan or enter the item manually below.');
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Register body parsers before all routes with 25mb limit
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // Initialize Gemini AI SDK strictly on backend
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  // Gemini Connection Status Endpoint
  app.get('/api/gemini/status', (req, res) => {
    const connected = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
    return res.json({ connected, model: 'gemini-3.8-flash' });
  });

  // OCR API Endpoint for Receipts / Invoices
  app.post('/api/ocr', async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: 'No image provided for OCR' });
      }

      if (!apiKey) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured in environment variables.' });
      }

      // Strip data URI prefix if present and extract clean base64 data & mimeType
      let base64Data = image;
      let detectedMime = mimeType || 'image/jpeg';
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          detectedMime = matches[1];
          base64Data = matches[2];
        }
      }

      const receiptSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          merchantName: { type: Type.STRING, description: "Name of the merchant or supplier" },
          merchantRegNo: { type: Type.STRING, description: "SSM or Company registration number if available" },
          documentType: { type: Type.STRING, description: "Tax Invoice, Receipt, Cash Bill, or Voucher" },
          receiptNumber: { type: Type.STRING, description: "Receipt or Invoice or Bill number" },
          transactionDate: { type: Type.STRING, description: "Date on receipt in DD/MM/YYYY or YYYY-MM-DD format" },
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "Description of item" },
                quantity: { type: Type.NUMBER, description: "Quantity" },
                unitPrice: { type: Type.NUMBER, description: "Unit price in RM" },
                amount: { type: Type.NUMBER, description: "Total line amount in RM" },
                suggestedGlCode: { type: Type.STRING, description: "Suggested GL account code e.g. 610-010" }
              },
              required: ["description", "amount"]
            },
            description: "Itemized list of purchased goods or services"
          },
          subtotal: { type: Type.NUMBER, description: "Subtotal before tax in RM" },
          sstTaxAmount: { type: Type.NUMBER, description: "SST / Service tax amount in RM" },
          rounding: { type: Type.NUMBER, description: "Rounding adjustment in RM if any" },
          totalAmount: { type: Type.NUMBER, description: "Total gross amount in Malaysian Ringgit (RM)" },
          analysisNotes: { type: Type.STRING, description: "Assistive review notes flagging any math mismatch, missing receipt number, or tax details" }
        },
        required: ["merchantName", "transactionDate", "totalAmount", "lineItems"]
      };

      const textResult = await callGeminiWithRetry(ai, base64Data, detectedMime, receiptSchema);
      const parsedData = JSON.parse(textResult);
      return res.json({ success: true, data: parsedData });
    } catch (err: any) {
      console.error('OCR Error:', err);
      return res.status(500).json({ 
        success: false, 
        error: err.message || 'Gemini OCR is temporarily busy due to high traffic. You can click Retry Scan or enter the item manually below.' 
      });
    }
  });

  // Setup Vite in middleware mode for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
