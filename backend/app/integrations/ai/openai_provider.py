from typing import Any

from app.integrations.ai.local_provider import LocalProvider


class OpenAIProvider(LocalProvider):
    provider_name = "openai"
    provider_label = "OpenAI"
    base_url: str | None = None

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        super().__init__(api_key=api_key, model=model or "gpt-4o-mini")

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
            raise RuntimeError(f"{self.provider_label} API key is not configured")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai package is not installed") from exc

        client_kwargs: dict[str, Any] = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        client = OpenAI(**client_kwargs)
        kwargs: dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format == "json_object":
            kwargs["response_format"] = {"type": "json_object"}
        response = client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        usage = response.usage
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0
        return {
            "content": choice.message.content or "",
            "model": response.model or kwargs["model"],
            "provider": self.provider_name,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": usage.total_tokens if usage else prompt_tokens + completion_tokens,
            "finish_reason": choice.finish_reason or "stop",
        }

    def embed(self, text: str) -> list[float]:
        if not self.api_key:
            raise RuntimeError("OpenAI API key is not configured")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai package is not installed") from exc

        client = OpenAI(api_key=self.api_key)
        response = client.embeddings.create(model="text-embedding-3-small", input=text)
        return list(response.data[0].embedding)
