# Incident Response Playbook
## StoreHub Queue Management System

**Document Version:** 1.0  
**Last Updated:** August 2025  
**Classification:** Confidential  
**Owner:** Security Operations Team  

---

## 1. Overview

This playbook provides detailed procedures for responding to security incidents in the StoreHub Queue Management System. It defines roles, responsibilities, and step-by-step response procedures to minimize impact and ensure rapid recovery.

### 1.1 Incident Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Data Breach** | Unauthorized access to sensitive data | Tenant data exposure, PII leak |
| **System Compromise** | Unauthorized system access | Malware, unauthorized logins |
| **Service Disruption** | Availability or performance issues | DDoS attacks, system failures |
| **Insider Threat** | Malicious or negligent insider activity | Privilege abuse, data theft |
| **Compliance Violation** | Regulatory or policy violations | GDPR breach, audit failures |

### 1.2 Severity Classification

```yaml
severity_levels:
  critical:
    definition: "Immediate threat to business operations or data"
    response_time: 15_minutes
    escalation: "CISO, CEO, Legal"
    examples:
      - Active data exfiltration
      - Complete system compromise
      - Ransomware attack
  
  high:
    definition: "Significant security impact with business disruption"
    response_time: 1_hour
    escalation: "Security Manager, Platform Lead"
    examples:
      - Tenant isolation bypass
      - Privilege escalation
      - Sensitive data exposure
  
  medium:
    definition: "Limited security impact, contained threat"
    response_time: 4_hours
    escalation: "Security Engineer, Development Team"
    examples:
      - Failed intrusion attempt
      - Policy violation
      - Suspicious activity
  
  low:
    definition: "Minimal impact, routine security event"
    response_time: 24_hours
    escalation: "Security Analyst"
    examples:
      - Security scan alerts
      - Minor configuration issues
      - False positive alerts
```

---

## 2. Incident Response Team

### 2.1 Core Team Structure

#### Incident Commander (IC)
- **Primary**: Security Manager
- **Backup**: Platform Lead
- **Responsibilities**:
  - Overall incident coordination
  - Stakeholder communication
  - Decision making authority
  - Resource allocation

#### Security Analyst
- **Primary**: Security Operations Team
- **Backup**: External SOC Partner
- **Responsibilities**:
  - Initial triage and assessment
  - Evidence collection
  - Threat analysis
  - Technical investigation

#### Platform Engineer
- **Primary**: DevOps Team Lead
- **Backup**: Senior Platform Engineer
- **Responsibilities**:
  - System containment and isolation
  - Infrastructure changes
  - Service restoration
  - Performance monitoring

#### Legal Counsel
- **Primary**: Legal Department
- **Backup**: External Legal Counsel
- **Responsibilities**:
  - Regulatory compliance
  - Legal implications assessment
  - Law enforcement coordination
  - Contract obligations

#### Communications Lead
- **Primary**: Marketing Manager
- **Backup**: Customer Success Manager
- **Responsibilities**:
  - Customer communication
  - Public relations
  - Internal notifications
  - Media coordination

### 2.2 Extended Team

#### Business Stakeholders
- Product Owner
- Customer Success Team
- Sales Leadership
- Finance Team

#### Technical Specialists
- Database Administrator
- Network Engineer
- Cloud Architect
- Third-party Security Consultant

---

## 3. Detection & Initial Response

### 3.1 Detection Sources

#### Automated Monitoring
```yaml
monitoring_sources:
  falco_security_alerts:
    - tenant_boundary_violations
    - privilege_escalation_attempts
    - suspicious_file_modifications
    - unauthorized_network_connections
  
  prometheus_alerts:
    - high_error_rates
    - abnormal_resource_usage
    - failed_authentication_spikes
    - unusual_database_activity
  
  aws_guardduty:
    - malicious_ip_communications
    - cryptocurrency_mining
    - reconnaissance_activity
    - data_exfiltration_attempts
  
  cloudtrail_events:
    - unauthorized_api_calls
    - suspicious_user_activity
    - configuration_changes
    - privilege_modifications
```

#### Manual Reports
- Customer reports of suspicious activity
- Employee security concerns
- Partner security notifications
- Vulnerability research findings

### 3.2 Alert Triage Process

#### Step 1: Initial Assessment (0-5 minutes)
```bash
# Alert validation checklist
1. Verify alert authenticity
2. Check for false positive indicators
3. Assess immediate threat level
4. Determine if incident response required
```

