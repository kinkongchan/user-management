resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-pg"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-pg-subnets"
  }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.project_name}-pg"
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t4g.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.rds.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 0
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  tags = {
    Name = "${var.project_name}-pg"
  }
}
