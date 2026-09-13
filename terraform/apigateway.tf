resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = local.frontend_cors_origins
    allow_methods     = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers     = ["Authorization", "Content-Type"]
    allow_credentials = true
    max_age           = 3600
  }
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.this.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

resource "aws_apigatewayv2_integration" "alb" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "HTTP_PROXY"
  integration_uri        = "http://${aws_lb.this.dns_name}/{proxy}"
  integration_method     = "ANY"
  payload_format_version = "1.0"
  timeout_milliseconds   = 29000

  request_parameters = {
    "overwrite:header.x-cognito-sub" = "$context.authorizer.jwt.claims.sub"
  }
}

resource "aws_apigatewayv2_integration" "alb_root" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "HTTP_PROXY"
  integration_uri        = "http://${aws_lb.this.dns_name}/"
  integration_method     = "ANY"
  payload_format_version = "1.0"
  timeout_milliseconds   = 29000

  request_parameters = {
    "overwrite:header.x-cognito-sub" = "$context.authorizer.jwt.claims.sub"
  }
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_route" "post_proxy" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "POST /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_route" "delete_proxy" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "DELETE /{proxy+}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.alb.id}"
}

resource "aws_apigatewayv2_route" "root" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "GET /"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.alb_root.id}"
}

resource "aws_apigatewayv2_route" "options_proxy" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "OPTIONS /{proxy+}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "options_root" {
  api_id             = aws_apigatewayv2_api.this.id
  route_key          = "OPTIONS /"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}
