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


class MediaUploadRequest(BaseModel):
    file_name: str
    content_type: str
    file_size: int


class MediaPartUrl(BaseModel):
    part_number: int
    url: str


class MediaUploadResponse(BaseModel):
    id: int
    upload_id: str
    parts: list[MediaPartUrl]


class MediaCompletePart(BaseModel):
    part_number: int
    etag: str


class MediaCompleteRequest(BaseModel):
    parts: list[MediaCompletePart]


class MediaRecord(BaseModel):
    id: int
    timestamp: datetime
    file_name: str
    file_size: int
    url: str


class MediaListResponse(BaseModel):
    media: list[MediaRecord]
