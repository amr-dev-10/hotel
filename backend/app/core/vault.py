from sqlalchemy.orm import Session

from app.core.encryption import decrypt_secret, encrypt_secret
from app.models.ops import HotelSecret
from app.repositories.ops_repository import HotelSecretRepository


class Vault:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.secrets = HotelSecretRepository(db)

    def store(
        self,
        hotel_id: str,
        secret_type: str,
        plaintext: str | None,
        commit: bool = False,
    ) -> HotelSecret | None:
        if not plaintext:
            return None
        secret = self.secrets.get_by_type(hotel_id, secret_type)
        encrypted_value = encrypt_secret(plaintext) or plaintext
        if not secret:
            secret = HotelSecret(
                hotel_id=hotel_id,
                secret_type=secret_type,
                encrypted_value=encrypted_value,
            )
            self.db.add(secret)
        else:
            secret.encrypted_value = encrypted_value
        if commit:
            self.db.commit()
            self.db.refresh(secret)
        return secret

    def retrieve(self, hotel_id: str, secret_type: str) -> str | None:
        secret = self.secrets.get_by_type(hotel_id, secret_type)
        if not secret:
            return None
        return decrypt_secret(secret.encrypted_value)
