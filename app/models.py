from pydantic import BaseModel

class LoginRequest(BaseModel):
    telegram_id: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str
