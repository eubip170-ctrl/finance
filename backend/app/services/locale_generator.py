"""
Locale generator service.
Uses LLM to translate the English base locale into any target language.
Generated locale files are cached to disk.
"""

import json
import re
from pathlib import Path

from ..utils.llm_client import LLMClient
from ..utils.logger import get_logger

logger = get_logger(__name__)

I18N_DIR = Path(__file__).parent.parent / "i18n"
BASE_LOCALE = "en"


def _load_base() -> dict:
    path = I18N_DIR / f"{BASE_LOCALE}.json"
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_locale(lang: str) -> dict:
    """
    Return locale dict for given language tag (e.g. 'hu', 'ja', 'fr').
    Loads from cache if available, otherwise generates via LLM and caches.
    """
    # Normalize: 'hu-HU' -> 'hu'
    lang = lang.split("-")[0].lower()

    # Validate: only standard BCP 47 primary language subtags (2-3 alpha chars)
    if not re.match(r'^[a-z]{2,3}$', lang):
        raise ValueError(f"Invalid language code: {lang!r}")

    if lang == BASE_LOCALE:
        return _load_base()

    cache_path = I18N_DIR / f"{lang}.json"
    if cache_path.exists():
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    logger.info(f"Generating locale for '{lang}' via LLM...")
    locale = _generate(lang)

    # Ensure directory exists before writing
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(locale, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Locale '{lang}' cached to {cache_path}")

    return locale


def _generate(lang: str) -> dict:
    base = _load_base()
    client = LLMClient()

    prompt = f"""You are a professional UI translator. Translate the following JSON locale file from English to the language with BCP 47 tag "{lang}".

Rules:
- Keep all JSON keys exactly as-is (do not translate keys)
- Translate only the string values
- Preserve placeholders like {{variable_name}} unchanged
- Keep technical terms like "MiroFish", "GraphRAG", "ReportAgent", "Agent" as-is
- Return only valid JSON, no markdown, no explanation
- CRITICAL: Never put unescaped double-quote characters (") inside a string value. If you need quotation marks in the translation, use single quotes (') instead
- CRITICAL: If the source string contains \\\" (escaped double quote), replace it with a single quote (') in your translation

English source:
{json.dumps(base, ensure_ascii=False, indent=2)}"""

    # Use chat() directly (no response_format) because some free-tier models
    # (e.g. gemini-2.0-flash-exp:free) don't support JSON mode and truncate output.
    # Parse the response manually after stripping markdown fences.
    # 8192 tokens needed for large locale files (Hungarian and similar languages
    # produce longer strings than English).
    raw = client.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=8192
    )

    # Strip markdown code fences if present
    cleaned = raw.strip()
    cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\n?```\s*$', '', cleaned)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM返回的JSON格式无效: {cleaned[:200]}") from exc
