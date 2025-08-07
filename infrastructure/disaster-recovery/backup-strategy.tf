# Disaster Recovery and Backup Strategy for StoreHub QMS
# Multi-region resilience with automated backup and failover

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary Region Variables
variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region for DR"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "rpo_hours" {
  description = "Recovery Point Objective in hours"
  type        = number
  default     = 1
}

variable "rto_minutes" {
  description = "Recovery Time Objective in minutes"
  type        = number
  default     = 30
}

# Provider for primary region
provider "aws" {
  alias  = "primary"
  region = var.primary_region
}

# Provider for secondary region
provider "aws" {
  alias  = "secondary"
  region = var.secondary_region
}

# ===== RDS BACKUP AND CROSS-REGION REPLICATION =====

# KMS Key for database encryption in primary region
resource "aws_kms_key" "db_encryption_primary" {
  provider = aws.primary
  
  description             = "KMS key for RDS encryption in primary region"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS Service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = {
    Name        = "storehubqms-db-encryption-primary"
    Environment = var.environment
    Purpose     = "RDS Encryption"
  }
}

resource "aws_kms_alias" "db_encryption_primary" {
  provider = aws.primary
  
  name          = "alias/storehubqms-db-primary"
  target_key_id = aws_kms_key.db_encryption_primary.key_id
}

# KMS Key for database encryption in secondary region
resource "aws_kms_key" "db_encryption_secondary" {
  provider = aws.secondary
  
  description             = "KMS key for RDS encryption in secondary region"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS Service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = {
    Name        = "storehubqms-db-encryption-secondary"
    Environment = var.environment
    Purpose     = "RDS Encryption"
  }
}

resource "aws_kms_alias" "db_encryption_secondary" {
  provider = aws.secondary
  
  name          = "alias/storehubqms-db-secondary"
  target_key_id = aws_kms_key.db_encryption_secondary.key_id
}

# DB Subnet Group for primary region
resource "aws_db_subnet_group" "primary" {
  provider = aws.primary
  
  name       = "storehubqms-db-subnet-group-primary"
  subnet_ids = var.private_db_subnet_ids_primary
  
  tags = {
    Name        = "storehubqms-db-subnet-group-primary"
    Environment = var.environment
  }
}

# DB Subnet Group for secondary region
resource "aws_db_subnet_group" "secondary" {
  provider = aws.secondary
  
  name       = "storehubqms-db-subnet-group-secondary"
  subnet_ids = var.private_db_subnet_ids_secondary
  
  tags = {
    Name        = "storehubqms-db-subnet-group-secondary"
    Environment = var.environment
  }
}

# Primary RDS Instance with automated backups
resource "aws_db_instance" "primary" {
  provider = aws.primary
  
  identifier     = "storehubqms-primary"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.db_encryption_primary.arn
  
  db_name  = "storehubqms"
  username = "storehubqms_admin"
  password = var.db_password
  
  vpc_security_group_ids = [var.rds_security_group_id_primary]
  db_subnet_group_name   = aws_db_subnet_group.primary.name
  
  # Backup Configuration
  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"  # UTC
  maintenance_window     = "Mon:04:00-Mon:05:00"  # UTC
  
  # Performance Insights
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.db_encryption_primary.arn
  performance_insights_retention_period = 7
  
  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  # Security
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "storehubqms-primary-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  # Multi-AZ for high availability
  multi_az = true
  
  # Enable automated minor version upgrades
  auto_minor_version_upgrade = true
  
  tags = {
    Name        = "storehubqms-primary-db"
    Environment = var.environment
    Backup      = "enabled"
    DR          = "primary"
  }
}

