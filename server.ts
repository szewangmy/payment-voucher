import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let inMemorySharedApiKey = '';

async function callGeminiWithTurboRetry(apiKey: string, base64Data: string, detectedMime: string, receiptSchema: Schema, turboMode: boolean) {
  const ai = new GoogleGenAI({ apiKey });
  const models = turboMode 
    ? ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash']
    : ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
  
  const maxRetriesPerModel = 1; // Fast failover within 6s

  for (const model of models) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OCR request timed out after 6 seconds')), 6000)
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
              text: "Analyze Malaysian receipt. Return strict JSON: merchantName, merchantRegNo, documentType, receiptNumber, transactionDate (DD/MM/YYYY), lineItems (description, quantity, unitPrice, amount, suggestedGlCode), subtotal, sstTaxAmount, rounding, totalAmount, analysisNotes."
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
        console.warn(`Turbo OCR attempt ${attempt} for model ${model} failed: ${errStr}`);
        if (attempt < maxRetriesPerModel) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Fast retry 500ms
          continue;
        }
      }
    }
  }
  throw new Error('HTTP 503 / 429: Gemini OCR is temporarily busy. Please click Retry Scan.');
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ limit: '25mb', extended: true }));

  app.post('/api/gemini/config', (req, res) => {
    const { apiKey } = req.body;
    if (apiKey && typeof apiKey === 'string') {
      inMemorySharedApiKey = apiKey.trim();
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'Invalid API key provided' });
  });

  app.get('/api/gemini/status', (req, res) => {
    const headerKey = req.headers['x-gemini-api-key'] as string;
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
    const apiKey = headerKey || inMemorySharedApiKey || envKey;
    const connected = Boolean(apiKey && apiKey.length > 5);
    const keySource = headerKey ? 'HEADER_KEY' : inMemorySharedApiKey ? 'FIRESTORE_IN_MEMORY_CACHE' : process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : process.env.API_KEY ? 'API_KEY' : process.env.VITE_GEMINI_API_KEY ? 'VITE_GEMINI_API_KEY' : 'NONE';
    return res.json({ connected, keySource, model: 'gemini-3.5-flash-lite (Turbo)' });
  });

  app.post('/api/ocr', async (req, res) => {
    try {
      const headerKey = req.headers['x-gemini-api-key'] as string;
      const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;
      const bodyKey = req.body.apiKey;
      const apiKey = headerKey || bodyKey || inMemorySharedApiKey || envKey;

      if (!apiKey) {
        return res.status(500).json({ success: false, error: 'MISSING_API_KEY' });
      }

      const { image, mimeType, turboMode = true } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: 'No image provided for OCR' });
      }

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

      const textResult = await callGeminiWithTurboRetry(apiKey, base64Data, detectedMime, receiptSchema, turboMode);
      const parsedData = JSON.parse(textResult);
      return res.json({ success: true, data: parsedData });
    } catch (err: any) {
      console.error('OCR Error:', err);
      const errorMsg = err.message || '';
      const statusCode = errorMsg === 'MISSING_API_KEY' ? 500 : 503;
      return res.status(statusCode).json({ success: false, error: errorMsg });
    }
  });

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
