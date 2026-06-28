from typing import Any

from app.integrations.ai.local_provider import LocalProvider


class AnthropicProvider(LocalProvider):
    provider_name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        super().__init__(
            api_key=api_key,
            model=model or "claude-3-5-sonnet-latest",
        )

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        messages = [{"role": "user", "content": prompt}]
        return self.chat(messages, temperature=temperature, max_tokens=max_tokens, model=self.model)["content"]

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("Anthropic API key is not configured")
        try:
            from anthropic import Anthropic
        except ImportError as exc:
            raise RuntimeError("anthropic package is not installed") from exc

        system_parts = [message["content"] for message in messages if message.get("role") == "system"]
        chat_messages = [
            {"role": message.get("role", "user"), "content": message.get("content", "")}
            for message in messages
            if message.get("role") != "system"
        ]
        client = Anthropic(api_key=self.api_key)
        response = client.messages.create(
            model=model or self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            system="\n\n".join(system_parts) if system_parts else None,
            messages=chat_messages,
        )
        content = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        usage = response.usage
        prompt_tokens = usage.input_tokens if usage else 0
        completion_tokens = usage.output_tokens if usage else 0
        return {
            "content": content,
            "model": response.model,
            "provider": self.provider_name,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "finish_reason": response.stop_reason or "stop",
        }

    def embed(self, text: str) -> list[float]:
        raise RuntimeError("Anthropic embeddings are not supported by this adapter")
