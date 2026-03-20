# Claude Code Proxy

Serveur proxy OpenAI-compatible qui route les requêtes LLM vers la CLI Claude Code.
Permet d'utiliser Claude dans MiroFish via le plan Max (sans clé API Anthropic).

## Prérequis

1. **Claude Code CLI** installé et authentifié :
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login  # S'authentifier avec un compte Max
   ```

2. **Python 3.11+** avec Flask :
   ```bash
   pip install flask
   ```

## Démarrage rapide

```bash
# Lancer le proxy
./run.sh

# Ou directement
python server.py
```

Le proxy écoute sur `http://localhost:8082`.

## Utilisation avec MiroFish

1. Lancez le proxy (voir ci-dessus)

2. Configurez `.env` à la racine du projet :
   ```env
   LLM_BASE_URL=http://localhost:8082/v1
   LLM_API_KEY=not-needed
   LLM_MODEL_NAME=claude-sonnet-4-6
   ```

3. Lancez MiroFish :
   ```bash
   # Tout en un (proxy + backend + frontend)
   npm run dev:claude

   # Ou séparément
   npm run proxy     # Proxy seul
   npm run dev       # Backend + frontend
   ```

## Configuration

| Variable | Défaut | Description |
|----------|--------|-------------|
| `CLAUDE_PROXY_PORT` | `8082` | Port du serveur proxy |
| `CLAUDE_PROXY_MODEL` | `sonnet` | Modèle Claude par défaut |
| `CLAUDE_PROXY_TIMEOUT` | `120` | Timeout CLI en secondes |
| `CLAUDE_PROXY_MAX_WORKERS` | `4` | Requêtes concurrentes max |
| `CLAUDE_PROXY_LOG_LEVEL` | `INFO` | Niveau de log |

## Mapping des modèles

Le proxy traduit automatiquement les noms de modèles OpenAI :

| Modèle demandé | Modèle Claude utilisé |
|-----------------|----------------------|
| `gpt-4o`, `gpt-4o-mini` | `sonnet` |
| `gpt-4`, `gpt-4-turbo` | `opus` |
| `gpt-3.5-turbo` | `haiku` |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` |
| `claude-opus-4-6` | `claude-opus-4-6` |

## Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/v1/chat/completions` | Chat completions (format OpenAI) |
| GET | `/v1/models` | Liste des modèles disponibles |
| GET | `/health` | Health check |
| GET | `/` | Info du service |

## Limitations

- **Pas de temperature/max_tokens** : la CLI Claude ne supporte pas ces paramètres
- **Latence** : ~1-2s supplémentaires par requête (lancement subprocess)
- **Streaming** : simulé (réponse complète envoyée en un chunk SSE)
- **JSON mode** : géré via prompt engineering (pas de garantie native)
- **Concurrence** : limitée par le plan Max et le pool de workers
