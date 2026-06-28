from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    provider_name = "unknown"

    @abstractmethod
    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        raise NotImplementedError

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        raise NotImplementedError

    @abstractmethod
    def classify(self, text: str, categories: list[dict[str, Any]]) -> dict[str, Any]:
        raise NotImplementedError
