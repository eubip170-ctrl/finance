"""
Serveur proxy OpenAI-compatible pour Claude Code CLI.

Expose une API REST compatible avec le SDK OpenAI Python,
et route les requêtes vers la CLI `claude` (Claude Code).
Permet d'utiliser Claude via le plan Max sans API Anthropic.

Usage:
    python server.py
    # ou
    CLAUDE_PROXY_PORT=8082 python server.py
"""

import json
import logging
import os
import time
import traceback
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, Response, jsonify, request

from claude_runner import chat_completion, get_executor, resolve_model

app = Flask(__name__)

# Configuration
PORT = int(os.environ.get("CLAUDE_PROXY_PORT", "8082"))
LOG_LEVEL = os.environ.get("CLAUDE_PROXY_LOG_LEVEL", "INFO")

# Logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("claude-proxy")

# Modèles disponibles
AVAILABLE_MODELS = [
    {"id": "claude-opus-4-6", "object": "model", "owned_by": "anthropic"},
    {"id": "claude-sonnet-4-6", "object": "model", "owned_by": "anthropic"},
    {"id": "claude-haiku-4-5-20251001", "object": "model", "owned_by": "anthropic"},
    {"id": "sonnet", "object": "model", "owned_by": "anthropic"},
    {"id": "opus", "object": "model", "owned_by": "anthropic"},
    {"id": "haiku", "object": "model", "owned_by": "anthropic"},
]


@app.route("/v1/models", methods=["GET"])
def list_models():
    """Liste les modèles disponibles (format OpenAI)."""
    return jsonify({"object": "list", "data": AVAILABLE_MODELS})


@app.route("/v1/models/<model_id>", methods=["GET"])
def get_model(model_id):
    """Récupère un modèle spécifique."""
    for model in AVAILABLE_MODELS:
        if model["id"] == model_id:
            return jsonify(model)
    return jsonify({"error": {"message": f"Model '{model_id}' not found"}}), 404


@app.route("/v1/chat/completions", methods=["POST"])
def chat_completions():
    """
    Endpoint principal — compatible avec l'API OpenAI chat completions.

    Accepte le même format JSON que l'API OpenAI :
    {
        "model": "claude-sonnet-4-6",
        "messages": [{"role": "user", "content": "Hello"}],
        "temperature": 0.7,       // ignoré (non supporté par la CLI)
        "max_tokens": 1024,        // ignoré (non supporté par la CLI)
        "response_format": {"type": "json_object"}  // supporté via prompt engineering
    }
    """
    try:
        body = request.get_json()
        if not body:
            return jsonify({"error": {"message": "Request body is required"}}), 400

        messages = body.get("messages")
        if not messages:
            return jsonify({"error": {"message": "'messages' field is required"}}), 400

        model = body.get("model")
        response_format = body.get("response_format", {})
        json_mode = response_format.get("type") == "json_object"
        stream = body.get("stream", False)

        # Log les paramètres ignorés
        ignored = []
        if "temperature" in body:
            ignored.append(f"temperature={body['temperature']}")
        if "max_tokens" in body:
            ignored.append(f"max_tokens={body['max_tokens']}")
        if "top_p" in body:
            ignored.append(f"top_p={body['top_p']}")
        if ignored:
            logger.debug(f"Paramètres ignorés (non supportés par CLI): {', '.join(ignored)}")

        if stream:
            # Streaming non supporté dans cette version
            # Retourner une réponse complète simulée en SSE
            return _handle_stream(messages, model, json_mode)

        start = time.time()
        result = chat_completion(messages=messages, model=model, json_mode=json_mode)
        elapsed = time.time() - start

        logger.info(
            f"Requête traitée: model={result['model']}, "
            f"tokens={result['usage']['total_tokens']}, "
            f"time={elapsed:.1f}s"
        )

        return jsonify(result)

    except RuntimeError as e:
        logger.error(f"Runtime error: {e}")
        return jsonify({"error": {"message": str(e), "type": "server_error"}}), 502
    except Exception as e:
        logger.error(f"Unexpected error: {traceback.format_exc()}")
        return jsonify({"error": {"message": str(e), "type": "server_error"}}), 500


def _handle_stream(messages, model, json_mode):
    """
    Simule un stream SSE. La CLI ne supporte pas le vrai streaming,
    donc on génère la réponse complète puis l'envoie en un seul chunk.
    """

    def generate():
        try:
            result = chat_completion(messages=messages, model=model, json_mode=json_mode)
            content = result["choices"][0]["message"]["content"]

            # Envoyer le contenu en un seul delta
            chunk = {
                "id": result["id"],
                "object": "chat.completion.chunk",
                "model": result["model"],
                "choices": [
                    {
                        "index": 0,
                        "delta": {"role": "assistant", "content": content},
                        "finish_reason": None,
                    }
                ],
            }
            yield f"data: {json.dumps(chunk)}\n\n"

            # Envoyer le signal de fin
            end_chunk = {
                "id": result["id"],
                "object": "chat.completion.chunk",
                "model": result["model"],
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(end_chunk)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            error_chunk = {"error": {"message": str(e), "type": "server_error"}}
            yield f"data: {json.dumps(error_chunk)}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "claude-proxy"})


@app.route("/", methods=["GET"])
def index():
    """Info page."""
    return jsonify(
        {
            "service": "Claude Code Proxy",
            "description": "OpenAI-compatible proxy for Claude Code CLI (Max plan)",
            "endpoints": {
                "POST /v1/chat/completions": "Chat completions (OpenAI format)",
                "GET /v1/models": "List available models",
                "GET /health": "Health check",
            },
            "config": {
                "port": PORT,
                "default_model": os.environ.get("CLAUDE_PROXY_MODEL", "sonnet"),
                "timeout": os.environ.get("CLAUDE_PROXY_TIMEOUT", "120"),
                "max_workers": os.environ.get("CLAUDE_PROXY_MAX_WORKERS", "4"),
            },
        }
    )


if __name__ == "__main__":
    logger.info(f"Claude Code Proxy starting on port {PORT}")
    logger.info("Endpoints:")
    logger.info(f"  POST http://localhost:{PORT}/v1/chat/completions")
    logger.info(f"  GET  http://localhost:{PORT}/v1/models")
    logger.info(f"  GET  http://localhost:{PORT}/health")
    app.run(host="0.0.0.0", port=PORT, debug=False)
