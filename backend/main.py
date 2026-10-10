"""
proAI backend (FastAPI).

Supports both Google Gemini API and Groq API.
Auto-detects API key type or uses GEMINI_API_KEY / GROQ_API_KEY environment variables.
"""

import os
from typing import List, Literal, Tuple, Dict, Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(title="proAI backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = ""
    image: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[Message]


class ChatResponse(BaseModel):
    reply: str


def get_ai_config() -> Tuple[str, str, str, str]:
    """
    Returns (provider, api_key, api_url, model).
    Providers: 'gemini' or 'groq'
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    generic_key = os.getenv("API_KEY", "").strip()

    if gemini_key:
        api_key = gemini_key
        provider = "gemini"
    elif groq_key:
        api_key = groq_key
        provider = "gemini" if (groq_key.startswith("AIzaSy") or groq_key.startswith("AQ.")) else "groq"
    elif generic_key:
        api_key = generic_key
        provider = "gemini" if (generic_key.startswith("AIzaSy") or generic_key.startswith("AQ.")) else "groq"
    else:
        api_key = ""
        provider = "gemini"

    if provider == "gemini":
        model = os.getenv("GEMINI_MODEL", os.getenv("MODEL", "gemini-3.8-flash")).strip()
        if model.startswith("openai/"):
            model = "gemini-3.8-flash"
        api_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    else:
        model = os.getenv("GROQ_MODEL", os.getenv("MODEL", "openai/gpt-oss-120b")).strip()
        api_url = "https://api.groq.com/openai/v1/chat/completions"

    return provider, api_key, api_url, model


@app.get("/api/health")
def health():
    provider, api_key, api_url, model = get_ai_config()
    return {
        "ok": True,
        "provider": provider,
        "key_configured": bool(api_key),
        "model": model,
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    provider, api_key, api_url, model = get_ai_config()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Server sozlanmagan: GEMINI_API_KEY yoki GROQ_API_KEY topilmadi.",
        )
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages bo'sh bo'lmasligi kerak.")

    formatted_messages = []
    for m in req.messages:
        if m.image:
            formatted_messages.append({
                "role": m.role,
                "content": [
                    {"type": "text", "text": m.content or "Rasmni tahlil qilib ber."},
                    {"type": "image_url", "image_url": {"url": m.image}}
                ]
            })
        else:
            formatted_messages.append({"role": m.role, "content": m.content})

    payload = {
        "model": model,
        "messages": formatted_messages,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json=payload,
            )
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"AI serveriga ulanib bo'lmadi ({provider}): {e}")

        data = resp.json()

        if resp.status_code >= 400:
            if provider == "gemini":
                native_reply = await try_native_gemini(client, api_key, model, req.messages)
                if native_reply:
                    return ChatResponse(reply=native_reply)

            msg = (data.get("error") or {}).get("message", f"{provider.capitalize()} xatosi")
            raise HTTPException(status_code=resp.status_code, detail=msg)

    reply = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return ChatResponse(reply=reply)


async def try_native_gemini(client: httpx.AsyncClient, api_key: str, model: str, messages: List[Message]) -> Optional[str]:
    """Fallback to direct Gemini REST API generateContent endpoint."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    contents = []
    system_instruction = None
    for m in messages:
        if m.role == "system":
            system_instruction = {"parts": [{"text": m.content}]}
        elif m.role in ("user", "assistant"):
            role = "user" if m.role == "user" else "model"
            parts = []
            if m.content:
                parts.append({"text": m.content})
            if m.image and "," in m.image:
                try:
                    header, b64data = m.image.split(",", 1)
                    mime_type = header.split(";")[0].replace("data:", "") or "image/png"
                    parts.append({"inline_data": {"mime_type": mime_type, "data": b64data}})
                except Exception:
                    pass
            if parts:
                contents.append({"role": role, "parts": parts})

    body: Dict[str, Any] = {"contents": contents}
    if system_instruction:
        body["system_instruction"] = system_instruction

    try:
        resp = await client.post(url, json=body)
        if resp.status_code == 200:
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
    except Exception:
        pass
    return None


