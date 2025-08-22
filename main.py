# main.py

import os
import asyncio
from fastapi import FastAPI, WebSocket, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv

# --- Import SDKs ---
from deepgram import DeepgramClient, DeepgramClientOptions, LiveTranscriptionEvents, LiveOptions
from portia import Portia, Config
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
from google.generativeai import GenerativeModel

# --- 1. Load Environment Variables ---
load_dotenv()
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
elevenlabs = ElevenLabs(
  api_key='ELEVENLABS_API_KEY',
)

# --- 2. Create FastAPI App & Templates ---
app = FastAPI()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- 3. Create the Agent Configuration (The Correct Way) ---
# The documentation you found shows all settings go inside this Config object.
config = Config(
    llm_provider="google",
    model="gemini-1.5-flash",
    system_prompt=(
        "You are a friendly, expert AI receptionist for a dental clinic named Smile Care. "
        "Your primary goal is to help patients book appointments. "
        "You are conversational and helpful. Keep your responses concise and natural."
    )
)
# --- 4. HTTP Route for the Frontend ---
@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# --- 4. Initialize AI Services ---
agent = Portia(config=config)
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
print("✅ Portia and ElevenLabs clients initialized correctly.")


# --- 5. Background Task for AI Processing ---
async def process_agent_response(transcript: str, websocket: WebSocket):
    try:
        await websocket.send_json({"action": "play_thinking_audio"})
        print(f"🎤 User said: '{transcript}'")
        print("🧠 Agent is thinking...")

        # --- THE FIX: Use agent.run() with only the transcript ---
        # The Config object already contains all the agent's instructions.
        agent_run_result = await asyncio.to_thread(
            agent.run,
            transcript
        )      
         # --- 2. Extract the final_output from the result object ---
        agent_response_text = agent_run_result.outputs.final_output.get_value()
        print(f"🤖 Agent responded with text: '{agent_response_text}'")
        

        # --- Stream the response as audio with ElevenLabs ---
        audio_stream = elevenlabs.text_to_speech.stream(
            text=agent_response_text,
            model_id="eleven_flash_v2_5",
            voice_id="RXe6OFmxoC0nlSWpuCDy",
            voice_settings=VoiceSettings(
            stability=6,
            similarity_boost=7.5,
            style=0.0,
            use_speaker_boost=True,
            speed=0.93,
        )
        )
        
        for chunk in audio_stream:
            if chunk:
                await websocket.send_bytes(chunk)
        
        await websocket.send_json({"action": "end_of_ai_audio"})

    except Exception as e:
        print(f"🔴 ERROR during agent run or TTS: {e}")
        await websocket.send_text("Sorry, I'm having a technical issue. Please try again.")


# --- 6. Main WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("✅ WebSocket connection established.")
    try:
        deepgram_config = DeepgramClientOptions(verbose=0)
        deepgram: DeepgramClient = DeepgramClient(DEEPGRAM_API_KEY, deepgram_config)
        dg_connection = deepgram.listen.asynclive.v("1")

        async def on_message(self, result, **kwargs):
            transcript = result.channel.alternatives[0].transcript
            if len(transcript) > 0:
                asyncio.create_task(process_agent_response(transcript, websocket))

        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        options = LiveOptions(model="nova-2", language="en-US", smart_format=True)
        await dg_connection.start(options)

        while True:
            audio_data = await websocket.receive_bytes()
            await dg_connection.send(audio_data)

    except Exception as e:
        print(f"🔴 WebSocket or Deepgram error: {e}")
    finally:
        print("🔌 WebSocket connection closed.")
        if 'dg_connection' in locals() and dg_connection:
            await dg_connection.finish()
            

# --- 7. Main Entry Point ---
if __name__ == "__main__":
    print("🚀 Starting ClinicConnect server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)