# main.py

import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
from dotenv import load_dotenv

# --- 1. Load Environment Variables ---
# This is a crucial step to load our secret API keys from the .env file
load_dotenv()

# We can check if the keys are loaded (optional, but good for debugging)
portia_api_key = os.getenv("PORTIA_API_KEY")
openai_api_key = os.getenv("OPENAI_API_KEY")

if not portia_api_key or not openai_api_key:
    print("🔴 Critical Error: API keys not found. Make sure you have a .env file with PORTIA_API_KEY and OPENAI_API_KEY.")
else:
    print("✅ API keys loaded successfully.")

# --- 2. Create FastAPI App Instance ---
app = FastAPI(
    title="ClinicConnect - Dental Clinic",
    description="Modern dental clinic website with appointment booking.",
    version="1.0.0"
)

# --- 3. Setup Static Files and Templates ---
# Create directories if they don't exist
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup templates
templates = Jinja2Templates(directory="templates")

# --- 4. Create the Main Dental Clinic Website ---
@app.get("/", response_class=HTMLResponse)
async def dental_clinic_homepage(request: Request):
    """
    Main dental clinic homepage with modern UI and appointment booking.
    """
    return templates.TemplateResponse("index.html", {"request": request})

# --- 5. Add the Main Entry Point to Run the Server ---
if __name__ == "__main__":
    print("🚀 Starting ClinicConnect Dental Clinic server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)