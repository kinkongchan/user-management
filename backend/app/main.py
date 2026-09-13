from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.config import get_settings
from app.database import Base, engine, get_db
from app.media import complete_multipart, delete_object, presigned_get_url, start_multipart
from app.models import Media, UserLogin, utc_now
from app.schemas import (
    HealthResponse,
    HelloResponse,
    LoginListResponse,
    LoginRecord,
    MediaCompleteRequest,
    MediaListResponse,
    MediaRecord,
    MediaUploadRequest,
    MediaUploadResponse,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="user-management", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/hello", response_model=HelloResponse)
def hello(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> HelloResponse:
    db.add(UserLogin(user_id=user_id, login_time=utc_now()))
    db.commit()
    return HelloResponse(message=f"hello {user_id}", user_id=user_id)


@app.get("/logins", response_model=LoginListResponse)
def list_logins(
    _user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> LoginListResponse:
    rows = db.scalars(select(UserLogin).order_by(UserLogin.login_time.desc())).all()
    return LoginListResponse(
        logins=[LoginRecord.model_validate(row) for row in rows]
    )


@app.post("/media/uploads", response_model=MediaUploadResponse)
def create_media_upload(
    body: MediaUploadRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> MediaUploadResponse:
    kind, key, upload_id, parts = start_multipart(
        settings,
        user_id=user_id,
        file_name=body.file_name,
        content_type=body.content_type,
        file_size=body.file_size,
    )
    row = Media(
        presign_urls=[part["url"] for part in parts],
        file_type=kind,
        file_name=body.file_name,
        file_size=body.file_size,
        user_id=user_id,
        s3_key=key,
        upload_id=upload_id,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return MediaUploadResponse(id=row.id, upload_id=upload_id, parts=parts)


@app.post("/media/uploads/{media_id}/complete")
def complete_media_upload(
    media_id: int,
    body: MediaCompleteRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    row = db.get(Media, media_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Upload not found")
    if row.status == "complete":
        return {"status": "complete"}
    complete_multipart(
        settings,
        key=row.s3_key,
        upload_id=row.upload_id,
        parts=[part.model_dump() for part in body.parts],
    )
    row.status = "complete"
    db.commit()
    return {"status": "complete"}


@app.get("/media", response_model=MediaListResponse)
def list_media(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> MediaListResponse:
    rows = db.scalars(
        select(Media)
        .where(Media.user_id == user_id, Media.status == "complete")
        .order_by(Media.timestamp.desc())
    ).all()
    return MediaListResponse(
        media=[
            MediaRecord(
                id=row.id,
                timestamp=row.timestamp,
                file_name=row.file_name,
                file_size=row.file_size,
                url=presigned_get_url(settings, row.s3_key, row.file_name),
            )
            for row in rows
        ]
    )


@app.delete("/media/{media_id}")
def delete_media(
    media_id: int,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    row = db.get(Media, media_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Upload not found")
    delete_object(settings, row.s3_key)
    db.delete(row)
    db.commit()
    return {"status": "deleted"}
