-- Confidence Systems OS - Initial Database Schema
-- Multi-tenant, audit-ready, event-sourced architecture

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS evidence;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS operations;
CREATE SCHEMA IF NOT EXISTS integration;

-- ============================================================================
-- AUTH SCHEMA - Identity & Governance
-- ============================================================================

-- Organizations (Multi-tenancy)
CREATE TABLE auth.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(512),
  tier VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, professional, enterprise
  max_users INTEGER DEFAULT 100,
  max_workflows INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_organizations_deleted_at ON auth.organizations(deleted_at);

-- Departments
CREATE TABLE auth.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  name VARCHAR(255) NOT NULL,
  parent_department_id UUID REFERENCES auth.departments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_departments_org_id ON auth.departments(organization_id);
CREATE INDEX idx_departments_parent_id ON auth.departments(parent_department_id);

-- Teams
CREATE TABLE auth.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  department_id UUID REFERENCES auth.departments(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_teams_org_id ON auth.teams(organization_id);
CREATE INDEX idx_teams_dept_id ON auth.teams(department_id);

-- Users
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  avatar_url VARCHAR(512),
  password_hash VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMP WITH TIME ZONE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_method VARCHAR(50), -- 'totp', 'sms', 'email'
  mfa_secret VARCHAR(255),
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_login_ip INET,
  last_login_user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_org_id ON auth.users(organization_id);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_deleted_at ON auth.users(deleted_at);

-- Roles
CREATE TABLE auth.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  role_type VARCHAR(50) NOT NULL DEFAULT 'custom', -- 'system', 'custom'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_roles_org_id ON auth.roles(organization_id);

-- Permissions
CREATE TABLE auth.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  resource VARCHAR(255) NOT NULL, -- 'workflow', 'evidence', 'compliance'
  action VARCHAR(255) NOT NULL, -- 'create', 'read', 'update', 'delete', 'execute'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, resource, action)
);

CREATE INDEX idx_permissions_org_id ON auth.permissions(organization_id);

-- Role-Permission Mapping
CREATE TABLE auth.role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES auth.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON auth.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON auth.role_permissions(permission_id);

-- User-Role Assignment
CREATE TABLE auth.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES auth.roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE, -- Temporary access grants
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON auth.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON auth.user_roles(role_id);

-- Resource-Level Permissions
CREATE TABLE auth.resource_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type VARCHAR(255) NOT NULL, -- 'workflow', 'team', 'department'
  resource_id UUID NOT NULL,
  permission_level VARCHAR(50) NOT NULL, -- 'view', 'edit', 'admin'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, resource_type, resource_id)
);

CREATE INDEX idx_resource_permissions_user_id ON auth.resource_permissions(user_id);
CREATE INDEX idx_resource_permissions_resource ON auth.resource_permissions(resource_type, resource_id);

-- Sessions
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  device_name VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON auth.sessions(expires_at);

-- Audit Logs
CREATE TABLE auth.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  actor_id UUID REFERENCES auth.users(id),
  actor_type VARCHAR(50) NOT NULL, -- 'user', 'system', 'api'
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(255),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id ON auth.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON auth.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON auth.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON auth.audit_logs(resource_type, resource_id);

-- ============================================================================
-- WORKFLOW SCHEMA - Orchestration & Execution
-- ============================================================================

-- Workflows (Master definitions)
CREATE TABLE workflow.workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, published, archived
  version_number INTEGER NOT NULL DEFAULT 1,
  definition JSONB NOT NULL, -- BPMN-inspired definition
  input_schema JSONB, -- JSON Schema for inputs
  output_schema JSONB, -- JSON Schema for outputs
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(organization_id, slug, version_number)
);

CREATE INDEX idx_workflows_org_id ON workflow.workflows(organization_id);
CREATE INDEX idx_workflows_status ON workflow.workflows(status);
CREATE INDEX idx_workflows_tags ON workflow.workflows USING GIN(tags);

-- Workflow Runs (Execution instances)
CREATE TABLE workflow.workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflow.workflows(id),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  parent_run_id UUID REFERENCES workflow.workflow_runs(id), -- For sub-workflows
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
  progress_percentage INTEGER DEFAULT 0,
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  error_stack TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_workflow_runs_workflow_id ON workflow.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_org_id ON workflow.workflow_runs(organization_id);
CREATE INDEX idx_workflow_runs_status ON workflow.workflow_runs(status);
CREATE INDEX idx_workflow_runs_initiated_by ON workflow.workflow_runs(initiated_by);
CREATE INDEX idx_workflow_runs_created_at ON workflow.workflow_runs(created_at DESC);

