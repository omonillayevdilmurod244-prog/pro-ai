import type { Message } from "../types";

function decodeKey(b64: string): string {
  try {
    return atob(b64);
  } catch {
    return "";
  }
}

const GEMINI_API_KEY =
  (import.meta.env.VITE_GEMINI_API_KEY as string) ||
  decodeKey("QVEuQWI4Uk42S3I0QXlpaFJ2N3k3SWdGQ283MHNRd2g5VGhiZURWTjhXckNhWkJrakFQOVE=");

const TELEGRAM_BOT_TOKEN =
  (import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string) ||
  decodeKey("ODYxMTU5MDc1NDpBQUhYWUpuR3hpbEt1RzhDM0lNTnJPNy1XQlVNRm5fSHg2UQ==");

const TELEGRAM_CHAT_ID =
  (import.meta.env.VITE_TELEGRAM_CHAT_ID as string) || "7041426213";

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
        const msg =
          errData?.error?.message ||
          (Array.isArray(errData) ? errData[0]?.error?.message : null) ||
          `Gemini API xatosi (${resp.status})`;
        throw new Error(msg);
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

let lastTelegramUpdateId = 0;

export async function sendContactMessage(name: string, message: string, image: string | null): Promise<string> {
  // 1. Agar backend mavjud bo'lsa, backend orqali yuborish
  try {
    const resp = await fetch(`${API_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, image }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data.detail || "Xabar yuborildi";
    }
  } catch {}

  // 2. Standalone / Netlify rejimida to'g'ridan-to'g'ri Telegram botga yuborish
  try {
    const text = `📬 <b>Yangi murojaat!</b>\n\n👤 <b>Ism:</b> ${name}\n💬 <b>Xabar:</b> ${message || "(faqat rasm)"}`;

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
      formData.append("parse_mode", "HTML");
      formData.append("photo", blob, "photo.jpg");

      const teleResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: "POST",
        body: formData
      });
      if (!teleResp.ok) {
        throw new Error("Telegramga rasm yuborib bo'lmadi");
      }
      return "Xabar va rasm adminga yetkazildi!";
    } else {
      const teleResp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: "HTML"
        })
      });
      if (!teleResp.ok) {
        throw new Error("Telegramga xabar yuborib bo'lmadi");
      }
      return "Xabar adminga yetkazildi!";
    }
  } catch (err: any) {
    throw new Error(err.message || "Xabar yuborishda xatolik");
  }
}

export async function getContactMessages(): Promise<any[]> {
  // 1. Agar backend mavjud bo'lsa
  try {
    const resp = await fetch(`${API_URL}/api/contact`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}

  // 2. Agar Telegram'dan to'g'ridan-to'g'ri yangi xabarlarni tekshirish kerak bo'lsa
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastTelegramUpdateId + 1}&timeout=1`;
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (data.ok && Array.isArray(data.result)) {
        const newMsgs: any[] = [];
        for (const update of data.result) {
          lastTelegramUpdateId = update.update_id;
          if (update.message && update.message.chat?.id?.toString() === TELEGRAM_CHAT_ID) {
            if (update.message.text && !update.message.text.startsWith("/")) {
              newMsgs.push({
                id: update.message.message_id.toString(),
                role: "admin",
                content: update.message.text
              });
            }
          }
        }
        return newMsgs;
      }
    }
  } catch {}

  return [];
}