#### Step 2: Severity Classification (5-10 minutes)
```yaml
classification_criteria:
  data_impact:
    - type_of_data_affected
    - volume_of_data_compromised
    - number_of_tenants_impacted
  
  system_impact:
    - services_affected
    - availability_impact
    - performance_degradation
  
  business_impact:
    - customer_facing_issues
    - revenue_impact
    - regulatory_implications
```

#### Step 3: Incident Declaration (10-15 minutes)
- Document incident details in incident management system
- Assign unique incident ID
- Notify appropriate response team members
- Establish communication channels

---

## 4. Response Procedures by Incident Type

### 4.1 Data Breach Response

#### Immediate Actions (0-1 hour)
```bash
# 1. Contain the breach
kubectl scale deployment storehubqms-app --replicas=0 -n affected-tenant
aws rds modify-db-instance --db-instance-identifier primary --publicly-accessible false

# 2. Preserve evidence
kubectl get events --all-namespaces > incident-events.log
aws logs create-export-task --log-group-name /aws/rds/instance/primary/postgresql

# 3. Assess scope
psql -h $DB_HOST -U admin -d storehubqms -c "
SELECT tenant_id, COUNT(*) as affected_records 
FROM audit_log 
WHERE created_at >= '$INCIDENT_START_TIME'
GROUP BY tenant_id;"
```

#### Investigation Phase (1-4 hours)
1. **Data Mapping**
   - Identify all affected data types
   - Map data flows and dependencies
   - Assess data sensitivity levels
   - Document tenant impact

2. **Root Cause Analysis**
   - Review application logs
   - Analyze database query patterns
   - Check authentication records
   - Examine network traffic

3. **Impact Assessment**
   - Calculate number of affected customers
   - Determine regulatory notification requirements
   - Assess business continuity impact
   - Evaluate reputational risk

#### Notification Requirements
```yaml
notification_timeline:
  internal_teams:
    timeline: immediate
    recipients: [security_team, legal_team, executive_team]
  
  regulatory_authorities:
    timeline: 72_hours  # GDPR requirement
    recipients: [data_protection_authority]
    
  affected_customers:
    timeline: 72_hours
    method: email_and_dashboard_notification
    
  public_disclosure:
    timeline: as_required_by_law
    method: website_and_press_release
```

### 4.2 System Compromise Response

#### Immediate Containment
```bash
# 1. Isolate affected systems
kubectl cordon node-compromised-1
kubectl drain node-compromised-1 --ignore-daemonsets

# 2. Network isolation
aws ec2 authorize-security-group-ingress \
  --group-id sg-quarantine \
  --protocol tcp \
  --port 22 \
  --source-group sg-forensics

# 3. Preserve forensic evidence
kubectl exec -it compromised-pod -- dd if=/dev/sda of=/forensic/disk-image.dd
```

#### Investigation Steps
1. **Memory Dump Analysis**
   ```bash
   # Capture memory dump
   kubectl exec -it pod -- gcore -o /tmp/memory.dump $(pidof node)
   
   # Analyze with volatility
   volatility -f memory.dump --profile=LinuxUbuntu1804x64 linux_pslist
   ```

2. **Network Traffic Analysis**
   ```bash
   # Capture network traffic
   kubectl exec -it pod -- tcpdump -w /tmp/network.pcap
   
   # Analyze with wireshark
   wireshark network.pcap
   ```

3. **File System Forensics**
   ```bash
   # Check for indicators of compromise
   find /app -type f -newer /tmp/incident-start-time
   grep -r "suspicious-pattern" /app/logs/
   ```

### 4.3 Service Disruption Response

#### DDoS Attack Response
```bash
# 1. Activate DDoS protection
aws shield activate-emergency-contact

# 2. Implement rate limiting
kubectl apply -f emergency-rate-limits.yaml

# 3. Scale infrastructure
kubectl scale deployment storehubqms-app --replicas=20
aws autoscaling set-desired-capacity --auto-scaling-group-name prod-asg --desired-capacity 10
```

#### Performance Degradation Response
```bash
# 1. Check system metrics
kubectl top pods --sort-by=cpu
kubectl top nodes --sort-by=memory

# 2. Analyze database performance
psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
psql -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# 3. Review application logs
kubectl logs deployment/storehubqms-app --tail=1000 | grep -i error
```

---

## 5. Communication Procedures

### 5.1 Internal Communication

