from typing import Any

from app.core.config import settings
from app.integrations.ai.local_provider import LocalProvider


class GeminiProvider(LocalProvider):
    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        super().__init__(api_key=api_key or settings.gemini_api_key, model=model or "gemini-2.0-flash")

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return self.chat(messages, temperature=temperature, max_tokens=max_tokens)["content"]

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Gemini API key is not configured")
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise RuntimeError("google-generativeai package is not installed") from exc

        genai.configure(api_key=self.api_key)
        generation_config: dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if response_format == "json_object":
            generation_config["response_mime_type"] = "application/json"
        model_name = model or self.model
        generative_model = genai.GenerativeModel(model_name)
        response = generative_model.generate_content(
            self._prompt_from_messages(messages),
            generation_config=generation_config,
        )
        content = getattr(response, "text", "") or ""
        prompt_tokens = self._estimate_tokens(self._prompt_from_messages(messages))
        completion_tokens = self._estimate_tokens(content)
        return {
            "content": content,
            "model": model_name,
            "provider": self.provider_name,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "finish_reason": "stop",
        }

    def _prompt_from_messages(self, messages: list[dict[str, str]]) -> str:
        return "\n\n".join(
            f"{message.get('role', 'user').upper()}: {message.get('content', '')}"
            for message in messages
        )
