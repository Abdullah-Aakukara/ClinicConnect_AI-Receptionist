# calendar_tool.py

import os.path
from datetime import datetime, timedelta
from portia.v2.tools import tool # <-- Correct import from the examples
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar"]

@tool
def book_appointment(time: str, summary: str = "Dental Appointment") -> str:
    """
    Books a new event in the Google Calendar.
    'time' should be in a format like 'tomorrow at 3pm' or 'August 25th at 10am'.
    'summary' is the title of the event.
    Returns a confirmation message.
    """
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    try:
        service = build("calendar", "v3", credentials=creds)
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        
        event = {
            "summary": summary,
            "start": {"dateTime": start_time.isoformat(), "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "Asia/Kolkata"},
        }

        event = service.events().insert(calendarId="primary", body=event).execute()
        confirmation = f"OK! I've booked your appointment for {start_time.strftime('%I:%M %p')}. You'll receive a confirmation shortly."
        print(confirmation)
        return confirmation

    except Exception as e:
        return f"An error occurred with the calendar: {e}"