from app.integrations.ai.local_provider import LocalProvider
from app.integrations.ai.openai_provider import OpenAIProvider


class GroqProvider(OpenAIProvider):
    provider_name = "groq"
    provider_label = "Groq"
    base_url = "https://api.groq.com/openai/v1"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        LocalProvider.__init__(
            self,
            api_key=api_key,
            model=model or "llama-3.3-70b-versatile",
        )

    def embed(self, text: str) -> list[float]:
        raise RuntimeError("Groq embeddings are not supported by this adapter")
