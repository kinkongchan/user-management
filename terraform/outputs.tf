output "api_gateway_url" {
  description = "HTTPS URL of the HTTP API (use this as VITE_API_URL in AWS mode)"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito user pool id (VITE_COGNITO_USER_POOL_ID / COGNITO_USER_POOL_ID)"
  value       = aws_cognito_user_pool.this.id
}

output "cognito_app_client_id" {
  description = "Cognito app client id (VITE_COGNITO_CLIENT_ID / COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_issuer" {
  description = "Cognito JWT issuer URL"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "alb_dns_name" {
  description = "ALB DNS name (HTTP, used by API Gateway)"
  value       = aws_lb.this.dns_name
}

output "ec2_instance_id" {
  description = "FastAPI EC2 instance id"
  value       = aws_instance.fastapi.id
}

output "codedeploy_app" {
  description = "CodeDeploy application name"
  value       = aws_codedeploy_app.fastapi.name
}

output "codedeploy_deployment_group" {
  description = "CodeDeploy deployment group name"
  value       = aws_codedeploy_deployment_group.fastapi.deployment_group_name
}

output "codedeploy_bucket" {
  description = "S3 bucket CodeDeploy reads revisions from"
  value       = aws_s3_bucket.codedeploy.bucket
}

output "frontend_bucket" {
  description = "S3 bucket that hosts the React static site"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_url" {
  description = "Public S3 website URL for the React app (HTTP)"
  value       = local.frontend_website_url
}

output "frontend_cloudfront_url" {
  description = "HTTPS CloudFront URL for the React app (*.cloudfront.net)"
  value       = local.frontend_cloudfront_url
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront distribution id (used to invalidate cache after deploy)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "media_bucket" {
  description = "Private S3 bucket for image and video uploads"
  value       = aws_s3_bucket.media.bucket
}

output "rds_endpoint" {
  description = "RDS Postgres hostname"
  value       = aws_db_instance.this.address
}

output "rds_port" {
  description = "RDS Postgres port"
  value       = aws_db_instance.this.port
}

output "aws_region" {
  description = "Region used by this stack"
  value       = data.aws_region.current.name
}
