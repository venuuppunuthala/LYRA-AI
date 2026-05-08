import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI()

# In-memory storage for sessions (since we don't have a DB yet)
# In a real app, this would be a database.
sessions_db = {}

class UserProfile(BaseModel):
    name: str
    email: str
    photo: str

class SessionData(BaseModel):
    id: str
    data: dict

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "LYRA AI Python Backend is active"}

@app.post("/api/sessions/{user_email}")
async def save_sessions(user_email: str, sessions: List[dict]):
    sessions_db[user_email] = sessions
    return {"status": "success"}

@app.get("/api/sessions/{user_email}")
async def get_sessions(user_email: str):
    return sessions_db.get(user_email, [])

# Serve static files from the 'dist' directory
# This assumes the React app has been built
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # Check if the file exists in dist
        file_path = os.path.join("dist", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise, serve index.html for SPA routing
        return FileResponse("dist/index.html")
else:
    @app.get("/")
    async def root():
        return {"message": "Backend is running. Please build the frontend (npm run build) to see the UI."}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