#### War Room Setup
```yaml
communication_channels:
  slack:
    channel: "#incident-response"
    purpose: "Real-time coordination"
    participants: "Core response team"
  
  zoom:
    room: "Incident Response Bridge"
    purpose: "Voice coordination"
    availability: "24/7 during incident"
  
  confluence:
    page: "Incident Timeline"
    purpose: "Documentation and updates"
    access: "All stakeholders"
```

#### Status Update Template
```markdown
## Incident Status Update #X

**Incident ID**: INC-2025-XXXX
**Severity**: [Critical/High/Medium/Low]
**Status**: [Investigating/Contained/Resolved]
**Last Updated**: [Timestamp]

### Summary
Brief description of the incident and current status.

### Impact
- Affected services: [List]
- Customer impact: [Description]
- Duration: [Time since incident start]

### Actions Taken
- [Action 1 with timestamp]
- [Action 2 with timestamp]

### Next Steps
- [Planned action 1]
- [Planned action 2]

### Next Update
Next update scheduled for: [Timestamp]
```

### 5.2 External Communication

#### Customer Communication Template
```markdown
Subject: Service Incident Notification - [Date]

Dear [Customer Name],

We are writing to inform you of a security incident that may have affected your account.

**What Happened:**
[Brief, non-technical description of the incident]

**What Information Was Involved:**
[Specific data types that were potentially accessed]

**What We Are Doing:**
[Actions taken to address the incident and prevent recurrence]

**What You Can Do:**
[Specific recommendations for customers]

**Contact Information:**
For questions, please contact our security team at security@storehubqms.com

We sincerely apologize for this incident and any inconvenience it may cause.

StoreHub Security Team
```

#### Regulatory Notification Template
```markdown
GDPR Article 33 - Data Breach Notification

**Data Controller:** StoreHub Technologies Sdn Bhd
**Date of Notification:** [Date]
**Reference:** [Incident ID]

**Nature of Breach:**
[Technical description of the breach]

**Categories of Data Subjects:**
[Description of affected individuals]

**Approximate Number Affected:**
[Number or range]

**Likely Consequences:**
[Assessment of potential harm]

**Measures Taken:**
[Technical and organizational measures]

**Contact Information:**
Data Protection Officer: dpo@storehub.com
```

---

## 6. Recovery & Post-Incident Activities

### 6.1 System Recovery

#### Recovery Checklist
```yaml
recovery_steps:
  infrastructure:
    - rebuild_compromised_systems
    - update_security_patches
    - verify_system_integrity
    - restore_from_clean_backups
  
  application:
    - redeploy_from_known_good_state
    - update_application_security
    - verify_data_integrity
    - test_functionality
  
  security:
    - rotate_all_credentials
    - update_security_rules
    - implement_additional_controls
    - verify_monitoring_systems
```

#### Recovery Validation
```bash
# 1. System integrity checks
kubectl exec -it pod -- aide --check
kubectl exec -it pod -- rkhunter --check

# 2. Security validation
nmap -sS -O target-system
nikto -h https://app.storehubqms.com

# 3. Functional testing
curl -f https://app.storehubqms.com/health
kubectl run test-pod --image=curlimages/curl --rm -i --restart=Never -- \
  curl -f http://storehubqms-service:3000/api/test
```

### 6.2 Post-Incident Review

#### Timeline Documentation
```markdown
## Incident Timeline

**Incident ID**: INC-2025-XXXX
**Duration**: [Start] - [End]
**Impact**: [Description]

### Timeline of Events

| Time | Event | Actor | Action |
|------|-------|-------|--------|
| T+0 | Detection | Monitoring | Alert triggered |
| T+5 | Triage | Security Analyst | Incident classified |
| T+15 | Response | Incident Commander | Team assembled |
| ... | ... | ... | ... |
```

#### Root Cause Analysis
```yaml
root_cause_analysis:
  primary_cause:
    category: "Technical/Process/Human"
    description: "Detailed explanation"
    evidence: "Supporting evidence"
  
  contributing_factors:
    - factor_1: "Description"
    - factor_2: "Description"
  
  timeline_analysis:
    - event_sequence: "Chronological breakdown"
    - decision_points: "Critical decisions made"
    - missed_opportunities: "Prevention opportunities"
```

