data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "fastapi" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    region               = data.aws_region.current.name
    db_secret_arn        = aws_secretsmanager_secret.db.arn
    cognito_user_pool_id = aws_cognito_user_pool.this.id
    cognito_client_id    = aws_cognito_user_pool_client.web.id
    cors_origins         = join(",", local.frontend_cors_origins)
  })

  user_data_replace_on_change = true

  metadata_options {
    http_tokens = "required"
  }

  tags = {
    Name = "${var.project_name}-fastapi"
  }

  depends_on = [
    aws_nat_gateway.this,
    aws_secretsmanager_secret_version.db,
  ]
}

resource "aws_lb_target_group_attachment" "fastapi" {
  target_group_arn = aws_lb_target_group.fastapi.arn
  target_id        = aws_instance.fastapi.id
  port             = 8000
}
