class DeepgramClient:
    def transcribe_audio(self, media_url: str) -> dict:
        return {"dry_run": True, "media_url": media_url, "transcript": ""}
