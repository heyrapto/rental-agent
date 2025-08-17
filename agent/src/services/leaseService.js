/**
 * Lease service for AO agent
 * Handles lease creation, signing, and management
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logLeaseAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { config } = require('../config');

class LeaseService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    /**
     * Initialize database connection
     */
    async initializeDatabase() {
        try {
            // In production, this would connect to a real database
            // For now, using in-memory storage but structured for easy DB migration
            this.db = new Map();
            logger.info('Lease service database initialized');
        } catch (error) {
            logger.error('Failed to initialize lease service database:', error);
            throw error;
        }
    }

    /**
     * Create a new lease
     */
    async createLease(leaseData) {
        try {
            const leaseId = leaseData.leaseId || uuidv4();
            
            // Validate lease data
            this.validateLeaseData(leaseData);
            
            // Check if lease already exists
            if (this.db.has(leaseId)) {
                throw new ValidationError('Lease already exists');
            }
            
            // Create lease object
            const lease = {
                id: leaseId,
                leaseId: leaseId,
                landlordAddr: leaseData.landlordAddr,
                tenantAddr: leaseData.tenantAddr,
                termsHash: leaseData.termsHash,
                rent: leaseData.rent,
                currency: leaseData.currency,
                deposit: leaseData.deposit,
                startDate: new Date(leaseData.startDate),
                endDate: new Date(leaseData.endDate),
                status: 'draft',
                signatures: new Set(),
                signatureCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                arweaveTxId: leaseData.arweaveTxId || null
            };
            
            // Store lease in database
            this.db.set(leaseId, lease);
            
            // TODO: In production, this would be a real database insert
            // await this.db.query(
            //     'INSERT INTO leases (id, landlord_addr, tenant_addr, terms_hash, rent, currency, deposit, start_date, end_date, status, created_at, updated_at, arweave_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            //     [leaseId, lease.landlordAddr, lease.tenantAddr, lease.termsHash, lease.rent, lease.currency, lease.deposit, lease.startDate, lease.endDate, lease.status, lease.createdAt, lease.updatedAt, lease.arweaveTxId]
            // );
            
            logLeaseAction('created', leaseId, leaseData.landlordAddr, {
                tenantAddr: leaseData.tenantAddr,
                rent: leaseData.rent,
                currency: leaseData.currency
            });
            
            return lease;
            
        } catch (error) {
            logger.error('Failed to create lease:', error);
            throw error;
        }
    }

    /**
     * Sign a lease
     */
    async signLease(leaseId, walletAddress) {
        try {
            // Get lease from database
            const lease = this.db.get(leaseId);
            if (!lease) {
                throw new NotFoundError('Lease not found');
            }
            
            // Verify signer is a party to the lease
            if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
                throw new ValidationError('Only lease parties can sign');
            }
            
            // Check if already signed
            if (lease.signatures.has(walletAddress)) {
                throw new ValidationError('Already signed by this party');
            }
            
            // Check if lease is in draft status
            if (lease.status !== 'draft') {
                throw new ValidationError('Lease is not in draft status');
            }
            
            // Add signature
            lease.signatures.add(walletAddress);
            lease.signatureCount++;
            lease.updatedAt = new Date();
            
            // Update lease in database
            this.db.set(leaseId, lease);
            
            // TODO: In production, this would be a real database update
            // await this.db.query(
            //     'UPDATE leases SET signature_count = ?, status = ?, updated_at = ? WHERE id = ?',
            //     [lease.signatureCount, lease.status, lease.updatedAt, leaseId]
            // );
            
            // Check if both parties have signed
            if (lease.signatureCount === 2) {
                lease.status = 'active';
                logLeaseAction('activated', leaseId, walletAddress);
                
                // Update status in database
                this.db.set(leaseId, lease);
                // await this.db.query('UPDATE leases SET status = ? WHERE id = ?', ['active', leaseId]);
            }
            
            logLeaseAction('signed', leaseId, walletAddress, {
                signatureCount: lease.signatureCount,
                status: lease.status
            });
            
            return {
                signatureCount: lease.signatureCount,
                status: lease.status
            };
            
        } catch (error) {
            logger.error('Failed to sign lease:', error);
            throw error;
        }
    }

    /**
     * Get lease by ID
     */
    async getLease(leaseId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query('SELECT * FROM leases WHERE id = ?', [leaseId]);
            // if (rows.length === 0) {
            //     throw new NotFoundError('Lease not found');
            // }
            // return rows[0];
            
            const lease = this.db.get(leaseId);
            if (!lease) {
                throw new NotFoundError('Lease not found');
            }
            
            return lease;
            
        } catch (error) {
            logger.error('Failed to get lease:', error);
            throw error;
        }
    }

    /**
     * Get all leases for a user
     */
    async getUserLeases(walletAddress) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM leases WHERE landlord_addr = ? OR tenant_addr = ? ORDER BY created_at DESC',
            //     [walletAddress, walletAddress]
            // );
            // return rows;
            
            const userLeases = [];
            
            for (const lease of this.db.values()) {
                if (lease.landlordAddr === walletAddress || lease.tenantAddr === walletAddress) {
                    userLeases.push(lease);
                }
            }
            
            return userLeases.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get user leases:', error);
            throw error;
        }
    }

    /**
     * Update lease
     */
    async updateLease(leaseId, updates, walletAddress) {
        try {
            const lease = this.db.get(leaseId);
            if (!lease) {
                throw new NotFoundError('Lease not found');
            }
            
            // Verify user can update lease
            if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
                throw new ValidationError('Only lease parties can update');
            }
            
            // Apply updates
            Object.assign(lease, updates);
            lease.updatedAt = new Date();
            
            // Update lease in database
            this.db.set(leaseId, lease);
            
            // TODO: In production, this would be a real database update
            // const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
            // const updateValues = [...Object.values(updates), lease.updatedAt, leaseId];
            // await this.db.query(`UPDATE leases SET ${updateFields}, updated_at = ? WHERE id = ?`, updateValues);
            
            logLeaseAction('updated', leaseId, walletAddress, updates);
            
            return lease;
            
        } catch (error) {
            logger.error('Failed to update lease:', error);
            throw error;
        }
    }

    /**
     * Terminate lease
     */
    async terminateLease(leaseId, walletAddress) {
        try {
            const lease = this.db.get(leaseId);
            if (!lease) {
                throw new NotFoundError('Lease not found');
            }
            
            // Only landlord can terminate
            if (lease.landlordAddr !== walletAddress) {
                throw new ValidationError('Only landlord can terminate lease');
            }
            
            // Check if lease is active
            if (lease.status !== 'active') {
                throw new ValidationError('Only active leases can be terminated');
            }
            
            // Terminate lease
            lease.status = 'terminated';
            lease.updatedAt = new Date();
            
            // Update lease in database
            this.db.set(leaseId, lease);
            
            // TODO: In production, this would be a real database update
            // await this.db.query('UPDATE leases SET status = ?, updated_at = ? WHERE id = ?', ['terminated', lease.updatedAt, leaseId]);
            
            logLeaseAction('terminated', leaseId, walletAddress);
            
            return lease;
            
        } catch (error) {
            logger.error('Failed to terminate lease:', error);
            throw error;
        }
    }

    /**
     * Get leases with rent due
     */
    async getLeasesWithRentDue(days) {
        try {
            const now = new Date();
            
            // TODO: In production, this would be a real database query with proper date calculations
            // const [rows] = await this.db.query(`
            //     SELECT *, 
            //     DATEDIFF(NEXT_RENT_DUE_DATE, CURDATE()) as days_until_due
            //     FROM leases 
            //     WHERE status = 'active' 
            //     AND DATEDIFF(NEXT_RENT_DUE_DATE, CURDATE()) <= ? 
            //     AND DATEDIFF(NEXT_RENT_DUE_DATE, CURDATE()) > 0
            // `, [days]);
            // return rows;
            
            const dueLeases = [];
            
            for (const lease of this.db.values()) {
                if (lease.status === 'active') {
                    const daysUntilDue = this.calculateDaysUntilRentDue(lease, now);
                    if (daysUntilDue <= days && daysUntilDue > 0) {
                        dueLeases.push({
                            ...lease,
                            daysUntilDue
                        });
                    }
                }
            }
            
            return dueLeases;
            
        } catch (error) {
            logger.error('Failed to get leases with rent due:', error);
            throw error;
        }
    }

    /**
     * Get overdue leases
     */
    async getOverdueLeases(days) {
        try {
            const now = new Date();
            
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT *, 
            //     DATEDIFF(CURDATE(), RENT_DUE_DATE) as days_overdue
            //     FROM leases 
            //     WHERE status = 'active' 
            //     AND DATEDIFF(CURDATE(), RENT_DUE_DATE) >= ?
            // `, [days]);
            // return rows;
            
            const overdueLeases = [];
            
            for (const lease of this.db.values()) {
                if (lease.status === 'active') {
                    const daysOverdue = this.calculateDaysOverdue(lease, now);
                    if (daysOverdue >= days) {
                        overdueLeases.push({
                            ...lease,
                            daysOverdue
                        });
                    }
                }
            }
            
            return overdueLeases;
            
        } catch (error) {
            logger.error('Failed to get overdue leases:', error);
            throw error;
        }
    }

    /**
     * Get expiring leases
     */
    async getExpiringLeases() {
        try {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
            
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT *, 
            //     DATEDIFF(end_date, CURDATE()) as days_until_expiry
            //     FROM leases 
            //     WHERE status = 'active' 
            //     AND end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            //     ORDER BY end_date ASC
            // `);
            // return rows;
            
            const expiringLeases = [];
            
            for (const lease of this.db.values()) {
                if (lease.status === 'active' && lease.endDate <= thirtyDaysFromNow) {
                    const daysUntilExpiry = Math.ceil((lease.endDate - now) / (24 * 60 * 60 * 1000));
                    expiringLeases.push({
                        ...lease,
                        daysUntilExpiry
                    });
                }
            }
            
            return expiringLeases.sort((a, b) => a.endDate - b.endDate);
            
        } catch (error) {
            logger.error('Failed to get expiring leases:', error);
            throw error;
        }
    }

    /**
     * Validate lease data
     */
    validateLeaseData(leaseData) {
        if (!leaseData.landlordAddr) {
            throw new ValidationError('Landlord address is required');
        }
        
        if (!leaseData.tenantAddr) {
            throw new ValidationError('Tenant address is required');
        }
        
        if (!leaseData.termsHash) {
            throw new ValidationError('Terms hash is required');
        }
        
        if (!leaseData.rent || leaseData.rent <= 0) {
            throw new ValidationError('Valid rent amount is required');
        }
        
        if (!leaseData.currency) {
            throw new ValidationError('Currency is required');
        }
        
        if (leaseData.deposit < 0) {
            throw new ValidationError('Deposit cannot be negative');
        }
        
        if (!leaseData.startDate) {
            throw new ValidationError('Start date is required');
        }
        
        if (!leaseData.endDate) {
            throw new ValidationError('End date is required');
        }
        
        const startDate = new Date(leaseData.startDate);
        const endDate = new Date(leaseData.endDate);
        
        if (startDate >= endDate) {
            throw new ValidationError('End date must be after start date');
        }
        
        if (startDate <= new Date()) {
            throw new ValidationError('Start date must be in the future');
        }
    }

    /**
     * Calculate days until rent is due
     */
    calculateDaysUntilRentDue(lease, now) {
        // In production, this would use the actual rent schedule from the lease
        // For now, using simplified logic - assumes rent is due on the 1st of each month
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Next rent due date (1st of next month)
        let nextRentDue = new Date(currentYear, currentMonth + 1, 1);
        
        // If we're past the 1st of this month, rent is due next month
        if (now.getDate() > 1) {
            nextRentDue = new Date(currentYear, currentMonth + 1, 1);
        } else {
            nextRentDue = new Date(currentYear, currentMonth, 1);
        }
        
        const daysUntilDue = Math.ceil((nextRentDue - now) / (24 * 60 * 60 * 1000));
        return Math.max(0, daysUntilDue);
    }

    /**
     * Calculate days overdue
     */
    calculateDaysOverdue(lease, now) {
        // In production, this would use the actual rent schedule from the lease
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        // Rent due date for current month
        const rentDueDate = new Date(currentYear, currentMonth, 1);
        
        if (now < rentDueDate) {
            return 0; // Not overdue yet
        }
        
        const daysOverdue = Math.ceil((now - rentDueDate) / (24 * 60 * 60 * 1000));
        return daysOverdue;
    }

    /**
     * Get lease statistics
     */
    async getLeaseStats() {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT 
            //         COUNT(*) as total,
            //         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
            //         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            //         SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
            //         SUM(CASE WHEN status = 'active' AND end_date < CURDATE() THEN 1 ELSE 0 END) as expired
            //     FROM leases
            // `);
            // return rows[0];
            
            const stats = {
                total: this.db.size,
                draft: 0,
                active: 0,
                terminated: 0,
                expired: 0
            };
            
            for (const lease of this.db.values()) {
                if (lease.status === 'expired' && lease.endDate < new Date()) {
                    stats.expired++;
                } else {
                    stats[lease.status]++;
                }
            }
            
            return stats;
            
        } catch (error) {
            logger.error('Failed to get lease stats:', error);
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            // TODO: In production, this would close the real database connection
            // if (this.db) {
            //     await this.db.end();
            // }
            this.db.clear();
            logger.info('Lease service database connection closed');
        } catch (error) {
            logger.error('Failed to close lease service database:', error);
        }
    }
}

// Create singleton instance
const leaseService = new LeaseService();

module.exports = { leaseService };