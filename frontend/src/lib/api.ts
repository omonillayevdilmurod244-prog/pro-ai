import type { Message } from "../types";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || "";


function inferApiUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  const { hostname, origin } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return origin;
  }
  return "http://localhost:8000";
}

const API_URL = import.meta.env.VITE_API_URL || inferApiUrl();

export async function checkBackend(): Promise<boolean> {
  try {
    const resp = await fetch(`${API_URL}/api/health`, { method: "GET" });
    if (resp.ok) return true;
  } catch {}
  // Standalone/Netlify rejimida to'g'ridan-to'g'ri Gemini orqali ishlaydi
  return true;
}

// To'g'ridan-to'g'ri Gemini API'ga murojaat qilish (Netlify / static hostingda backend bo'lmasa ishlatiladi)
async function callGeminiDirect(messages: Message[], signal?: AbortSignal): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  const formattedMessages = messages.map((m) => {
    if (m.image && m.image.includes(",")) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content || "Rasmni tahlil qilib ber." },
          { type: "image_url", image_url: { url: m.image } }
        ]
      };
    }
    return { role: m.role, content: m.content || "" };
  });

  const models = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages
        }),
        signal
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API xatosi (${resp.status})`);
      }

      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch (err: any) {
      if (err.name === "AbortError") throw err;
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini javob bermadi.");
}

export async function sendChat(messages: Message[], signal?: AbortSignal): Promise<string> {
  // 1. Avval backend API'ga urinib ko'ramiz
  try {
    const resp = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.reply) return data.reply;
    }

    // Agar 404 yoki boshqa xato bo'lsa (masalan Netlify'da backend bo'lmasa):
    console.warn("Backend 404 qaytardi yoki mavjud emas. To'g'ridan-to'g'ri Gemini'ga ulanilmoqda...");
    return await callGeminiDirect(messages, signal);
  } catch (err: any) {
    if (err.name === "AbortError") throw err;
    // Backend mavjud bo'lmasa to'g'ridan-to'g'ri Gemini orqali chaqiramiz
    return await callGeminiDirect(messages, signal);
  }
}

export async function sendContactMessage(name: string, message: string, image: string | null): Promise<string> {
  try {
    const resp = await fetch(`${API_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, image }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.detail || "Muvaffaqiyatli yuborildi";
    }
  } catch {}

  // Backend bo'lmasa to'g'ridan-to'g'ri Telegram botga yuborish
  try {
    const text = `📬 Yangi murojaat:\n👤 Ism: ${name}\n💬 Xabar: ${message || "(faqat rasm)"}`;
    
    if (image && image.includes(",")) {
      const byteString = atob(image.split(",")[1]);
      const mimeString = image.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      
      const formData = new FormData();
      formData.append("chat_id", TELEGRAM_CHAT_ID);
      formData.append("caption", text);
      formData.append("photo", blob, "photo.jpg");

      const teleResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData
      });
      if (teleResp.ok) return "Xabar va rasm adminga yetkazildi!";
    } else {
      const teleResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text
        })
      });
      if (teleResp.ok) return "Xabar adminga yetkazildi!";
    }
  } catch (err: any) {
    throw new Error(err.message || "Xabar yuborishda xatolik");
  }

  return "Xabar yuborildi";
}

export async function getContactMessages(): Promise<any[]> {
  try {
    const resp = await fetch(`${API_URL}/api/contact`);
    if (resp.ok) return await resp.json();
  } catch {}
  return [];
}
