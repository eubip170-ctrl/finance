"""
Internationalization utilities for MiroFish backend.

Reads the user's language preference from the Accept-Language header
and provides language-specific prompt instructions for LLM calls.
"""

from flask import request


def get_locale() -> str:
    """Get the user's locale from the request Accept-Language header."""
    try:
        locale = request.headers.get('Accept-Language', 'zh-CN')
    except RuntimeError:
        # Outside of request context (e.g., background tasks)
        locale = 'zh-CN'
    return locale


def is_english(locale: str = None) -> bool:
    """Check if the user's locale is English."""
    if locale is None:
        locale = get_locale()
    return locale.startswith('en')


def get_language_instruction(locale: str = None) -> str:
    """
    Get the language instruction to append to LLM prompts.
    Returns a string instructing the LLM which language to use.
    """
    if is_english(locale):
        return "Use English for all output."
    return "使用中文。"


def get_language_name(locale: str = None) -> str:
    """Get the full language name for use in prompts."""
    if is_english(locale):
        return "English"
    return "中文"


# Bilingual prompt fragments for common instructions
PROMPT_FRAGMENTS = {
    'zh-CN': {
        'use_language': '使用中文',
        'except_gender': '除了gender字段必须用英文male/female',
        'country_example': '如"中国"',
        'no_none': '无',
        'no_context': '无额外上下文',
    },
    'en': {
        'use_language': 'Use English',
        'except_gender': 'gender field must be in English: "male" or "female"',
        'country_example': 'e.g. "United States"',
        'no_none': 'None',
        'no_context': 'No additional context',
    }
}


def get_fragments(locale: str = None) -> dict:
    """Get language-specific prompt fragments."""
    if locale is None:
        locale = get_locale()
    key = 'en' if locale.startswith('en') else 'zh-CN'
    return PROMPT_FRAGMENTS[key]
