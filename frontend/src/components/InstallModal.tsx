import { useEffect, useState } from "react";

interface Props {
  deferredPrompt: any;
  onClose: () => void;
  onInstalled?: () => void;
}

export default function InstallModal({ deferredPrompt, onClose, onInstalled }: Props) {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // iOS Safari tekshiruvi
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Standalone (allaqachon o'rnatilgan) tekshiruvi
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          if (onInstalled) onInstalled();
          onClose();
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      } finally {
        setInstalling(false);
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="install-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Yopish">
          ✕
        </button>

        <div className="install-modal-header">
          <div className="install-app-icon">
            <img src="/icon-192.png" alt="proAI Logo" />
            <div className="icon-glow"></div>
          </div>
          <h3>proAI Ilovasini Yuklab Olish</h3>
          <p className="install-modal-subtitle">
            Telefon va kompyuterga to'liq ilova (PWA) sifatida o'rnating. Xuddi rasmiy dasturlardek
            brauzersiz, to'liq ekranda ishlaydi!
          </p>
        </div>

        {isStandalone ? (
          <div className="install-status-box success">
            <span className="status-icon">✅</span>
            <div>
              <strong>Ilova allaqachon o'rnatilgan!</strong>
              <p>Siz hozirda proAI rasmiy ilovasidan foydalanmoqdasiz.</p>
            </div>
          </div>
        ) : isIOS ? (
          <div className="ios-instructions">
            <div className="instruction-step">
              <span className="step-num">1</span>
              <div>
                Safari brauzerining pastki qismidagi <strong>"Ulashish" (Share / ⎋)</strong> tugmasini
                bosing.
              </div>
            </div>
            <div className="instruction-step">
              <span className="step-num">2</span>
              <div>
                Ochilgan menyudan pastroqqa tushib <strong>"Bosh ekranga qo'shish" (Add to Home Screen / ➕)</strong>{" "}
                bandini tanlang.
              </div>
            </div>
            <div className="instruction-step">
              <span className="step-num">3</span>
              <div>
                Yuqori o'ng burchakdagi <strong>"Qo'shish" (Add)</strong> tugmasini bosing. Tayyor!
              </div>
            </div>
          </div>
        ) : (
          <div className="install-features">
            <div className="feature-item">
              <span className="feat-icon">⚡</span>
              <div>
                <strong>Tezkor ochilish</strong>
                <span>Bir tegish bilan asosiy ekrandan to'g'ridan-to'g'ri kirish</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feat-icon">📱</span>
              <div>
                <strong>To'liq ekran qulayligi</strong>
                <span>Ortiqcha brauzer panellarisiz haqiqiy mobil ilova ko'rinishi</span>
              </div>
            </div>
            <div className="feature-item">
              <span className="feat-icon">💾</span>
              <div>
                <strong>Xotirada kam joy</strong>
                <span>Faqat bir necha megabayt joy egallaydi va internetni tejaydi</span>
              </div>
            </div>

            <button
              className="install-action-btn"
              onClick={handleInstallClick}
              disabled={installing}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{installing ? "O'rnatilmoqda..." : "Ilovani O'rnatish (Yuklab olish)"}</span>
            </button>
          </div>
        )}

        <div className="install-modal-foot">
          <button className="btn-secondary" onClick={onClose}>
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
