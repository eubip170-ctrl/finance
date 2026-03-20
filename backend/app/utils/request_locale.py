"""
从请求中获取用户选择的语言（用于 LLM 输出语言）
支持 X-Locale 请求头或 JSON body 中的 locale 参数
"""
from flask import request


def get_request_locale(default: str = 'zh') -> str:
    """
    从当前请求中获取语言偏好。
    
    - X-Locale: en 或 zh
    - 或 request.get_json().get('locale')
    - 或 request.form.get('locale')
    
    Returns:
        'en' 或 'zh'
    """
    locale = request.headers.get('X-Locale', '').strip().lower()
    if not locale and request.is_json:
        data = request.get_json(silent=True) or {}
        locale = (data.get('locale') or data.get('language') or '').strip().lower()
    if not locale:
        locale = (request.form.get('locale') or request.form.get('language') or '').strip().lower()
    
    if locale in ('en', 'zh'):
        return locale
    return default
