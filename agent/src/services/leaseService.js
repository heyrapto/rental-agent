/**
 * Lease service for AO agent
 * Handles lease creation, signing, and management
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logLeaseAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class LeaseService {
    constructor() {
        this.leases = new Map();
        this.leaseCounter = 0;
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
            if (this.leases.has(leaseId)) {
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
            
            // Store lease
            this.leases.set(leaseId, lease);
            this.leaseCounter++;
            
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
            // Get lease
            const lease = this.leases.get(leaseId);
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
            
            // Check if both parties have signed
            if (lease.signatureCount === 2) {
                lease.status = 'active';
                logLeaseAction('activated', leaseId, walletAddress);
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
            const lease = this.leases.get(leaseId);
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
            const userLeases = [];
            
            for (const lease of this.leases.values()) {
                if (lease.landlordAddr === walletAddress || lease.tenantAddr === walletAddress) {
                    userLeases.push(lease);
                }
            }
            
            return userLeases;
            
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
            const lease = this.leases.get(leaseId);
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
            const lease = this.leases.get(leaseId);
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
            const dueDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
            
            const dueLeases = [];
            
            for (const lease of this.leases.values()) {
                if (lease.status === 'active') {
                    // Calculate next rent due date (simplified logic)
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
            
            const overdueLeases = [];
            
            for (const lease of this.leases.values()) {
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
            
            const expiringLeases = [];
            
            for (const lease of this.leases.values()) {
                if (lease.status === 'active' && lease.endDate <= thirtyDaysFromNow) {
                    const daysUntilExpiry = Math.ceil((lease.endDate - now) / (24 * 60 * 60 * 1000));
                    expiringLeases.push({
                        ...lease,
                        daysUntilExpiry
                    });
                }
            }
            
            return expiringLeases;
            
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
        // Simplified logic - assumes rent is due on the 1st of each month
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
        // Simplified logic - assumes rent is due on the 1st of each month
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
            const stats = {
                total: this.leases.size,
                draft: 0,
                active: 0,
                terminated: 0,
                expired: 0
            };
            
            for (const lease of this.leases.values()) {
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
}

// Create singleton instance
const leaseService = new LeaseService();

module.exports = { leaseService };