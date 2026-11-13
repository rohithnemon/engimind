# EngiMind AI — Complete integrated application

EngiMind AI combines the supplied animated engineering frontend with a FastAPI backend and a central orchestrator for Civil, Structural, Electrical and Mechanical specialist prompts.

## Run locally

Python 3.10+ is recommended.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
```

Add your OpenAI API key to `.env` (never put it in browser JavaScript):

```env
OPENAI_API_KEY=your_actual_key
OPENAI_MODEL=gpt-4.1-mini
```

Start the application from this folder:

```bash
uvicorn app:app --reload
```

Open http://127.0.0.1:8000. Backend status is displayed in the header and Settings.

## API

- `GET /api/health`
- `POST /api/solve` with JSON such as:

```json
{"domain":"auto","task":"Explain what information is needed to assess a small building drainage concept."}
```

## What is implemented

- Domain-specific animated 3D frontend scenes.
- FastAPI endpoint connected to the OpenAI Responses API.
- Auto-routing and explicit domain selection.
- Separate specialist prompt modules.
- Structured result fields rendered in the UI.
- Local saved analyses, copy and Markdown report export.
- Backend health indicator.

## Important limitations and safety

Specialists are prompt-based AI roles coordinated by one orchestrator, not independent certified engineering systems. This project does not provide verified CAD/BIM models, code compliance certification, or construction-ready designs. Outputs are educational and preliminary. A qualified professional must independently verify engineering decisions against project conditions and applicable local standards before real-world use.
