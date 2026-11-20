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
          setTimeout(() => reject(new Error('OCR request timed out after 15 seconds')), 15000)
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
              text: "Analyze this Malaysian receipt, invoice, or payment bill. Extract the merchant name, receipt date (YYYY-MM-DD), receipt/invoice number, a concise particulars description, total gross amount in RM, tax amount in RM, and suggest the appropriate Malaysian accounting GL account category."
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: receiptSchema,
            temperature: 0.1,
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

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  // Initialize Gemini AI SDK
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  // OCR API Endpoint for Receipts / Invoices
  app.post('/api/ocr', async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'No image provided for OCR' });
      }

      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment variables.' });
      }

      // Clean base64 data URL if present
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
          merchant_name: { type: Type.STRING, description: "Name of the merchant or supplier" },
          receipt_date: { type: Type.STRING, description: "Date on receipt in YYYY-MM-DD format" },
          receipt_or_invoice_no: { type: Type.STRING, description: "Receipt or Invoice or Bill number" },
          description_summary: { type: Type.STRING, description: "Concise line-item summary suitable for voucher Particulars (e.g. A4 Paper & Arch Files)" },
          total_amount_rm: { type: Type.NUMBER, description: "Total gross amount in Malaysian Ringgit (RM)" },
          tax_amount_rm: { type: Type.NUMBER, description: "Tax / SST amount in RM if applicable, else 0" },
          suggested_account_category: { 
            type: Type.STRING, 
            description: "Suggested GL account category code and name from: 610-010 Printing & Stationery, 610-020 Travelling & Petrol, 610-030 Refreshments & Entertainment, 610-040 Courier & Postage, 610-050 Office Maintenance, 610-060 Filing & Stamping Fees, 610-070 Professional Subscriptions, 610-080 Utilities & Communications" 
          }
        },
        required: ["merchant_name", "receipt_date", "receipt_or_invoice_no", "description_summary", "total_amount_rm", "suggested_account_category"]
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
