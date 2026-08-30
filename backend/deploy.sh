#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
TF_DIR="$ROOT/terraform"
BUILD_DIR="$BACKEND_DIR/.build"
ZIP="$BUILD_DIR/backend.zip"

REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
BUCKET="$(terraform -chdir="$TF_DIR" output -raw codedeploy_bucket)"
APP="$(terraform -chdir="$TF_DIR" output -raw codedeploy_app)"
GROUP="$(terraform -chdir="$TF_DIR" output -raw codedeploy_deployment_group)"
KEY="revisions/backend-$(date +%Y%m%d%H%M%S).zip"

mkdir -p "$BUILD_DIR"
rm -f "$ZIP"

STAGE="$BUILD_DIR/src"
rm -rf "$STAGE"
mkdir -p "$STAGE"
rsync -a \
  --exclude '.venv' \
  --exclude 'venv' \
  --exclude '.env' \
  --exclude '.build' \
  --exclude '__pycache__' \
  --exclude '.gitignore' \
  --exclude 'deploy.sh' \
  "$BACKEND_DIR/" "$STAGE/"

chmod +x "$STAGE"/codedeploy/*.sh
(cd "$STAGE" && zip -qr "$ZIP" .)
rm -rf "$STAGE"

aws s3 cp "$ZIP" "s3://${BUCKET}/${KEY}" --region "$REGION"

DEPLOYMENT_ID="$(aws deploy create-deployment \
  --region "$REGION" \
  --application-name "$APP" \
  --deployment-group-name "$GROUP" \
  --revision "revisionType=S3,s3Location={bucket=${BUCKET},key=${KEY},bundleType=zip}" \
  --file-exists-behavior OVERWRITE \
  --query deploymentId \
  --output text)"

echo "Created deployment $DEPLOYMENT_ID"
aws deploy wait deployment-successful --region "$REGION" --deployment-id "$DEPLOYMENT_ID"
echo "Deployment succeeded"