# Read Replica in secondary region for disaster recovery
resource "aws_db_instance" "read_replica" {
  provider = aws.secondary
  
  identifier                = "storehubqms-read-replica"
  replicate_source_db       = aws_db_instance.primary.identifier
  instance_class           = "db.r6g.xlarge"
  
  # Different AZ for additional resilience
  multi_az = true
  
  # Enable automated backups for the replica
  backup_retention_period = var.backup_retention_days
  
  # Performance Insights
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.db_encryption_secondary.arn
  
  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring_secondary.arn
  
  tags = {
    Name        = "storehubqms-read-replica"
    Environment = var.environment
    DR          = "replica"
  }
}

# ===== S3 BACKUP STORAGE =====

# S3 Bucket for application backups in primary region
resource "aws_s3_bucket" "backup_primary" {
  provider = aws.primary
  
  bucket = "storehubqms-backups-primary-${random_string.bucket_suffix.result}"
  
  tags = {
    Name        = "storehubqms-backups-primary"
    Environment = var.environment
    Purpose     = "Application Backups"
  }
}

# S3 Bucket for cross-region replication
resource "aws_s3_bucket" "backup_secondary" {
  provider = aws.secondary
  
  bucket = "storehubqms-backups-secondary-${random_string.bucket_suffix.result}"
  
  tags = {
    Name        = "storehubqms-backups-secondary"
    Environment = var.environment
    Purpose     = "DR Backups"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 Bucket versioning
resource "aws_s3_bucket_versioning" "backup_primary" {
  provider = aws.primary
  
  bucket = aws_s3_bucket.backup_primary.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "backup_secondary" {
  provider = aws.secondary
  
  bucket = aws_s3_bucket.backup_secondary.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_primary" {
  provider = aws.primary
  
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_secondary" {
  provider = aws.secondary
  
  bucket = aws_s3_bucket.backup_secondary.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket lifecycle management
resource "aws_s3_bucket_lifecycle_configuration" "backup_primary" {
  provider = aws.primary
  
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    id     = "backup_lifecycle"
    status = "Enabled"
    
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
    
    expiration {
      days = 2555  # 7 years
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Cross-region replication configuration
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  provider = aws.primary
  
  role   = aws_iam_role.s3_replication.arn
  bucket = aws_s3_bucket.backup_primary.id
  
  rule {
    id     = "backup_replication"
    status = "Enabled"
    
    destination {
      bucket        = aws_s3_bucket.backup_secondary.arn
      storage_class = "STANDARD_IA"
    }
  }
  
  depends_on = [aws_s3_bucket_versioning.backup_primary]
}

# ===== IAM ROLES FOR BACKUP OPERATIONS =====

# RDS Enhanced Monitoring Role
resource "aws_iam_role" "rds_monitoring" {
  provider = aws.primary
  
  name = "storehubqms-rds-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  provider = aws.primary
  
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS Enhanced Monitoring Role for secondary region
resource "aws_iam_role" "rds_monitoring_secondary" {
  provider = aws.secondary
  
  name = "storehubqms-rds-monitoring-role-secondary"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring_secondary" {
  provider = aws.secondary
  
  role       = aws_iam_role.rds_monitoring_secondary.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# S3 Replication Role
resource "aws_iam_role" "s3_replication" {
  provider = aws.primary
  
  name = "storehubqms-s3-replication-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  provider = aws.primary
  
  name = "storehubqms-s3-replication-policy"
  role = aws_iam_role.s3_replication.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl"
        ]
        Resource = "${aws_s3_bucket.backup_primary.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.backup_primary.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete"
        ]
        Resource = "${aws_s3_bucket.backup_secondary.arn}/*"
      }
    ]
  })
}

# ===== LAMBDA FUNCTIONS FOR AUTOMATED BACKUP =====

# Lambda function for database backup validation
resource "aws_lambda_function" "backup_validator" {
  provider = aws.primary
  
  filename         = "backup_validator.zip"
  function_name    = "storehubqms-backup-validator"
  role            = aws_iam_role.lambda_backup.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300
  
  environment {
    variables = {
      PRIMARY_DB_IDENTIFIER = aws_db_instance.primary.identifier
      REPLICA_DB_IDENTIFIER = aws_db_instance.read_replica.identifier
      SNS_TOPIC_ARN        = aws_sns_topic.backup_alerts.arn
    }
  }
  
  tags = {
    Name        = "storehubqms-backup-validator"
    Environment = var.environment
  }
}

# Lambda IAM role
resource "aws_iam_role" "lambda_backup" {
  provider = aws.primary
  
  name = "storehubqms-lambda-backup-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_backup" {
  provider = aws.primary
  
  name = "storehubqms-lambda-backup-policy"
  role = aws_iam_role.lambda_backup.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBSnapshots",
          "rds:CreateDBSnapshot"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.backup_alerts.arn
      }
    ]
  })
}

