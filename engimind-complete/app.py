
import os
import logging
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI, AuthenticationError
from pydantic import BaseModel, Field

from agents.orchestrator import run_orchestrator


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

load_dotenv(BASE_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("engimind")

app = FastAPI(
    title="EngiMind AI",
    description="AI-powered multi-domain engineering assistant",
    version="1.0.0"
)


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class EngineeringTask(BaseModel):
    task: str = Field(
        min_length=5,
        max_length=12000,
        description="Engineering question or problem"
    )

    domain: Literal[
        "auto",
        "civil",
        "structural",
        "electrical",
        "mechanical"
    ] = "auto"


# --------------------------------------------------
# ENVIRONMENT CONFIGURATION
# --------------------------------------------------

def get_api_key():
    return os.getenv("OPENAI_API_KEY")


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "api_key_configured": bool(get_api_key()),
        "model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    }


# --------------------------------------------------
# MAIN AI SOLVER
# --------------------------------------------------

@app.post("/api/solve")
def solve(payload: EngineeringTask):

    api_key = get_api_key()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured. Add OPENAI_API_KEY to your .env file."
        )

    model = os.getenv(
        "OPENAI_MODEL",
        "gpt-4.1-mini"
    )

    try:

        client = OpenAI(
            api_key=api_key,
            timeout=90.0,
            max_retries=2
        )

        logger.info(
            "Processing engineering task | Domain: %s",
            payload.domain
        )

        result = run_orchestrator(
            payload.task,
            payload.domain,
            client,
            model
        )

        return result

    except AuthenticationError:

        logger.error("OpenAI authentication failed.")

        raise HTTPException(
            status_code=503,
            detail="OpenAI authentication failed. Check whether your API key is valid."
        )

    except Exception as exc:

        logger.exception(
            "EngiMind request failed: %s",
            type(exc).__name__
        )

        raise HTTPException(
            status_code=502,
            detail="The AI request could not be completed. Check the server logs."
        )


# --------------------------------------------------
# FRONTEND
# --------------------------------------------------

@app.get("/")
def home():

    index_file = STATIC_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Frontend index.html was not found in the static folder."
        )

    return FileResponse(index_file)


# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

if STATIC_DIR.exists():

    app.mount(
        "/",
        StaticFiles(
            directory=STATIC_DIR,
            html=True
        ),
        name="static"
    )

import os
import logging
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from agents.orchestrator import run_orchestrator


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

load_dotenv(BASE_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("engimind")

app = FastAPI(
    title="EngiMind AI",
    description="AI-powered engineering assistant",
    version="2.0.0"
)


# --------------------------------------------------
# REQUEST MODEL
# --------------------------------------------------

class EngineeringTask(BaseModel):
    task: str = Field(min_length=5, max_length=12000)

    domain: Literal[
        "auto",
        "civil",
        "structural",
        "electrical",
        "mechanical"
    ] = "auto"


# --------------------------------------------------
# GEMINI CONFIGURATION
# --------------------------------------------------

def get_gemini_client():

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is missing. Configure GEMINI_API_KEY in .env"
        )

    return genai.Client(api_key=api_key)


def get_model():
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/api/health")
def health():

    return {
        "status": "ok",
        "provider": "Google Gemini",
        "api_key_configured": bool(
            os.getenv("GEMINI_API_KEY")
        ),
        "model": get_model()
    }


# --------------------------------------------------
# ENGINEERING AI SOLVER
# --------------------------------------------------

@app.post("/api/solve")
def solve(payload: EngineeringTask):

    logger.info(
        "Processing task | Domain: %s",
        payload.domain
    )

    try:

        client = get_gemini_client()

        result = run_orchestrator(
            payload.task,
            payload.domain,
            client,
            get_model()
        )

        return result

    except HTTPException:
        raise

    except Exception as exc:

        logger.exception(
            "EngiMind Gemini request failed: %s",
            type(exc).__name__
        )

        error_name = type(exc).__name__

        if error_name in ("ResourceExhausted", "TooManyRequests"):
            raise HTTPException(
                status_code=429,
                detail="Gemini free-tier quota or rate limit reached. Try again later or check AI Studio limits."
            )

        if error_name in ("AuthenticationError", "PermissionDenied"):
            raise HTTPException(
                status_code=503,
                detail="Gemini authentication failed. Check your API key."
            )

        raise HTTPException(
            status_code=502,
            detail="Gemini AI request failed. Check server logs."
        )


# --------------------------------------------------
# FRONTEND
# --------------------------------------------------

@app.get("/")
def home():

    index_file = STATIC_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Frontend index.html not found."
        )

    return FileResponse(index_file)


# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------

if STATIC_DIR.exists():

    app.mount(
        "/",
        StaticFiles(
            directory=STATIC_DIR,
            html=True
        ),
        name="static"
    )
