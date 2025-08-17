-- Rental Contract AO Agent Database Schema
-- This file contains the complete database structure for production use

-- Create database
CREATE DATABASE IF NOT EXISTS rental_contract_ao_agent;
USE rental_contract_ao_agent;

-- Leases table
CREATE TABLE leases (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(255) UNIQUE NOT NULL,
    landlord_addr VARCHAR(255) NOT NULL,
    tenant_addr VARCHAR(255) NOT NULL,
    terms_hash VARCHAR(255) NOT NULL,
    rent DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    deposit DECIMAL(20,8) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft', 'active', 'terminated', 'expired') DEFAULT 'draft',
    signature_count INT DEFAULT 0,
    arweave_tx_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_landlord (landlord_addr),
    INDEX idx_tenant (tenant_addr),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_arweave (arweave_tx_id)
);

-- Lease signatures table
CREATE TABLE lease_signatures (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(36) NOT NULL,
    signer_addr VARCHAR(255) NOT NULL,
    signature_data TEXT,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
    UNIQUE KEY unique_lease_signer (lease_id, signer_addr),
    INDEX idx_lease (lease_id),
    INDEX idx_signer (signer_addr)
);

-- Payments table
CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(36) NOT NULL,
    payer VARCHAR(255) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    chain_id BIGINT NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    receipt_arweave_tx_id VARCHAR(255),
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tx_hash (chain_id, tx_hash),
    INDEX idx_lease (lease_id),
    INDEX idx_payer (payer),
    INDEX idx_confirmed (confirmed),
    INDEX idx_arweave (receipt_arweave_tx_id)
);

-- Messages table
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(36) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(200),
    content TEXT NOT NULL,
    message_type ENUM('general', 'maintenance', 'payment', 'legal', 'emergency') DEFAULT 'general',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    read BOOLEAN DEFAULT FALSE,
    arweave_tx_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
    INDEX idx_lease (lease_id),
    INDEX idx_sender (sender),
    INDEX idx_recipient (recipient),
    INDEX idx_read (read),
    INDEX idx_type (message_type),
    INDEX idx_arweave (arweave_tx_id)
);

-- Maintenance tickets table
CREATE TABLE maintenance_tickets (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(36) NOT NULL,
    reported_by VARCHAR(255) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    category ENUM('plumbing', 'electrical', 'hvac', 'structural', 'appliance', 'general') DEFAULT 'general',
    status ENUM('open', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'open',
    assigned_to VARCHAR(255),
    estimated_cost DECIMAL(20,8) DEFAULT 0,
    actual_cost DECIMAL(20,8) DEFAULT 0,
    due_date DATE,
    arweave_tx_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
    INDEX idx_lease (lease_id),
    INDEX idx_reported_by (reported_by),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_category (category),
    INDEX idx_due_date (due_date),
    INDEX idx_arweave (arweave_tx_id)
);

-- Dispute packages table
CREATE TABLE dispute_packages (
    id VARCHAR(36) PRIMARY KEY,
    lease_id VARCHAR(36) NOT NULL,
    evidence_tx_ids JSON NOT NULL,
    merkle_root VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    status ENUM('pending', 'resolved', 'expired') DEFAULT 'pending',
    arweave_tx_id VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    resolution TEXT,
    resolver VARCHAR(255),
    resolution_timestamp TIMESTAMP NULL,
    
    FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
    INDEX idx_lease (lease_id),
    INDEX idx_created_by (created_by),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at),
    INDEX idx_arweave (arweave_tx_id)
);

-- System metrics table
CREATE TABLE system_metrics (
    id VARCHAR(36) PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSON NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (metric_name),
    INDEX idx_timestamp (timestamp)
);

-- Audit log table
CREATE TABLE audit_log (
    id VARCHAR(36) PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36),
    user_address VARCHAR(255),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_user (user_address),
    INDEX idx_timestamp (created_at)
);

-- User sessions table
CREATE TABLE user_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_address VARCHAR(255) NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_address),
    INDEX idx_token (session_token),
    INDEX idx_expires (expires_at)
);

-- Configuration table
CREATE TABLE configuration (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);

-- Insert default configuration
INSERT INTO configuration (key, value, description) VALUES
('system_version', '1.0.0', 'Current system version'),
('maintenance_mode', 'false', 'System maintenance mode'),
('max_file_size', '10485760', 'Maximum file upload size in bytes'),
('session_timeout', '86400', 'Session timeout in seconds'),
('rate_limit_requests', '100', 'Rate limit requests per window'),
('rate_limit_window', '900000', 'Rate limit window in milliseconds');

-- Create views for common queries
CREATE VIEW active_leases AS
SELECT * FROM leases WHERE status = 'active';

CREATE VIEW overdue_payments AS
SELECT 
    l.id as lease_id,
    l.lease_id as lease_identifier,
    l.landlord_addr,
    l.tenant_addr,
    l.rent,
    l.currency,
    DATEDIFF(CURDATE(), l.start_date) as days_overdue
FROM leases l
WHERE l.status = 'active' 
AND l.start_date < CURDATE()
AND NOT EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.lease_id = l.id 
    AND p.confirmed = true
);

CREATE VIEW maintenance_summary AS
SELECT 
    lease_id,
    COUNT(*) as total_tickets,
    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_tickets,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tickets,
    SUM(estimated_cost) as total_estimated_cost,
    SUM(actual_cost) as total_actual_cost
FROM maintenance_tickets
GROUP BY lease_id;

-- Create stored procedures for common operations
DELIMITER //

CREATE PROCEDURE GetLeaseStats()
BEGIN
    SELECT 
        COUNT(*) as total_leases,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_leases,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_leases,
        SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated_leases,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_leases
    FROM leases;
END //

CREATE PROCEDURE GetPaymentStats()
BEGIN
    SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN confirmed = 1 THEN 1 ELSE 0 END) as confirmed_payments,
        SUM(CASE WHEN confirmed = 0 THEN 1 ELSE 0 END) as pending_payments,
        SUM(amount) as total_amount,
        currency
    FROM payments
    GROUP BY currency;
END //

CREATE PROCEDURE CleanupExpiredSessions()
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END //

DELIMITER ;

-- Create indexes for performance
CREATE INDEX idx_leases_composite ON leases(status, start_date, end_date);
CREATE INDEX idx_payments_composite ON payments(lease_id, confirmed, created_at);
CREATE INDEX idx_messages_composite ON messages(lease_id, created_at, read);
CREATE INDEX idx_tickets_composite ON maintenance_tickets(lease_id, status, priority);
CREATE INDEX idx_disputes_composite ON dispute_packages(lease_id, status, expires_at);

-- Grant permissions (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON rental_contract_ao_agent.* TO 'ao_agent_user'@'localhost';
-- FLUSH PRIVILEGES;