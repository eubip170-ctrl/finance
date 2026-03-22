"""Locale-specific LLM prompt template loader."""

import os

_DIR = os.path.dirname(__file__)


def load_prompt(name: str, locale: str = 'en') -> str:
    """Load a prompt template file for the given locale.

    Returns the raw template string with {placeholder} markers.
    Callers must call .format() or .format_map() to substitute values.
    Falls back to English if the requested locale file is missing.
    """
    path = os.path.join(_DIR, locale, f'{name}.txt')
    if not os.path.exists(path):
        path = os.path.join(_DIR, 'en', f'{name}.txt')
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()
