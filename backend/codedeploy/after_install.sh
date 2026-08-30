#!/bin/bash
set -euo pipefail

APP_DIR=/opt/user-management
REGION="$(awk -F= '/^COGNITO_REGION=/{print $2}' /etc/fastapi.env)"
SECRET_ARN="$(cat /etc/fastapi.secret-arn)"

python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

DATABASE_URL="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text | jq -r .url)"

grep -q '^DATABASE_URL=' /etc/fastapi.env && sed -i '/^DATABASE_URL=/d' /etc/fastapi.env
printf 'DATABASE_URL=%s\n' "$DATABASE_URL" >> /etc/fastapi.env
