import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

// AQ. bilan boshlanuvchi kalitlar OpenAI-kompatibel endpoint ishlatadi
const IS_AQ_KEY = GEMINI_API_KEY.startsWith("AQ.");

// Modellar ro'yxati (mavjud va ishlayotgan modellar)
const OPENAI_COMPAT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

const NATIVE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

const MODELS = IS_AQ_KEY ? OPENAI_COMPAT_MODELS : NATIVE_MODELS;

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    provider: "gemini",
    key_configured: !!GEMINI_API_KEY,
    key_type: IS_AQ_KEY ? "AQ (OpenAI-compat)" : "AIzaSy (Native)",
    models: MODELS
  });
});

// OpenAI-kompatibel endpoint orqali so'rov (AQ. kalit uchun)
async function callGeminiOpenAICompat(model, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  const formattedMessages = [];
  for (const m of messages) {
    if (m.image && m.image.includes(",")) {
      formattedMessages.push({
        role: m.role,
        content: [
          { type: "text", text: m.content || "Rasmni tahlil qilib ber." },
          { type: "image_url", image_url: { url: m.image } }
        ]
      });
    } else {
      formattedMessages.push({ role: m.role, content: m.content || "" });
    }
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GEMINI_API_KEY}`
    },
    body: JSON.stringify({ model, messages: formattedMessages })
  });

  const data = await resp.json();

  if (!resp.ok) {
    const errMsg = data?.error?.message || `Gemini API xatosi (${resp.status})`;
    const err = new Error(errMsg);
    err.status = resp.status;
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Bo'sh javob qaytarildi.");

  return { text, model };
}

// Gemini Native API orqali so'rov yuborish (har ikkala kalit turi uchun)
async function callGeminiNative(model, messages) {
  // AQ. kalitlar uchun header, AIzaSy kalitlar uchun URL parametr
  const url = IS_AQ_KEY
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = [];
  let system_instruction = null;

  for (const m of messages) {
    if (m.role === "system") {
      system_instruction = { parts: [{ text: m.content || "" }] };
    } else if (m.role === "user" || m.role === "assistant") {
      const role = m.role === "assistant" ? "model" : "user";
      const parts = [];

      if (m.content) parts.push({ text: m.content });

      if (m.image && m.image.includes(",")) {
        try {
          const [header, b64data] = m.image.split(",");
          const mimeType = header.split(";")[0].replace("data:", "") || "image/jpeg";
          parts.push({ inline_data: { mime_type: mimeType, data: b64data } });
        } catch { /* rasm xatosini e'tiborsiz qoldiramiz */ }
      }

      if (parts.length > 0) contents.push({ role, parts });
    }
  }

  if (contents.length === 0) throw new Error("Xabarlar bo'sh.");

  const body = {
    contents,
    generationConfig: {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  };
  if (system_instruction) body.system_instruction = system_instruction;

  const apiHeaders = { "Content-Type": "application/json" };
  if (IS_AQ_KEY) {
    apiHeaders["x-goog-api-key"] = GEMINI_API_KEY;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(body)
  });

  const data = await resp.json();

  if (!resp.ok) {
    const errMsg = data?.error?.message || `Gemini API xatosi (${resp.status})`;
    const err = new Error(errMsg);
    err.status = resp.status;
    throw err;
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .filter(Boolean)
    .join("\n");
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;
    if (reason === "SAFETY") throw new Error("Xavfsizlik filtri blokadi.");
    throw new Error("Bo'sh javob qaytarildi.");
  }

  return { text, model };
}

// Kalit turiga qarab to'g'ri funksiyani chaqirish
async function callGeminiWithModel(model, messages) {
  if (IS_AQ_KEY) {
    // AQ. kalitlar uchun avval OpenAI-compat API sinab ko'ramiz
    try {
      return await callGeminiOpenAICompat(model, messages);
    } catch (err) {
      // OpenAI-compat ishlamasa, native API bilan urinib ko'ramiz
      console.log(`⚠️ OpenAI-compat xato, native API sinab ko'rilmoqda: ${err.message.slice(0, 60)}`);
      return callGeminiNative(model, messages);
    }
  } else {
    return callGeminiNative(model, messages);
  }
}

