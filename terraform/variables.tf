variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Name prefix for resources"
  type        = string
  default     = "user-management"
}

variable "frontend_origin" {
  description = "Allowed CORS origin for the React app"
  type        = string
  default     = "http://localhost:5173"
}

variable "instance_type" {
  description = "EC2 instance type for the single FastAPI server"
  type        = string
  default     = "t3.micro"
}

variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "usermgmt"
}

variable "db_username" {
  description = "Postgres master username"
  type        = string
  default     = "usermgmt"
}
