from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.config import get_settings
from app.database import Base, engine, get_db
from app.models import UserLogin, utc_now
from app.schemas import HealthResponse, HelloResponse, LoginListResponse, LoginRecord

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
