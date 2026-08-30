resource "aws_s3_bucket" "codedeploy" {
  bucket        = "${var.project_name}-codedeploy-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-codedeploy"
  }
}

resource "aws_s3_bucket_public_access_block" "codedeploy" {
  bucket = aws_s3_bucket.codedeploy.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "codedeploy_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codedeploy" {
  name               = "${var.project_name}-codedeploy"
  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume.json
}

resource "aws_iam_role_policy_attachment" "codedeploy" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

resource "aws_codedeploy_app" "fastapi" {
  compute_platform = "Server"
  name             = "${var.project_name}-fastapi"
}

resource "aws_codedeploy_deployment_group" "fastapi" {
  app_name               = aws_codedeploy_app.fastapi.name
  deployment_group_name  = "fastapi"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  ec2_tag_filter {
    key   = "Name"
    type  = "KEY_AND_VALUE"
    value = "${var.project_name}-fastapi"
  }

  deployment_style {
    deployment_option = "WITHOUT_TRAFFIC_CONTROL"
    deployment_type   = "IN_PLACE"
  }
}