// Barcha modellarni navbat bilan sinash
async function callGemini(messages) {
  let lastError = null;

  for (const model of MODELS) {
    try {
      console.log(`⏳ ${model} sinab ko'rilmoqda...`);
      const result = await callGeminiWithModel(model, messages);
      console.log(`✅ ${model} ishladi!`);
      return result;
    } catch (err) {
      console.log(`❌ ${model}: ${err.message.slice(0, 80)}`);
      lastError = err;
      // 429 yoki yuqori yuklanma bo'lsa keyingi modelni sinash
      if (err.status === 429 || err.message.includes("high demand") || err.message.includes("quota") || err.message.includes("no longer available")) {
        continue;
      }
      // Boshqa xatolarda ham keyingisini sinab ko'ramiz
      continue;
    }
  }

  throw lastError || new Error("Hech qanday model javob bermadi.");
}

app.post('/api/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ detail: "Server sozlanmagan: GEMINI_API_KEY topilmadi." });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ detail: "messages bo'sh bo'lmasligi kerak." });
  }

  try {
    const { text, model } = await callGemini(messages);
    res.json({ reply: text, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Noma'lum xatolik";
    console.error("Chat xatosi:", msg);

    // Agar limit bo'lsa aniq xabar
    if (msg.includes("high demand") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        detail: "⚠️ Gemini API hozir yukli. Bir necha soniyadan keyin qayta urinib ko'ring."
      });
    }

    res.status(502).json({ detail: `Xatolik: ${msg}` });
  }
});

let contactChatHistory = [];
let telegramUpdateId = 0;

app.get('/api/contact', (req, res) => {
  res.json(contactChatHistory);
});

app.post('/api/contact', async (req, res) => {
  const { name, message, image } = req.body;
  if (!name || (!message && !image)) {
    return res.status(400).json({ detail: "Ism va xabar (yoki rasm) bo'sh bo'lmasligi kerak." });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ detail: "Telegram bot sozlanmagan (.env faylini tekshiring)." });
  }

  contactChatHistory.push({
    id: Date.now().toString(),
    role: 'user',
    content: message || '',
    image: image
  });

  const text = `📬 <b>Yangi xabar!</b>\n\n👤 <b>Ism:</b> ${name}\n💬 <b>Xabar:</b> ${message || ''}`;
  
  try {
    if (image) {
      const [header, b64data] = image.split(",");
      const buffer = Buffer.from(b64data, 'base64');
      const blob = new Blob([buffer], { type: header.split(";")[0].replace("data:", "") });
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('caption', text);
      formData.append('parse_mode', 'HTML');
      formData.append('photo', blob, 'image.jpg');

      const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Telegram API xatosi (Rasm)');
      }
    } else {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        throw new Error('Telegram API xatosi (Matn)');
      }
    }
    
    res.json({ success: true, detail: "Xabar muvaffaqiyatli yuborildi." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ detail: "Xabar yuborishda xatolik yuz berdi." });
  }
});

// Polling for Telegram messages
setInterval(async () => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${telegramUpdateId + 1}&timeout=5`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        telegramUpdateId = update.update_id;
        if (update.message && update.message.chat.id.toString() === chatId) {
          if (update.message.text) {
             contactChatHistory.push({
               id: update.message.message_id.toString(),
               role: 'admin',
               content: update.message.text
             });
          }
        }
      }
    }
  } catch (err) {}
}, 3000);

const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ proAI Server: http://0.0.0.0:${PORT}`);
  console.log(`   Gemini API key: ${GEMINI_API_KEY ? "sozlangan" : "YO'Q — .env fayliga kiriting"}`);
  console.log(`   Modellar: ${MODELS.join(", ")}`);
});
