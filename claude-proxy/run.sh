#!/bin/bash
# Lance le serveur proxy Claude Code
# Prérequis: Claude Code CLI installé et authentifié (plan Max)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Vérifier que claude est disponible
if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI non trouvé."
    echo "   Installez-le avec: npm install -g @anthropic-ai/claude-code"
    echo "   Puis authentifiez-vous avec: claude login"
    exit 1
fi

# Installer les dépendances si nécessaire
if ! python -c "import flask" 2>/dev/null; then
    echo "📦 Installation des dépendances..."
    pip install -r requirements.txt
fi

echo "🚀 Démarrage du proxy Claude Code sur le port ${CLAUDE_PROXY_PORT:-8082}..."
python server.py
