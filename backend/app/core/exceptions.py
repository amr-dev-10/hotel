from fastapi import HTTPException, status


class DomainError(Exception):
    def __init__(self, message: str, code: str = "domain_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


def not_found(message: str = "Resource not found") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def forbidden(message: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
