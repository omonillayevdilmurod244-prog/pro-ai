import { useEffect, useRef, useState, useCallback } from "react";
import type { Chat } from "../types";
import { md } from "../lib/markdown";
import AiLogo from "./AiLogo";

const SUGGESTIONS = ["Reja tuzib ber", "Kodni tushuntir", "Xat yozib ber", "Fikr ber"];

interface Props {
  chat: Chat | null;
  busy: boolean;
  onSuggestion: (text: string) => void;
}

export default function ChatThread({ chat, busy, onSuggestion }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [chat?.msgs.length, busy, chat?.msgs[chat?.msgs.length - 1]?.content]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [chat?.id]);

  const copy = useCallback((text: string, idx: number) => {
    const clean = text.replace(/```[\s\S]*?```/g, (m) => m).replace(/<[^>]*>/g, "");
    navigator.clipboard?.writeText(clean).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(() => {});
  }, []);

  const speakText = useCallback((idx: number, text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Brauzeringiz ovozli o'qishni qo'llab-quvvatlamaydi.");
      return;
    }

    if (speakingIndex === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, " [kod bloki] ")
      .replace(/#{1,6}\s/g, "")
      .replace(/[*_`~]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, ". ")
      .trim();

    if (!cleanText) return;

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();

      // Eng yaxshi ovozni tanlash
      const bestVoice =
        voices.find((v) => v.lang.startsWith("uz")) ||
        voices.find((v) => v.name.toLowerCase().includes("google") && v.lang.startsWith("ru")) ||
        voices.find((v) => v.name.toLowerCase().includes("google") && v.lang.startsWith("en")) ||
        voices.find((v) => v.name.toLowerCase().includes("natural")) ||
        voices.find((v) => v.name.toLowerCase().includes("neural")) ||
        voices.find((v) => v.lang.startsWith("ru")) ||
        voices.find((v) => v.lang.startsWith("en-US")) ||
        voices[0];

      if (bestVoice) utterance.voice = bestVoice;

      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);

      setSpeakingIndex(idx);
      window.speechSynthesis.speak(utterance);
    };

    // Chrome bug: getVoices() bo'sh qaytarishi mumkin
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    } else {
      doSpeak();
    }
  }, [speakingIndex]);

  if (!chat || chat.msgs.length === 0) {
    return (
      <div className="scroll" style={{ display: "flex" }}>
        <div className="hero">
          <div className="hero-logo-wrap">
            <div className="hero-logo-ring" />
            <AiLogo size={48} className="hero-logo-icon" />
          </div>
          <h1 className="hero-title">
            proAI. Bugun nimada<br /><span className="hero-gradient">yordam beray?</span>
          </h1>
          <p className="hero-sub">Savolingizni yozing, rasm yuboring yoki ovoz bilan gapiring</p>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => onSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll" ref={scrollRef}>
      <div className="thread">
        {chat.msgs.map((m, idx) => {
          const isLast = idx === chat.msgs.length - 1;
          if (m.role === "user") {
            return (
              <div key={idx} className="msg user">
                <div className="bubble">
                  {m.image && (
                    <div className="msg-image-wrap">
                      <img src={m.image} alt="Yuklangan rasm" className="msg-image" />
                    </div>
                  )}
                  {m.content && <div>{m.content}</div>}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="msg bot">
              <div className={`avatar${isLast && busy && !m.content ? " avatar-pulse" : ""}`} title="proAI">
                <AiLogo />
              </div>
              <div className="answer">
                {m.content ? (
                  <>
                    <div dangerouslySetInnerHTML={{ __html: md(m.content) }} />
                    {isLast && busy && <span className="typing-cursor" />}
                  </>
                ) : isLast && busy ? (
                  <div className="typing-dots">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                ) : null}
                {m.content && !busy && (
                  <div className="actions">
                    <button
                      onClick={() => copy(m.content, idx)}
                      title="Matnni nusxalash"
                      className={copiedIndex === idx ? "copied" : ""}
                    >
                      {copiedIndex === idx ? "✅ Nusxalandi" : "📋 Nusxalash"}
                    </button>
                    <button
                      onClick={() => speakText(idx, m.content)}
                      className={speakingIndex === idx ? "speaking" : ""}
                      title={speakingIndex === idx ? "Ovozni to'xtatish" : "Ovozli eshitish"}
                    >
                      {speakingIndex === idx ? "🛑 To'xtatish" : "🔊 Tinglash"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
