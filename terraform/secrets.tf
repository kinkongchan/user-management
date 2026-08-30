resource "random_password" "rds" {
  length           = 24
  special          = true
  override_special = "!#$%^&*()-_=+"
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "${var.project_name}/database"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-db-secret"
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.rds.result
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
    url      = "postgresql+psycopg://${var.db_username}:${urlencode(random_password.rds.result)}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"
  })
}
