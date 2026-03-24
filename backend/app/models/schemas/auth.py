from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400


class TokenPayload(BaseModel):
    sub: str
    org_id: str
    role: str
    vertical: str | None = None
    exp: int