# ===== CLOUDWATCH ALARMS AND SNS =====

# SNS Topic for backup alerts
resource "aws_sns_topic" "backup_alerts" {
  provider = aws.primary
  
  name = "storehubqms-backup-alerts"
  
  tags = {
    Name        = "storehubqms-backup-alerts"
    Environment = var.environment
  }
}

# CloudWatch Alarm for backup failures
resource "aws_cloudwatch_metric_alarm" "backup_failure" {
  provider = aws.primary
  
  alarm_name          = "storehubqms-backup-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors backup validation failures"
  alarm_actions       = [aws_sns_topic.backup_alerts.arn]
  
  dimensions = {
    FunctionName = aws_lambda_function.backup_validator.function_name
  }
  
  tags = {
    Name        = "storehubqms-backup-failure-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarm for RDS replica lag
resource "aws_cloudwatch_metric_alarm" "replica_lag" {
  provider = aws.secondary
  
  alarm_name          = "storehubqms-replica-lag"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ReplicaLag"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "300"  # 5 minutes
  alarm_description   = "This metric monitors read replica lag"
  alarm_actions       = [aws_sns_topic.backup_alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.read_replica.identifier
  }
  
  tags = {
    Name        = "storehubqms-replica-lag-alarm"
    Environment = var.environment
  }
}

# ===== BACKUP AUTOMATION WITH EVENTBRIDGE =====

# EventBridge rule for daily backup validation
resource "aws_cloudwatch_event_rule" "daily_backup_check" {
  provider = aws.primary
  
  name                = "storehubqms-daily-backup-check"
  description         = "Trigger daily backup validation"
  schedule_expression = "cron(0 6 * * ? *)"  # 6 AM UTC daily
  
  tags = {
    Name        = "storehubqms-daily-backup-check"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  provider = aws.primary
  
  rule      = aws_cloudwatch_event_rule.daily_backup_check.name
  target_id = "TriggerLambdaFunction"
  arn       = aws_lambda_function.backup_validator.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  provider = aws.primary
  
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backup_validator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_backup_check.arn
}

# ===== DATA SOURCES =====

data "aws_caller_identity" "current" {}

# ===== VARIABLES =====

variable "db_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
}

variable "private_db_subnet_ids_primary" {
  description = "Private database subnet IDs in primary region"
  type        = list(string)
}

variable "private_db_subnet_ids_secondary" {
  description = "Private database subnet IDs in secondary region"
  type        = list(string)
}

variable "rds_security_group_id_primary" {
  description = "RDS security group ID in primary region"
  type        = string
}

# ===== OUTPUTS =====

output "primary_db_endpoint" {
  description = "Primary database endpoint"
  value       = aws_db_instance.primary.endpoint
  sensitive   = true
}

output "replica_db_endpoint" {
  description = "Read replica database endpoint"
  value       = aws_db_instance.read_replica.endpoint
  sensitive   = true
}

output "backup_bucket_primary" {
  description = "Primary backup S3 bucket"
  value       = aws_s3_bucket.backup_primary.bucket
}

output "backup_bucket_secondary" {
  description = "Secondary backup S3 bucket"
  value       = aws_s3_bucket.backup_secondary.bucket
}

output "backup_alerts_topic" {
  description = "SNS topic for backup alerts"
  value       = aws_sns_topic.backup_alerts.arn
}