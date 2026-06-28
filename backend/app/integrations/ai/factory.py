from app.core.config import settings
from app.integrations.ai.anthropic_provider import AnthropicProvider
from app.integrations.ai.base import AIProvider
from app.integrations.ai.gemini_provider import GeminiProvider
from app.integrations.ai.groq_provider import GroqProvider
from app.integrations.ai.local_provider import LocalProvider
from app.integrations.ai.openai_provider import OpenAIProvider

PROVIDERS: dict[str, type[AIProvider]] = {
    "local": LocalProvider,
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "groq": GroqProvider,
}


def get_ai_provider(
    provider_name: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> AIProvider:
    name = provider_name or settings.default_ai_provider
    provider_cls = PROVIDERS.get(name)
    if provider_cls is None:
        supported = ", ".join(sorted(PROVIDERS))
        raise RuntimeError(f"Unsupported AI provider '{name}'. Supported providers: {supported}")
    return provider_cls(api_key=api_key, model=model)


class ResilientAIProvider(AIProvider):
    def __init__(self, providers: list[str] | None = None) -> None:
        provider_names = providers or [
            item.strip()
            for item in settings.ai_fallback_providers.split(",")
            if item.strip()
        ]
        self.chain = [get_ai_provider(name) for name in provider_names]

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        last_error: Exception | None = None
        for provider in self.chain:
            try:
                return provider.generate(prompt, system, temperature, max_tokens)
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"All AI providers failed: {last_error}")

    def embed(self, text: str) -> list[float]:
        last_error: Exception | None = None
        for provider in self.chain:
            try:
                return provider.embed(text)
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"All AI providers failed: {last_error}")

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: str | None = None,
        model: str | None = None,
    ) -> dict:
        last_error: Exception | None = None
        for provider in self.chain:
            try:
                return provider.chat(messages, temperature, max_tokens, response_format, model)
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"All AI providers failed: {last_error}")

    def classify(self, text: str, categories: list[dict]) -> dict:
        last_error: Exception | None = None
        for provider in self.chain:
            try:
                return provider.classify(text, categories)
            except Exception as exc:
                last_error = exc
        raise RuntimeError(f"All AI providers failed: {last_error}")
