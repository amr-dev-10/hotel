class ElevenLabsClient:
    def synthesize_speech(self, text: str, voice_id: str | None = None) -> dict:
        return {"dry_run": True, "text": text, "voice_id": voice_id, "audio_url": None}
