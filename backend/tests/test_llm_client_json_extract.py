from app.utils.llm_client import LLMClient


def test_extract_json_payload_from_markdown_fence():
    raw = """```json
    {"a": 1, "b": [2,3]}
    ```"""

    payload = LLMClient._extract_json_payload(raw)

    assert payload == '{"a": 1, "b": [2,3]}'


def test_extract_json_payload_with_prefixed_reasoning_text():
    raw = """分析如下：
<think>先思考</think>
最终答案：
{"entity_types": [], "edge_types": []}
"""

    payload = LLMClient._extract_json_payload(raw)

    assert payload == '{"entity_types": [], "edge_types": []}'
