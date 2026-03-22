"""Backend i18n message catalog for API response messages."""

import json
import os
from flask import g

_MESSAGES = {}
_DIR = os.path.dirname(__file__)


def _load_messages():
    """Load message catalogs from JSON files (lazy, once)."""
    if _MESSAGES:
        return
    for locale in ('en', 'zh-CN'):
        path = os.path.join(_DIR, f'{locale}.json')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                _MESSAGES[locale] = json.load(f)


def msg(key: str, locale: str = None, **kwargs) -> str:
    """Get a localized message by key, with optional placeholder substitution.

    Falls back to English if key is missing in the requested locale.
    Falls back to the raw key if missing in all locales.
    """
    _load_messages()
    locale = locale or getattr(g, 'locale', 'en')
    messages = _MESSAGES.get(locale, _MESSAGES.get('en', {}))
    template = messages.get(key, _MESSAGES.get('en', {}).get(key, key))
    return template.format_map(kwargs) if kwargs else template