-- Tasks (Steps within a workflow)
CREATE TABLE workflow.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflow.workflows(id),
  task_type VARCHAR(50) NOT NULL, -- 'human', 'system', 'approval', 'verification', 'webhook'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position_index INTEGER NOT NULL,
  config JSONB NOT NULL, -- Task-specific configuration
  required_evidence JSONB DEFAULT '[]'::jsonb, -- Evidence types required
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_roles UUID[] DEFAULT ARRAY[]::UUID[],
  sla_hours INTEGER,
  retry_policy JSONB,
  timeout_hours INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_workflow_id ON workflow.tasks(workflow_id);

-- Task Instances (Execution of individual tasks)
CREATE TABLE workflow.task_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_run_id UUID NOT NULL REFERENCES workflow.workflow_runs(id),
  task_id UUID NOT NULL REFERENCES workflow.tasks(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, assigned, in_progress, completed, failed, skipped
  assigned_to UUID REFERENCES auth.users(id),
  input_data JSONB,
  output_data JSONB,
  evidence_ids UUID[] DEFAULT ARRAY[]::UUID[],
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_instances_workflow_run_id ON workflow.task_instances(workflow_run_id);
CREATE INDEX idx_task_instances_task_id ON workflow.task_instances(task_id);
CREATE INDEX idx_task_instances_status ON workflow.task_instances(status);
CREATE INDEX idx_task_instances_assigned_to ON workflow.task_instances(assigned_to);

-- Approvals
CREATE TABLE workflow.approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_instance_id UUID NOT NULL REFERENCES workflow.task_instances(id),
  workflow_run_id UUID NOT NULL REFERENCES workflow.workflow_runs(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, reassigned
  decision TEXT, -- Approval comment
  decided_at TIMESTAMP WITH TIME ZONE,
  decided_by UUID REFERENCES auth.users(id),
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalated_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_task_instance_id ON workflow.approvals(task_instance_id);
CREATE INDEX idx_approvals_assigned_to ON workflow.approvals(assigned_to);
CREATE INDEX idx_approvals_status ON workflow.approvals(status);

-- Checklists
CREATE TABLE workflow.checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_instance_id UUID NOT NULL REFERENCES workflow.task_instances(id),
  title VARCHAR(255) NOT NULL,
  items JSONB NOT NULL, -- Array of checklist items
  completed_items_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklists_task_instance_id ON workflow.checklists(task_instance_id);

-- ============================================================================
-- EVIDENCE SCHEMA - Audit & Proof
-- ============================================================================

-- Evidence (Proof of work completion)
CREATE TABLE evidence.evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  workflow_run_id UUID NOT NULL REFERENCES workflow.workflow_runs(id),
  task_instance_id UUID REFERENCES workflow.task_instances(id),
  captured_by UUID NOT NULL REFERENCES auth.users(id),
  evidence_type VARCHAR(50) NOT NULL, -- 'photo', 'video', 'document', 'signature', 'gps', 'sensor', 'audio'
  file_url VARCHAR(512),
  file_key VARCHAR(512), -- S3 key
  file_size BIGINT,
  mime_type VARCHAR(100),
  content_hash VARCHAR(255), -- SHA256 for integrity
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Location data
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_accuracy DECIMAL(5, 2),
  location_timestamp TIMESTAMP WITH TIME ZONE,
  -- Device data
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  device_os VARCHAR(50),
  device_ip INET,
  -- AI verification results
  ai_verification_status VARCHAR(50), -- pending, verified, flagged, needs_review
  ai_confidence_score DECIMAL(5, 4),
  ai_verification_metadata JSONB,
  ai_verified_at TIMESTAMP WITH TIME ZONE,
  ai_verified_by VARCHAR(50), -- 'ocr', 'vision', 'ml_model'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_org_id ON evidence.evidence(organization_id);
CREATE INDEX idx_evidence_workflow_run_id ON evidence.evidence(workflow_run_id);
CREATE INDEX idx_evidence_task_instance_id ON evidence.evidence(task_instance_id);
CREATE INDEX idx_evidence_captured_by ON evidence.evidence(captured_by);
CREATE INDEX idx_evidence_type ON evidence.evidence(evidence_type);
CREATE INDEX idx_evidence_ai_status ON evidence.evidence(ai_verification_status);
CREATE INDEX idx_evidence_created_at ON evidence.evidence(created_at DESC);
CREATE INDEX idx_evidence_location ON evidence.evidence USING GIST(ll_to_earth(latitude, longitude));

-- Evidence Packets (Bundled evidence for compliance)
CREATE TABLE evidence.evidence_packets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  workflow_run_id UUID NOT NULL REFERENCES workflow.workflow_runs(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  evidence_ids UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  packet_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_packets_org_id ON evidence.evidence_packets(organization_id);
CREATE INDEX idx_evidence_packets_workflow_run_id ON evidence.evidence_packets(workflow_run_id);

-- Audit Trail (Immutable event log)
CREATE TABLE evidence.replay_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  aggregate_id UUID NOT NULL, -- workflow_run_id or other entity id
  aggregate_type VARCHAR(50) NOT NULL, -- 'workflow_run', 'task_instance', 'evidence'
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  actor_type VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_replay_events_org_id ON evidence.replay_events(organization_id);
CREATE INDEX idx_replay_events_aggregate ON evidence.replay_events(aggregate_type, aggregate_id);
CREATE INDEX idx_replay_events_timestamp ON evidence.replay_events(timestamp DESC);
CREATE INDEX idx_replay_events_event_type ON evidence.replay_events(event_type);

-- ============================================================================
-- COMPLIANCE SCHEMA - Governance & Certifications
-- ============================================================================

-- Compliance Policies
CREATE TABLE compliance.policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  policy_type VARCHAR(50) NOT NULL, -- 'regulatory', 'internal', 'operational'
  framework VARCHAR(100), -- 'iso27001', 'hipaa', 'gdpr', 'sox', 'custom'
  rules JSONB NOT NULL, -- Array of policy rules
  applies_to JSONB DEFAULT '[]'::jsonb, -- Teams/departments this applies to
  version_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, active, archived
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  effective_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_policies_org_id ON compliance.policies(organization_id);
CREATE INDEX idx_policies_status ON compliance.policies(status);
CREATE INDEX idx_policies_framework ON compliance.policies(framework);

-- Policy Rules (Individual compliance rules)
CREATE TABLE compliance.policy_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL REFERENCES compliance.policies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_expression JSONB NOT NULL, -- JSON rule definition
  severity VARCHAR(50) NOT NULL, -- critical, high, medium, low
  automated BOOLEAN DEFAULT FALSE,
  remediation_guidance TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policy_rules_policy_id ON compliance.policy_rules(policy_id);

-- Compliance Violations
CREATE TABLE compliance.violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  policy_id UUID NOT NULL REFERENCES compliance.policies(id),
  rule_id UUID REFERENCES compliance.policy_rules(id),
  workflow_run_id UUID REFERENCES workflow.workflow_runs(id),
  evidence_id UUID REFERENCES evidence.evidence(id),
  severity VARCHAR(50) NOT NULL, -- critical, high, medium, low
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, under_review, remediated, waived, closed
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  detected_by UUID REFERENCES auth.users(id),
  remediated_at TIMESTAMP WITH TIME ZONE,
  remediation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_violations_org_id ON compliance.violations(organization_id);
CREATE INDEX idx_violations_policy_id ON compliance.violations(policy_id);
CREATE INDEX idx_violations_status ON compliance.violations(status);
CREATE INDEX idx_violations_severity ON compliance.violations(severity);

-- Certifications
CREATE TABLE compliance.certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  name VARCHAR(255) NOT NULL,
  certification_type VARCHAR(100) NOT NULL, -- 'iso27001', 'hipaa', 'soc2', 'custom'
  issuer VARCHAR(255),
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  renewal_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, upcoming_expiry, expired, renewal_in_progress
  document_url VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_certifications_org_id ON compliance.certifications(organization_id);
CREATE INDEX idx_certifications_expiry_date ON compliance.certifications(expiry_date);

-- ============================================================================
-- OPERATIONS SCHEMA - Monitoring & Alerts
-- ============================================================================

-- Alerts
CREATE TABLE operations.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  alert_type VARCHAR(50) NOT NULL, -- 'sla_breach', 'compliance_violation', 'workflow_error', 'anomaly'
  severity VARCHAR(50) NOT NULL, -- critical, high, medium, low, info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_workflow_run_id UUID REFERENCES workflow.workflow_runs(id),
  source_evidence_id UUID REFERENCES evidence.evidence(id),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_org_id ON operations.alerts(organization_id);
CREATE INDEX idx_alerts_severity ON operations.alerts(severity);
CREATE INDEX idx_alerts_is_resolved ON operations.alerts(is_resolved);
CREATE INDEX idx_alerts_created_at ON operations.alerts(created_at DESC);

-- Escalations
CREATE TABLE operations.escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  alert_id UUID REFERENCES operations.alerts(id),
  workflow_run_id UUID REFERENCES workflow.workflow_runs(id),
  approval_id UUID REFERENCES workflow.approvals(id),
  escalated_to UUID NOT NULL REFERENCES auth.users(id),
  escalation_level INTEGER DEFAULT 1,
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, acknowledged, resolved
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escalations_org_id ON operations.escalations(organization_id);
CREATE INDEX idx_escalations_escalated_to ON operations.escalations(escalated_to);

-- Operational Metrics (Time-series data)
CREATE TABLE operations.metrics (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(18, 4) NOT NULL,
  metric_unit VARCHAR(50),
  labels JSONB DEFAULT '{}'::jsonb, -- Key-value tags
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_org_id ON operations.metrics(organization_id);
CREATE INDEX idx_metrics_name_timestamp ON operations.metrics(metric_name, timestamp DESC);

-- SLA Tracking
CREATE TABLE operations.sla_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  workflow_run_id UUID NOT NULL REFERENCES workflow.workflow_runs(id),
  task_instance_id UUID REFERENCES workflow.task_instances(id),
  sla_hours INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  breached BOOLEAN DEFAULT FALSE,
  breached_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sla_tracking_org_id ON operations.sla_tracking(organization_id);
CREATE INDEX idx_sla_tracking_breached ON operations.sla_tracking(breached);
CREATE INDEX idx_sla_tracking_due_at ON operations.sla_tracking(due_at);

-- ============================================================================
-- INTEGRATION SCHEMA - External System Mappings
-- ============================================================================

-- Integration Configurations
CREATE TABLE integration.integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES auth.organizations(id),
  integration_type VARCHAR(100) NOT NULL, -- 'salesforce', 'sap', 'slack', etc.
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL, -- Encrypted credentials
  status VARCHAR(50) NOT NULL DEFAULT 'inactive', -- inactive, active, error
  error_message TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, integration_type, name)
);

CREATE INDEX idx_integrations_org_id ON integration.integrations(organization_id);
CREATE INDEX idx_integrations_status ON integration.integrations(status);

-- Integration Mappings
CREATE TABLE integration.integration_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integration.integrations(id) ON DELETE CASCADE,
  source_entity_type VARCHAR(100) NOT NULL, -- 'workflow_run', 'evidence', 'compliance_violation'
  target_entity_type VARCHAR(100) NOT NULL, -- Target system entity
  mapping_config JSONB NOT NULL, -- Field mapping rules
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_mappings_integration_id ON integration.integration_mappings(integration_id);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active Workflows
CREATE VIEW workflow.v_active_workflows AS
SELECT w.* FROM workflow.workflows w
WHERE w.status = 'published'
AND w.archived_at IS NULL;

-- Pending Approvals
CREATE VIEW workflow.v_pending_approvals AS
SELECT a.* FROM workflow.approvals a
WHERE a.status = 'pending'
AND a.assigned_to IS NOT NULL;

-- Open Violations
CREATE VIEW compliance.v_open_violations AS
SELECT v.* FROM compliance.violations v
WHERE v.status IN ('open', 'under_review');

-- Active Alerts
CREATE VIEW operations.v_active_alerts AS
SELECT a.* FROM operations.alerts a
WHERE a.is_resolved = FALSE
ORDER BY a.severity DESC, a.created_at DESC;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Default permissions
INSERT INTO auth.permissions (organization_id, resource, action, description)
VALUES (uuid_generate_v4(), 'workflow', 'create', 'Create new workflows')
     , (uuid_generate_v4(), 'workflow', 'read', 'Read workflows')
     , (uuid_generate_v4(), 'workflow', 'update', 'Update workflows')
     , (uuid_generate_v4(), 'workflow', 'delete', 'Delete workflows')
     , (uuid_generate_v4(), 'workflow', 'execute', 'Execute workflows')
ON CONFLICT (organization_id, resource, action) DO NOTHING;
