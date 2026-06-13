from app.core.config import settings


class GeminiClassifier:
    def __init__(self, api_key: str | None = None, model_name: str | None = None) -> None:
        self.api_key = api_key or settings.gemini_api_key
        self.model_name = model_name or settings.gemini_model

    async def classify(self, text: str) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)
        response = await model.generate_content_async(
            f"Classify this hotel guest request into a concise department key: {text}"
        )
        return response.text.strip()
