# proAI — React + TypeScript + Python (FastAPI)

Do'stingiznikiga o'xshash tuzilma: **backend (Python)** kalitni yashiradi,
**frontend (React + TS)** foydalanuvchi interfeysi. Ikkalasi alohida
ishga tushadi va bir-biri bilan HTTP orqali gaplashadi.

```
proai-fullstack/
  backend/            ← Python (FastAPI) server — kalitni saqlaydi
    main.py
    requirements.txt
    .env.example
  frontend/            ← React + TypeScript (Vite)
    src/
    package.json
    .env.example
```

## 1) Backendni ishga tushirish (Python)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# .env faylini oching, OPENAI_API_KEY ni haqiqiy kalitingizga almashtiring

uvicorn main:app --reload --port 8000
```

Server `http://localhost:8000` da ishga tushadi.
Tekshirish: `http://localhost:8000/api/health`

## 2) Frontendni ishga tushirish (React + TS)

Boshqa terminalda:

```bash
cd frontend
npm install

cp .env.example .env
# .env faylida VITE_API_URL=http://localhost:8000 (default shu)

npm run dev
```

Sayt `http://localhost:5173` da ochiladi.

## 3) Ishlatish

1. Sayt ochiladi → login/ro'yxatdan o'tish ekrani
2. Hisob yarating (faqat shu brauzeringizda saqlanadi)
3. Savol yozing — frontend backendga, backend esa OpenAI'ga murojaat qiladi
4. **Hech qanday API kalit oynasi chiqmaydi** — u sizning `.env` faylingizda

## Production'ga chiqarish (deploy)

- **Backend** (Python/FastAPI): Render.com, Railway.app yoki Fly.io — bularning
  hammasida "Python service" turi bor, `uvicorn main:app` ni start command
  qilib bering, `OPENAI_API_KEY` ni Environment Variables bo'limiga qo'ying.
- **Frontend** (React): Netlify yoki Vercel — `frontend` papkasini ulang,
  build command: `npm run build`, publish directory: `dist`.
  `VITE_API_URL` ni backend'ning production linkiga o'zgartiring
  (masalan `https://proai-backend.onrender.com`).
- Backend'dagi `ALLOWED_ORIGINS` ga frontend domeningizni qo'shishni
  unutmang (CORS uchun), masalan: `https://proai.netlify.app`.

## Eslatma

- Login/parol hozircha faqat brauzerda (localStorage) saqlanadi — bu demo
  uchun yetarli, lekin chin ko'p-qurilmali hisob tizimi emas. Chinakam
  foydalanuvchi bazasi (PostgreSQL/boshqa DB) kerak bo'lsa, alohida so'rang.
- API kalit **faqat** backend serveringizda turadi, hech qachon frontend
  kodiga yoki brauzerga chiqmaydi.

## Ishga tushirish (yangilangan)

1. `backend-node` papkasida `.env.example` nusxasini `.env` nomi bilan saqlang.
2. `.env` ichidagi `GEMINI_API_KEY` qiymatiga o'zingizning Gemini API kalitingizni kiriting. Kalitni frontendga yoki Netlify'ga joylamang.
3. Backend: `cd backend-node`, `npm install`, `npm run dev`.
4. Frontend: boshqa terminalda `cd frontend`, `npm install`, `npm run dev`.
5. Netlify'da frontend ishlatilsa, `VITE_API_URL` ni internetdan ochiladigan backend manziliga sozlang. `localhost` Netlify'dan ishlamaydi.

Rasm yuklash: 📎 tugmasi, clipboard paste yoki chat oynasiga drag-and-drop. Rasm JPG/PNG/WEBP bo'lishi va 15 MB dan oshmasligi kerak. Rasmga qarab savol berish, masalan matematik misolni yechish, backenddagi Gemini vision modeliga bog'liq. Rasm generatsiyasi bu loyihada ulanmagan.
