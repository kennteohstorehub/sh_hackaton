# StoreHub Queue Management System - Secure AWS Infrastructure
# Zero-Trust Multi-Tenant Architecture with Defense-in-Depth

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "storehubqms-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Environment   = var.environment
      Project       = "StoreHubQMS"
      ManagedBy     = "Terraform"
      SecurityLevel = "High"
      DataClass     = "CustomerPII"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ===== NETWORK INFRASTRUCTURE =====

# VPC with DNS support
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "storehubqms-vpc-${var.environment}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "storehubqms-igw-${var.environment}"
  }
}

# Public Subnets (for NAT Gateways and Load Balancers)
resource "aws_subnet" "public" {
  count = 3
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "storehubqms-public-${count.index + 1}-${var.environment}"
    Type = "Public"
  }
}

# Private Subnets (for application workloads)
resource "aws_subnet" "private_app" {
  count = 3
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "storehubqms-private-app-${count.index + 1}-${var.environment}"
    Type = "Private-App"
    Tier = "Application"
  }
}

# Database Subnets (for RDS instances)
resource "aws_subnet" "private_db" {
  count = 3
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 20}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  
  tags = {
    Name = "storehubqms-private-db-${count.index + 1}-${var.environment}"
    Type = "Private-DB"
    Tier = "Database"
  }
}

# NAT Gateways for outbound internet access from private subnets
resource "aws_eip" "nat" {
  count = 3
  
  domain = "vpc"
  
  tags = {
    Name = "storehubqms-nat-eip-${count.index + 1}-${var.environment}"
  }
  
  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count = 3
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = {
    Name = "storehubqms-nat-${count.index + 1}-${var.environment}"
  }
  
  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "storehubqms-public-rt-${var.environment}"
  }
}

resource "aws_route_table" "private_app" {
  count = 3
  
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }
  
  tags = {
    Name = "storehubqms-private-app-rt-${count.index + 1}-${var.environment}"
  }
}

resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "storehubqms-private-db-rt-${var.environment}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = 3
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_app" {
  count = 3
  
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

resource "aws_route_table_association" "private_db" {
  count = 3
  
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db.id
}

# ===== SECURITY GROUPS =====

# Application Load Balancer Security Group
resource "aws_security_group" "alb" {
  name_prefix = "storehubqms-alb-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTP redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    description = "All outbound traffic to EKS nodes"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  tags = {
    Name = "storehubqms-alb-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# EKS Cluster Security Group
resource "aws_security_group" "eks_cluster" {
  name_prefix = "storehubqms-eks-cluster-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description = "HTTPS API server"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }
  
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "storehubqms-eks-cluster-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# EKS Node Group Security Group
resource "aws_security_group" "eks_nodes" {
  name_prefix = "storehubqms-eks-nodes-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description = "Node to node"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }
  
  ingress {
    description = "Pod to pod"
    from_port   = 1025
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }
  
  ingress {
    description = "Control plane to nodes"
    from_port   = 1025
    to_port     = 65535
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }
  
  ingress {
    description     = "Load balancer to nodes"
    from_port       = 30000
    to_port         = 32767
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "storehubqms-eks-nodes-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name_prefix = "storehubqms-rds-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  ingress {
    description     = "PostgreSQL from bastion"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }
  
  tags = {
    Name = "storehubqms-rds-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Bastion Host Security Group
resource "aws_security_group" "bastion" {
  name_prefix = "storehubqms-bastion-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description = "SSH from admin IPs"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_access_ips
  }
  
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "storehubqms-bastion-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name_prefix = "storehubqms-redis-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  tags = {
    Name = "storehubqms-redis-sg-${var.environment}"
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# ===== NETWORK ACLS FOR ADDITIONAL SECURITY =====

# Private App Subnet NACL
resource "aws_network_acl" "private_app" {
  vpc_id = aws_vpc.main.id
  
  # Allow inbound HTTPS from ALB
  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.0.1.0/24"
    from_port  = 3000
    to_port    = 3000
  }
  
  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = "10.0.2.0/24"
    from_port  = 3000
    to_port    = 3000
  }
  
  ingress {
    protocol   = "tcp"
    rule_no    = 120
    action     = "allow"
    cidr_block = "10.0.3.0/24"
    from_port  = 3000
    to_port    = 3000
  }
  
  # Allow ephemeral ports for return traffic
  ingress {
    protocol   = "tcp"
    rule_no    = 200
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
  
  # Allow outbound to database
  egress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.0.20.0/22"
    from_port  = 5432
    to_port    = 5432
  }
  
  # Allow outbound to Redis
  egress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 6379
    to_port    = 6379
  }
  
  # Allow outbound HTTPS for API calls
  egress {
    protocol   = "tcp"
    rule_no    = 200
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }
  
  # Allow outbound HTTP for health checks
  egress {
    protocol   = "tcp"
    rule_no    = 210
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }
  
  tags = {
    Name = "storehubqms-private-app-nacl-${var.environment}"
  }
}

# Associate NACL with private app subnets
resource "aws_network_acl_association" "private_app" {
  count = 3
  
  network_acl_id = aws_network_acl.private_app.id
  subnet_id      = aws_subnet.private_app[count.index].id
}

# Database NACL
resource "aws_network_acl" "private_db" {
  vpc_id = aws_vpc.main.id
  
  # Allow inbound PostgreSQL from app subnets
  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.0.10.0/22"
    from_port  = 5432
    to_port    = 5432
  }
  
  # Allow ephemeral ports for return traffic
  ingress {
    protocol   = "tcp"
    rule_no    = 200
    action     = "allow"
    cidr_block = "10.0.10.0/22"
    from_port  = 1024
    to_port    = 65535
  }
  
  # Allow outbound responses
  egress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "10.0.10.0/22"
    from_port  = 1024
    to_port    = 65535
  }
  
  tags = {
    Name = "storehubqms-private-db-nacl-${var.environment}"
  }
}

# Associate NACL with database subnets
resource "aws_network_acl_association" "private_db" {
  count = 3
  
  network_acl_id = aws_network_acl.private_db.id
  subnet_id      = aws_subnet.private_db[count.index].id
}

# ===== OUTPUTS =====

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_app_subnet_ids" {
  description = "IDs of the private application subnets"
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "IDs of the private database subnets"
  value       = aws_subnet.private_db[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "security_group_ids" {
  description = "Security group IDs"
  value = {
    alb         = aws_security_group.alb.id
    eks_cluster = aws_security_group.eks_cluster.id
    eks_nodes   = aws_security_group.eks_nodes.id
    rds         = aws_security_group.rds.id
    bastion     = aws_security_group.bastion.id
    redis       = aws_security_group.redis.id
  }
}

# Additional variables for admin access
variable "admin_access_ips" {
  description = "IP addresses allowed for admin access"
  type        = list(string)
  default     = []
}