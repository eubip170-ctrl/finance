"""
Locale API endpoint.
GET /api/locale/<lang>  — returns locale JSON for given language tag.
"""

from flask import jsonify

from . import locale_bp
from ..services.locale_generator import get_locale
from ..utils.logger import get_logger

logger = get_logger(__name__)


@locale_bp.route("/<lang>", methods=["GET"])
def get_locale_route(lang: str):
    try:
        data = get_locale(lang)
        return jsonify({"success": True, "data": data})
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        logger.error(f"Failed to get locale '{lang}': {e}")
        return jsonify({"success": False, "error": str(e)}), 500
