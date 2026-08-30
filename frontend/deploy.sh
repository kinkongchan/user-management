#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$FRONTEND_DIR/.." && pwd)"
TF_DIR="$ROOT/terraform"

REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
BUCKET="$(terraform -chdir="$TF_DIR" output -raw frontend_bucket)"
FRONTEND_URL="$(terraform -chdir="$TF_DIR" output -raw frontend_cloudfront_url)"
DIST_ID="$(terraform -chdir="$TF_DIR" output -raw frontend_cloudfront_distribution_id)"
API_URL="$(terraform -chdir="$TF_DIR" output -raw api_gateway_url)"
USER_POOL_ID="$(terraform -chdir="$TF_DIR" output -raw cognito_user_pool_id)"
CLIENT_ID="$(terraform -chdir="$TF_DIR" output -raw cognito_app_client_id)"

cd "$FRONTEND_DIR"
npm install
VITE_API_URL="$API_URL" \
  VITE_COGNITO_USER_POOL_ID="$USER_POOL_ID" \
  VITE_COGNITO_CLIENT_ID="$CLIENT_ID" \
  npm run build

aws s3 sync "$FRONTEND_DIR/dist/" "s3://${BUCKET}/" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo "Frontend deployed: ${FRONTEND_URL}"
