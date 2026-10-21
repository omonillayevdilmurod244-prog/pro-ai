import { useState, useEffect, FormEvent } from "react";
import { signUp, logIn, hasAnyUser } from "../lib/storage";
import type { AuthUser } from "../types";
import AiLogo from "./AiLogo";

interface Props {
  onAuth: (user: AuthUser) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"signup" | "login">(hasAnyUser() ? "login" : "signup");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  // 3 soniyalik loading holati
  const [loadingUser, setLoadingUser] = useState<AuthUser | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState("Hisob ma'lumotlari saqlanmoqda...");

  const isSignup = mode === "signup";

  // 3 soniyalik yuklanish taymeri
  useEffect(() => {
    if (!loadingUser) return;

    const startTime = Date.now();
    const duration = 3000; // 3 soniya

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.round((elapsed / duration) * 100), 100);
      setLoadingProgress(progress);

      if (progress < 30) {
        setLoadingStatus("Hisob ma'lumotlari xavfsiz saqlanmoqda...");
      } else if (progress < 65) {
        setLoadingStatus("proAI shaxsiy xonangiz sozlanmoqda...");
      } else if (progress < 95) {
        setLoadingStatus("Sun'iy intellekt modeli ulanmoqda...");
      } else {
        setLoadingStatus("Xush kelibsiz! ✨");
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        try {
          onAuth(loadingUser);
        } catch {}
        // Qora ekran chiqib qolmasligi va to'liq toza ishga tushishi uchun
        window.location.reload();
      }
    }, 40);

    return () => clearInterval(interval);
  }, [loadingUser, onAuth]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!u || !pass) {
      setError("Login va parolni kiriting.");
      return;
    }
    if (isSignup) {
      const user = signUp(u, pass, name.trim());
      if (!user) {
        setError("Bu login band. Kirishni tanlang.");
        return;
      }
      // Yangi akkaunt ochilganda 3 soniyalik chiroyli loading ekrani boshlanadi
      setLoadingUser(user);
    } else {
      const user = logIn(u, pass);
      if (!user) {
        setError("Login yoki parol noto'g'ri.");
        return;
      }
      onAuth(user);
    }
  }

  // 3 soniyalik yuklanish ekrani
  if (loadingUser) {
    return (
      <div className="auth-screen">
        <div className="auth-loading-card">
          <div className="loading-logo-wrap">
            <div className="loading-pulse-ring"></div>
            <div className="loading-pulse-ring-outer"></div>
            <AiLogo size={56} className="loading-logo-icon" />
          </div>

          <h2>Hisobingiz yaratildi! 🎉</h2>
          <p className="loading-sub">
            Salom, <strong>{loadingUser.name || loadingUser.username}</strong>! proAI shaxsiy
            tizimingiz tayyorlanmoqda...
          </p>

          <div className="auth-progress-container">
            <div className="auth-progress-track">
              <div
                className="auth-progress-bar"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="auth-progress-meta">
              <span className="auth-status-text">{loadingStatus}</span>
              <span className="auth-progress-percent">{loadingProgress}%</span>
            </div>
          </div>

          <div className="loading-timer-badge">
            <span className="timer-dot"></span>
            <span>Yuklanmoqda... (3 soniya)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <h1>{isSignup ? "proAI'ga xush kelibsiz" : "Qaytganingizdan xursandmiz"}</h1>
        <p className="sub">{isSignup ? "Davom etish uchun hisob yarating" : "Davom etish uchun kiring"}</p>
        {error && <div className="auth-err show">{error}</div>}
        <form onSubmit={submit}>
          {isSignup && (
            <>
              <label>Ismingiz</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ismingiz" />
            </>
          )}
          <label>Login</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login" />
          <label>Parol</label>
          <div className="pass-field">
            <input
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              className="pass-toggle"
              onClick={() => setShowPass((v) => !v)}
              title={showPass ? "Parolni yashirish" : "Parolni ko'rsatish"}
              aria-label={showPass ? "Parolni yashirish" : "Parolni ko'rsatish"}
            >
              {showPass ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button type="submit" className="auth-submit">
            {isSignup ? "Hisob yaratish" : "Kirish"}
          </button>
        </form>
        <div className="auth-switch">
          <span>{isSignup ? "Hisobingiz bormi?" : "Hisobingiz yo'qmi?"}</span>{" "}
          <button
            onClick={() => {
              setError("");
              setMode(isSignup ? "login" : "signup");
            }}
          >
            {isSignup ? "Kirish" : "Ro'yxatdan o'tish"}
          </button>
        </div>
      </div>
    </div>
  );
}
