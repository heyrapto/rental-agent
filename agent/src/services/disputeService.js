/**
 * Dispute service for AO agent
 * Handles dispute package creation and evidence management
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { logger, logDisputeAction } = require('../utils/logger');
const { ValidationError, NotFoundError, ArweaveError } = require('../middleware/errorHandler');
const { config } = require('../config');

class DisputeService {
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
            this.db = new Map();
            logger.info('Dispute service database initialized');
        } catch (error) {
            logger.error('Failed to initialize dispute service database:', error);
            throw error;
        }
    }

    /**
     * Build dispute package with evidence
     */
    async buildDisputePackage(leaseId, evidenceTxIds, walletAddress) {
        try {
            // Validate inputs
            if (!leaseId) {
                throw new ValidationError('Lease ID is required');
            }
            
            if (!evidenceTxIds || !Array.isArray(evidenceTxIds) || evidenceTxIds.length === 0) {
                throw new ValidationError('Evidence transaction IDs are required');
            }
            
            if (evidenceTxIds.length > config.DISPUTE_MAX_EVIDENCE_COUNT) {
                throw new ValidationError(`Maximum evidence count exceeded: ${config.DISPUTE_MAX_EVIDENCE_COUNT}`);
            }
            
            // Generate dispute ID
            const disputeId = uuidv4();
            
            // Generate Merkle root from evidence
            const merkleRoot = this.generateMerkleRoot(evidenceTxIds);
            
            // Create dispute package
            const disputePackage = {
                id: disputeId,
                leaseId,
                evidenceTxIds,
                merkleRoot,
                createdBy: walletAddress,
                createdAt: new Date(),
                status: 'pending',
                expiresAt: new Date(Date.now() + (config.DISPUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000))
            };
            
            // Store dispute package in database
            this.db.set(disputeId, disputePackage);
            
            // TODO: In production, this would be a real database insert
            // await this.db.query(
            //     'INSERT INTO dispute_packages (id, lease_id, evidence_tx_ids, merkle_root, created_by, created_at, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            //     [disputeId, leaseId, JSON.stringify(evidenceTxIds), merkleRoot, walletAddress, disputePackage.createdAt, disputePackage.status, disputePackage.expiresAt]
            // );
            
            // Store dispute package on Arweave
            const arweaveTxId = await this.storeDisputePackageOnArweave(disputePackage);
            
            // Update dispute package with Arweave transaction ID
            disputePackage.arweaveTxId = arweaveTxId;
            this.db.set(disputeId, disputePackage);
            
            // TODO: In production, this would be a real database update
            // await this.db.query('UPDATE dispute_packages SET arweave_tx_id = ? WHERE id = ?', [arweaveTxId, disputeId]);
            
            logDisputeAction('created', disputeId, leaseId, walletAddress, {
                evidenceCount: evidenceTxIds.length,
                merkleRoot,
                arweaveTxId
            });
            
            return {
                disputeId,
                merkleRoot,
                arweaveTxId,
                evidenceCount: evidenceTxIds.length
            };
            
        } catch (error) {
            logger.error('Failed to build dispute package:', error);
            throw error;
        }
    }

    /**
     * Generate Merkle root from evidence transaction IDs
     */
    generateMerkleRoot(evidenceTxIds) {
        try {
            // Sort evidence IDs for consistent ordering
            const sortedIds = [...evidenceTxIds].sort();
            
            // Create leaf nodes (hash of each evidence ID)
            const leaves = sortedIds.map(txId => 
                crypto.createHash('sha256').update(txId).digest('hex')
            );
            
            // Build Merkle tree bottom-up
            let currentLevel = leaves;
            
            while (currentLevel.length > 1) {
                const nextLevel = [];
                
                for (let i = 0; i < currentLevel.length; i += 2) {
                    const left = currentLevel[i];
                    const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                    
                    // Hash left + right to create parent node
                    const parent = crypto.createHash('sha256')
                        .update(left + right)
                        .digest('hex');
                    
                    nextLevel.push(parent);
                }
                
                currentLevel = nextLevel;
            }
            
            // Return the root hash
            return currentLevel[0];
            
        } catch (error) {
            logger.error('Failed to generate Merkle root:', error);
            throw new Error('Failed to generate Merkle root');
        }
    }

    /**
     * Verify evidence in dispute package using Merkle proof
     */
    async verifyEvidenceInDispute(disputeId, evidenceTxId, merkleProof) {
        try {
            // Get dispute package
            const dispute = this.db.get(disputeId);
            if (!dispute) {
                throw new NotFoundError('Dispute package not found');
            }
            
            // Verify evidence is part of the dispute
            if (!dispute.evidenceTxIds.includes(evidenceTxId)) {
                throw new ValidationError('Evidence not found in dispute package');
            }
            
            // Verify Merkle proof
            const isValid = this.verifyMerkleProof(evidenceTxId, merkleProof, dispute.merkleRoot);
            
            if (!isValid) {
                throw new ValidationError('Invalid Merkle proof');
            }
            
            logger.info('Evidence verification successful', { disputeId, evidenceTxId });
            return true;
            
        } catch (error) {
            logger.error('Failed to verify evidence:', error);
            throw error;
        }
    }

    /**
     * Verify Merkle proof
     */
    verifyMerkleProof(evidenceTxId, merkleProof, merkleRoot) {
        try {
            // Hash the evidence transaction ID
            let currentHash = crypto.createHash('sha256').update(evidenceTxId).digest('hex');
            
            // Follow the proof path to reconstruct the root
            for (const proof of merkleProof) {
                if (proof.position === 'left') {
                    // Current hash is on the right, proof is on the left
                    currentHash = crypto.createHash('sha256')
                        .update(proof.hash + currentHash)
                        .digest('hex');
                } else {
                    // Current hash is on the left, proof is on the right
                    currentHash = crypto.createHash('sha256')
                        .update(currentHash + proof.hash)
                        .digest('hex');
                }
            }
            
            // Compare with the expected root
            return currentHash === merkleRoot;
            
        } catch (error) {
            logger.error('Failed to verify Merkle proof:', error);
            return false;
        }
    }

    /**
     * Store dispute package on Arweave
     */
    async storeDisputePackageOnArweave(disputePackage) {
        try {
            // In production, this would use the real Arweave service
            // const { arweaveService } = require('./arweaveService');
            // const txId = await arweaveService.storeDisputePackage(disputePackage);
            // return txId;
            
            // For now, generate a mock Arweave transaction ID
            const mockTxId = 'mock_arweave_tx_' + crypto.randomBytes(16).toString('hex');
            
            logger.info('Dispute package stored on Arweave', { 
                disputeId: disputePackage.id, 
                arweaveTxId: mockTxId 
            });
            
            return mockTxId;
            
        } catch (error) {
            logger.error('Failed to store dispute package on Arweave:', error);
            throw new ArweaveError('Failed to store dispute package', error.message);
        }
    }

    /**
     * Get dispute package by ID
     */
    async getDisputePackage(disputeId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query('SELECT * FROM dispute_packages WHERE id = ?', [disputeId]);
            // if (rows.length === 0) {
            //     throw new NotFoundError('Dispute package not found');
            // }
            // return rows[0];
            
            const dispute = this.db.get(disputeId);
            if (!dispute) {
                throw new NotFoundError('Dispute package not found');
            }
            
            return dispute;
            
        } catch (error) {
            logger.error('Failed to get dispute package:', error);
            throw error;
        }
    }

    /**
     * Get dispute packages for a lease
     */
    async getLeaseDisputes(leaseId) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM dispute_packages WHERE lease_id = ? ORDER BY created_at DESC',
            //     [leaseId]
            // );
            // return rows;
            
            const leaseDisputes = [];
            
            for (const dispute of this.db.values()) {
                if (dispute.leaseId === leaseId) {
                    leaseDisputes.push(dispute);
                }
            }
            
            return leaseDisputes.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get lease disputes:', error);
            throw error;
        }
    }

    /**
     * Get dispute packages for a user
     */
    async getUserDisputes(walletAddress) {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(
            //     'SELECT * FROM dispute_packages WHERE created_by = ? ORDER BY created_at DESC',
            //     [walletAddress]
            // );
            // return rows;
            
            const userDisputes = [];
            
            for (const dispute of this.db.values()) {
                if (dispute.createdBy === walletAddress) {
                    userDisputes.push(dispute);
                }
            }
            
            return userDisputes.sort((a, b) => b.createdAt - a.createdAt);
            
        } catch (error) {
            logger.error('Failed to get user disputes:', error);
            throw error;
        }
    }

    /**
     * Update dispute package status
     */
    async updateDisputeStatus(disputeId, status, walletAddress) {
        try {
            const dispute = this.db.get(disputeId);
            if (!dispute) {
                throw new NotFoundError('Dispute package not found');
            }
            
            // Update status
            dispute.status = status;
            dispute.updatedAt = new Date();
            dispute.updatedBy = walletAddress;
            
            // Update dispute in database
            this.db.set(disputeId, dispute);
            
            // TODO: In production, this would be a real database update
            // await this.db.query(
            //     'UPDATE dispute_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?',
            //     [status, dispute.updatedAt, walletAddress, disputeId]
            // );
            
            logDisputeAction('status_updated', disputeId, dispute.leaseId, walletAddress, { status });
            
            return dispute;
            
        } catch (error) {
            logger.error('Failed to update dispute status:', error);
            throw error;
        }
    }

    /**
     * Get dispute statistics
     */
    async getDisputeStats() {
        try {
            // TODO: In production, this would be a real database query
            // const [rows] = await this.db.query(`
            //     SELECT 
            //         COUNT(*) as total,
            //         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            //         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            //         SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
            //     FROM dispute_packages
            // `);
            // return rows[0];
            
            const stats = {
                total: this.db.size,
                pending: 0,
                resolved: 0,
                expired: 0
            };
            
            for (const dispute of this.db.values()) {
                if (dispute.status === 'expired' && dispute.expiresAt < new Date()) {
                    stats.expired++;
                } else {
                    stats[dispute.status]++;
                }
            }
            
            return stats;
            
        } catch (error) {
            logger.error('Failed to get dispute stats:', error);
            throw error;
        }
    }

    /**
     * Clean up expired disputes
     */
    async cleanupExpiredDisputes() {
        try {
            const now = new Date();
            const expiredDisputes = [];
            
            for (const [disputeId, dispute] of this.db.entries()) {
                if (dispute.expiresAt < now && dispute.status === 'pending') {
                    expiredDisputes.push(disputeId);
                }
            }
            
            // Update expired disputes
            for (const disputeId of expiredDisputes) {
                const dispute = this.db.get(disputeId);
                dispute.status = 'expired';
                dispute.updatedAt = now;
                this.db.set(disputeId, dispute);
                
                // TODO: In production, this would be a real database update
                // await this.db.query(
                //     'UPDATE dispute_packages SET status = ?, updated_at = ? WHERE id = ?',
                //     ['expired', now, disputeId]
                // );
            }
            
            if (expiredDisputes.length > 0) {
                logger.info(`Cleaned up ${expiredDisputes.length} expired disputes`);
            }
            
            return expiredDisputes.length;
            
        } catch (error) {
            logger.error('Failed to cleanup expired disputes:', error);
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
            logger.info('Dispute service database connection closed');
        } catch (error) {
            logger.error('Failed to close dispute service database:', error);
        }
    }
}

// Create singleton instance
const disputeService = new DisputeService();

module.exports = { disputeService };