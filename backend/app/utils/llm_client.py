"""
LLM客户端封装
统一使用 OpenAI 格式 API；支持多提供商切换（openai / azure_openai）。
"""

import json
import re
from typing import Optional, Dict, Any, List
from openai import OpenAI

from ..config import Config
from .logger import get_logger

logger = get_logger("mirofish.llm_client")


def _azure_openai_base_url() -> Optional[str]:
    if Config.AZURE_OPENAI_BASE_URL:
        return Config.AZURE_OPENAI_BASE_URL.rstrip("/")
    if Config.AZURE_OPENAI_ENDPOINT:
        return f"{Config.AZURE_OPENAI_ENDPOINT}/openai/v1"
    return None


class LLMClient:
    """LLM 客户端（支持 OpenAI 与 Azure OpenAI，由 LLM_PROVIDER=openai|azure_openai 切换）"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.provider = Config.LLM_PROVIDER

        if self.provider == 'azure_openai':
            self.api_key = api_key or Config.AZURE_OPENAI_API_KEY
            self.base_url = base_url or _azure_openai_base_url()
            self.model = model or Config.AZURE_OPENAI_DEPLOYMENT
            if not self.api_key:
                raise ValueError("AZURE_OPENAI_API_KEY 未配置")
            if not self.base_url:
                raise ValueError("Azure OpenAI 需设置 AZURE_OPENAI_BASE_URL 或 AZURE_OPENAI_ENDPOINT")
        else:
            self.api_key = api_key or Config.LLM_API_KEY
            self.base_url = base_url or Config.LLM_BASE_URL
            self.model = model or Config.LLM_MODEL_NAME
            if not self.api_key:
                raise ValueError("LLM_API_KEY 未配置")

        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
        _url = self.base_url or ""
        logger.info(
            "LLMClient 初始化: provider=%s, base_url=%s, model=%s",
            self.provider,
            _url[:60] + "..." if len(_url) > 60 else _url,
            self.model,
        )

    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        response_format: Optional[Dict] = None
    ) -> str:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大token数
            response_format: 响应格式（如JSON模式）
            
        Returns:
            模型响应文本
        """
        kwargs: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        # Azure OpenAI (e.g. gpt-5.2) uses max_completion_tokens; others use max_tokens
        if self.provider == 'azure_openai':
            kwargs["max_completion_tokens"] = max_tokens
        else:
            kwargs["max_tokens"] = max_tokens

        if response_format:
            kwargs["response_format"] = response_format

        logger.debug("LLM chat 请求: model=%s, messages=%s, max_tokens=%s", self.model, len(messages), max_tokens)
        try:
            response = self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            # 部分模型（如MiniMax M2.5）会在content中包含<think>思考内容，需要移除
            content = re.sub(r'<think>[\s\S]*?</think>', '', content).strip()
            logger.info("LLM chat 成功: model=%s, response_len=%s", self.model, len(content or ""))
            return content
        except Exception as e:
            logger.exception("LLM chat 失败: model=%s, base_url=%s, error=%s", self.model, self.base_url, e)
            raise
    
    def chat_json(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 4096
    ) -> Dict[str, Any]:
        """
        发送聊天请求并返回JSON
        
        Args:
            messages: 消息列表
            temperature: 温度参数
            max_tokens: 最大token数
            
        Returns:
            解析后的JSON对象
        """
        response = self.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        # 清理markdown代码块标记
        cleaned_response = response.strip()
        cleaned_response = re.sub(r'^```(?:json)?\s*\n?', '', cleaned_response, flags=re.IGNORECASE)
        cleaned_response = re.sub(r'\n?```\s*$', '', cleaned_response)
        cleaned_response = cleaned_response.strip()

        try:
            return json.loads(cleaned_response)
        except json.JSONDecodeError:
            raise ValueError(f"LLM返回的JSON格式无效: {cleaned_response}")

