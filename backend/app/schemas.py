from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HelloResponse(BaseModel):
    message: str
    user_id: str


class LoginRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    login_time: datetime


class LoginListResponse(BaseModel):
    logins: list[LoginRecord]


class HealthResponse(BaseModel):
    status: str
