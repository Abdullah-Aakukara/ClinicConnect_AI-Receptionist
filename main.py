# main.py

import os
import asyncio
import json
import shutil
import uuid
import time
import requests
from fastapi import FastAPI, WebSocket, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv

# --- NEW: Import Deepgram SDK ---
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

# --- 1. Load Environment Variables ---
load_dotenv()
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
PORTIA_API_URL = os.getenv("PORTIA_API_URL")  # e.g., https://api.portia.ai/v1/ingest
PORTIA_API_KEY = os.getenv("PORTIA_API_KEY")

# --- 2. Create FastAPI App Instance ---
app = FastAPI()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")


# --- 3. HTTP Route for the Frontend ---
@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# --- 4. WebSocket Endpoint with Real-time Streaming STT ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ WebSocket connection established.")

    try:
        loop = asyncio.get_running_loop()
        session_id = str(uuid.uuid4())
        transcript_queue: asyncio.Queue = asyncio.Queue()
        # --- NEW: Setup Deepgram Connection ---
        config = DeepgramClientOptions(
            verbose=1 # Increase logging for diagnostics
        )
        deepgram: DeepgramClient = DeepgramClient(DEEPGRAM_API_KEY, config)

        dg_connection = deepgram.listen.asynclive.v("1")

        # Function to handle incoming transcripts from Deepgram
        # Use a synchronous callback and schedule WebSocket sends on the event loop
        def on_message(self, result, **kwargs):
            try:
                transcript = None
                is_final = False
                if hasattr(result, "channel"):
                    transcript = result.channel.alternatives[0].transcript
                    is_final = getattr(result, "is_final", False)
                elif isinstance(result, dict):
                    transcript = result.get("channel", {}).get("alternatives", [{}])[0].get("transcript")
                    is_final = result.get("is_final", False)

                if transcript:
                    print(f"🎤 Transcription ({'final' if is_final else 'interim'}): '{transcript}'")
                    # Enqueue for Portia; do not send back to the browser
                    asyncio.run_coroutine_threadsafe(
                        transcript_queue.put((transcript, bool(is_final))),
                        loop,
                    )
            except Exception as err:
                print(f"⚠️ Transcript handler error: {err}")

        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)

        # Optional: log Deepgram lifecycle and errors for easier debugging
        def on_open(self, open, **kwargs):
            print("🔊 Deepgram stream opened.")

        def on_error(self, error, **kwargs):
            print(f"🛑 Deepgram error event: {error}")

        def on_close(self, close, **kwargs):
            print("🔇 Deepgram stream closed.")

        def on_utterance_end(self, end, **kwargs):
            print("✅ Utterance ended (pause detected).")

        dg_connection.on(LiveTranscriptionEvents.Open, on_open)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        
        # Configure Deepgram options for real-time voice
        # Transcode incoming Ogg/WebM Opus -> 16k PCM for maximum compatibility
        options = LiveOptions(
            model="nova-2",
            language="en-US",
            smart_format=True,
            interim_results=True,
            vad_events=True,
            endpointing=300,
            encoding="linear16",
            sample_rate=16000,
            channels=1,
        )

        await dg_connection.start(options)
        print("✅ Deepgram connection established and listening.")

        # --- Background task to forward transcripts to Portia efficiently ---
        portia_enabled = bool(PORTIA_API_URL and PORTIA_API_KEY)
        warned_portia = False

        def _post_to_portia(text: str, is_final: bool):
            headers = {
                "Authorization": f"Bearer {PORTIA_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "session_id": session_id,
                "text": text,
                "final": is_final,
                "timestamp_ms": int(time.time() * 1000),
            }
            try:
                resp = requests.post(PORTIA_API_URL, headers=headers, json=payload, timeout=5)
                return resp.status_code
            except Exception as e:
                print(f"⚠️ Portia POST failed: {e}")
                return None

        async def portia_worker():
            nonlocal warned_portia
            if not portia_enabled and not warned_portia:
                print("ℹ️ PORTIA_API_URL or PORTIA_API_KEY not set; skipping Portia forwarding.")
                warned_portia = True
            while True:
                text, is_final = await transcript_queue.get()
                try:
                    if portia_enabled:
                        await loop.run_in_executor(None, _post_to_portia, text, is_final)
                finally:
                    transcript_queue.task_done()

        portia_task = asyncio.create_task(portia_worker())

        # --- Receive PCM bytes from frontend and forward to Deepgram
        chunk_idx = 0
        while True:
            data = await websocket.receive_bytes()
            if chunk_idx % 20 == 0:
                print(f"➡️ Received PCM chunk: {len(data)} bytes (#{chunk_idx})")
            chunk_idx += 1
            await dg_connection.send(data)

    except Exception as e:
        print(f"🔴 WebSocket or Deepgram error: {e}")
    finally:
        print("🔌 WebSocket connection closed.")
        if 'dg_connection' in locals() and dg_connection:
            await dg_connection.finish()


# --- 5. Main Entry Point ---
if __name__ == "__main__":
    print("🚀 Starting ClinicConnect server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)