#### Lessons Learned
```yaml
lessons_learned:
  what_went_well:
    - detection_speed: "Alert triggered within X minutes"
    - team_response: "Rapid assembly of response team"
    - communication: "Clear stakeholder updates"
  
  areas_for_improvement:
    - documentation: "Missing playbook procedures"
    - tooling: "Limited forensic capabilities"
    - training: "Team knowledge gaps"
  
  action_items:
    - short_term: "Immediate fixes (0-30 days)"
    - medium_term: "Process improvements (30-90 days)"
    - long_term: "Strategic enhancements (90+ days)"
```

---

## 7. Training & Exercises

### 7.1 Team Training

#### Required Training
```yaml
training_requirements:
  security_team:
    - incident_response_fundamentals: "Annual"
    - forensics_techniques: "Bi-annual"
    - threat_hunting: "Quarterly"
    - communication_skills: "Annual"
  
  engineering_team:
    - security_awareness: "Annual"
    - incident_procedures: "Bi-annual"
    - containment_techniques: "Quarterly"
  
  leadership_team:
    - crisis_management: "Annual"
    - legal_requirements: "Annual"
    - media_relations: "As needed"
```

### 7.2 Tabletop Exercises

#### Exercise Scenarios
1. **Scenario 1: Data Breach**
   - Simulated tenant data exposure
   - Multiple regulatory jurisdictions
   - Media attention

2. **Scenario 2: Ransomware Attack**
   - Complete system encryption
   - Ransom demands
   - Business continuity decisions

3. **Scenario 3: Insider Threat**
   - Privileged user abuse
   - Data exfiltration
   - HR involvement

4. **Scenario 4: Supply Chain Compromise**
   - Third-party dependency compromise
   - Widespread impact
   - Vendor coordination

#### Exercise Schedule
```yaml
exercise_schedule:
  tabletop_exercises:
    frequency: "Quarterly"
    duration: "2-3 hours"
    participants: "Core response team"
  
  functional_exercises:
    frequency: "Bi-annually"
    duration: "4-6 hours"
    participants: "Extended team"
  
  full_scale_exercises:
    frequency: "Annually"
    duration: "8-12 hours"
    participants: "All stakeholders"
```

---

## 8. Appendices

### Appendix A: Contact Information

#### Emergency Contacts
```yaml
24x7_contacts:
  incident_commander:
    primary: "+60-12-XXX-XXXX"
    backup: "+60-12-XXX-XXXY"
  
  security_team:
    escalation: "security-oncall@storehub.com"
    pagerduty: "security-team"
  
  legal_counsel:
    primary: "+60-3-XXX-XXXX"
    email: "legal@storehub.com"
  
  external_partners:
    security_vendor: "+1-XXX-XXX-XXXX"
    legal_firm: "+60-3-XXX-XXXY"
    pr_agency: "+60-3-XXX-XXXZ"
```

### Appendix B: Technical Runbooks

#### Container Isolation
```bash
#!/bin/bash
# Isolate compromised container
NAMESPACE=$1
POD_NAME=$2

# Apply network policy to block traffic
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-${POD_NAME}
  namespace: ${NAMESPACE}
spec:
  podSelector:
    matchLabels:
      app: ${POD_NAME}
  policyTypes:
  - Ingress
  - Egress
EOF
```

#### Database Isolation
```sql
-- Immediately revoke all permissions for affected tenant
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM tenant_user_123;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM tenant_user_123;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM tenant_user_123;

-- Log all subsequent access attempts
CREATE OR REPLACE FUNCTION log_access_attempt() 
RETURNS event_trigger AS $$
BEGIN
  INSERT INTO security_audit_log (event_type, user_name, timestamp)
  VALUES ('unauthorized_access_attempt', current_user, now());
END;
$$ LANGUAGE plpgsql;
```

### Appendix C: Legal Requirements

#### Data Breach Notification Laws
```yaml
jurisdictions:
  malaysia:
    law: "Personal Data Protection Act 2010"
    notification_timeline: "As soon as practicable"
    authority: "Department of Personal Data Protection"
  
  eu:
    law: "General Data Protection Regulation"
    notification_timeline: "72 hours"
    authority: "Relevant supervisory authority"
  
  singapore:
    law: "Personal Data Protection Act 2012"
    notification_timeline: "As soon as practicable"
    authority: "Personal Data Protection Commission"
```

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-08-03 | Security Team | Initial version |

**Next Review Date:** 2025-11-03

**Approval**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Manager | | | |
| Legal Counsel | | | |
| Platform Lead | | | |