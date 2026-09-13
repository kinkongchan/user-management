from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from app.config import Settings, get_settings


class CognitoJWTVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._jwks_client: PyJWKClient | None = None

    @property
    def jwks_client(self) -> PyJWKClient:
        if self._jwks_client is None:
            if not self.settings.cognito_user_pool_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Cognito is not configured",
                )
            self._jwks_client = PyJWKClient(self.settings.cognito_jwks_url)
        return self._jwks_client

    def verify(self, token: str) -> str:
        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.settings.cognito_client_id,
                issuer=self.settings.cognito_issuer,
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from exc

        if payload.get("token_use") not in (None, "id"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Expected a Cognito ID token",
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is missing sub",
            )
        return str(user_id)


@lru_cache
def get_verifier() -> CognitoJWTVerifier:
    return CognitoJWTVerifier(get_settings())


def get_current_user_id(
    request: Request,
    settings: Settings = Depends(get_settings),
    verifier: CognitoJWTVerifier = Depends(get_verifier),
) -> str:
    """Resolve the Cognito user id.

    In AWS, API Gateway verifies the JWT and forwards the claim as X-Cognito-Sub.
    Locally, the same ID token is verified against Cognito JWKS.
    """
    gateway_sub = request.headers.get("x-cognito-sub")
    if gateway_sub:
        return gateway_sub

    authorization = request.headers.get("authorization") or ""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    if not settings.cognito_user_pool_id or not settings.cognito_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID to verify tokens locally",
        )

    return verifier.verify(token)
