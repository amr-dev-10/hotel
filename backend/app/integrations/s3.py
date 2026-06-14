class ObjectStorageClient:
    def presigned_upload_url(self, key: str, content_type: str) -> dict:
        return {
            "dry_run": True,
            "key": key,
            "content_type": content_type,
            "upload_url": f"memory://uploads/{key}",
        }
