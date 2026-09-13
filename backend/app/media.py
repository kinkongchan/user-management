from __future__ import annotations

import math
import uuid
from pathlib import Path
from typing import Union

import boto3
from botocore.config import Config
from fastapi import HTTPException, status

from app.config import Settings

PART_SIZE = 500 * 1024 * 1024
PRESIGN_EXPIRES = 3600


def file_type_from_content_type(content_type: str) -> str:
    lowered = content_type.lower()
    if lowered.startswith("image/"):
        return "image"
    if lowered.startswith("video/"):
        return "video"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only image/* and video/* uploads are allowed",
    )


def part_count(file_size: int) -> int:
    if file_size < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_size must be at least 1 byte",
        )
    return max(1, math.ceil(file_size / PART_SIZE))


def object_key(user_id: str, file_name: str) -> str:
    safe_name = Path(file_name).name.replace(" ", "_") or "upload"
    return f"{user_id}/{uuid.uuid4().hex}_{safe_name}"


def s3_client(settings: Settings):
    if not settings.media_bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MEDIA_BUCKET is not configured",
        )
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"},
        ),
        endpoint_url="https://s3.{}.amazonaws.com".format(settings.aws_region),
    )


def start_multipart(
    settings: Settings,
    *,
    user_id: str,
    file_name: str,
    content_type: str,
    file_size: int,
) -> tuple[str, str, str, list[dict[str, Union[str, int]]]]:
    kind = file_type_from_content_type(content_type)
    key = object_key(user_id, file_name)
    client = s3_client(settings)
    created = client.create_multipart_upload(
        Bucket=settings.media_bucket,
        Key=key,
        ContentType=content_type,
    )
    upload_id = created["UploadId"]
    parts: list[dict[str, Union[str, int]]] = []
    for number in range(1, part_count(file_size) + 1):
        url = client.generate_presigned_url(
            ClientMethod="upload_part",
            Params={
                "Bucket": settings.media_bucket,
                "Key": key,
                "UploadId": upload_id,
                "PartNumber": number,
            },
            ExpiresIn=PRESIGN_EXPIRES,
            HttpMethod="PUT",
        )
        parts.append({"part_number": number, "url": url})
    return kind, key, upload_id, parts


def presigned_get_url(settings: Settings, key: str, file_name: str) -> str:
    safe_name = Path(file_name).name.replace('"', "") or "media"
    client = s3_client(settings)
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": settings.media_bucket,
            "Key": key,
            "ResponseContentDisposition": 'inline; filename="{}"'.format(safe_name),
        },
        ExpiresIn=PRESIGN_EXPIRES,
        HttpMethod="GET",
    )


def delete_object(settings: Settings, key: str) -> None:
    client = s3_client(settings)
    client.delete_object(Bucket=settings.media_bucket, Key=key)


def complete_multipart(
    settings: Settings,
    *,
    key: str,
    upload_id: str,
    parts: list[dict[str, Union[str, int]]],
) -> None:
    client = s3_client(settings)
    client.complete_multipart_upload(
        Bucket=settings.media_bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={
            "Parts": [
                {
                    "ETag": '"{}"'.format(str(part["etag"]).strip().strip('"')),
                    "PartNumber": int(part["part_number"]),
                }
                for part in sorted(parts, key=lambda item: int(item["part_number"]))
            ]
        },
    )
