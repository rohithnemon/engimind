
import os
import logging
from agents.prompts import get_system_prompt
from google import genai
from google.genai import types

from agents.prompts import get_system_prompt

logger = logging.getLogger("engimind.orchestrator")


def run_orchestrator(task, domain, client=None, model=None):

    # Load Gemini API key
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing from the .env file."
        )

    # Initialize Gemini client
    gemini = client or genai.Client(api_key=api_key)

    # Select model
    model = model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # Get domain-specific engineering instructions
    system = get_system_prompt(domain)

    logger.info(
        "Running Gemini specialist | Domain: %s | Model: %s",
        domain,
        model
    )

    # Generate engineering analysis
    response = gemini.models.generate_content(
        model=model,
        contents=task,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.2
        )
    )

    answer = response.text

    if not answer:
        raise RuntimeError(
            "Gemini returned an empty response."
        )

    # Frontend-compatible response
    return {
        "specialist": domain,
        "agent": "EngiMind Gemini Engineering Assistant",
        "domain": domain,

        "specialist_analysis": answer,

        "assumptions": [],

        "missing_inputs": [],

        "validation_checklist": [
            "Verify all input values and units.",
            "Independently check equations and calculations.",
            "Check applicable engineering standards.",
            "Obtain qualified professional review before real-world implementation."
        ]
    }

