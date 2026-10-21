import { useRef, useState, KeyboardEvent, ChangeEvent, ClipboardEvent, DragEvent } from "react";

interface Props {
  value: string;
  image: string | null;
  busy: boolean;
  onChange: (v: string) => void;
  onImageChange: (img: string | null) => void;
  onSubmit: () => void;
}

export default function Composer({
  value,
  image,
  busy,
  onChange,
  onImageChange,
  onSubmit,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const recognitionRef = useRef<any>(null);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    resize();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || image) && !busy) {
        if (isListening && recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
        }
        onSubmit();
      }
    }
  }

  function processFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Faqat rasm faylini tanlang (JPG, PNG yoki WEBP).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("Rasm 15 MB dan kichik bo'lishi kerak.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert("Rasmni o'qib bo'lmadi. Boshqa faylni tanlang.");
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") onImageChange(result);
    };
    reader.readAsDataURL(file);
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    processFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          e.preventDefault();
          processFile(files[i]);
          break;
        }
      }
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          processFile(files[i]);
          break;
        }
      }
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function toggleListen() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Brauzeringiz ovozli kiritishni (Speech Recognition) qo'llab-quvvatlamaydi.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "uz-UZ";

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript.trim()) {
          onChange(value ? `${value} ${transcript.trim()}` : transcript.trim());
          resize();
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }

  return (
    <div
      className="composer-wrap"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={"composer" + (isDragging ? " drag-over" : "")}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileRef.current?.click()}
          title="Rasm biriktirish"
        >
          <span aria-hidden="true">＋</span>
        </button>

        <button
          type="button"
          className={"attach-btn mic-btn" + (isListening ? " listening" : "")}
          onClick={toggleListen}
          title={isListening ? "Ovozli kiritishni to'xtatish" : "Ovoz bilan gapirish"}
        >
          {isListening ? "🛑" : "🎙️"}
        </button>

        <div className="composer-input-area">
          {image && (
            <div className="image-preview">
              <img src={image} alt="Biriktirilgan rasm" />
              <button
                type="button"
                className="remove-img"
                onClick={() => onImageChange(null)}
                title="Rasmni o'chirish"
              >
                ✕
              </button>
            </div>
          )}
          <textarea
            ref={ref}
            rows={1}
            placeholder={isListening ? "Eshitilmoqda, gapiring..." : "Istalgan narsani so'rang yoki rasm/ovoz bering..."}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          className="round send"
          disabled={busy || (!value.trim() && !image)}
          onClick={onSubmit}
          title="Yuborish"
          aria-label="Yuborish"
        >
          {busy ? (
            <span className="send-spinner"></span>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          )}
        </button>
      </div>
      <div className="foot">proAI xatoga yo'l qo'yishi mumkin. Muhim ma'lumotlarni tekshiring.</div>
    </div>
  );
}


