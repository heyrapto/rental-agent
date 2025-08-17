/**
 * Dispute service for AO agent
 * Handles dispute package creation and evidence collection
 */

const { v4: uuidv4 } = require('uuid');
const { logger, logDisputeAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class DisputeService {
    constructor() {
        this.disputes = new Map();
        this.disputeCounter = 0;
    }

    /**
     * Build dispute package
     */
    async buildDisputePackage(leaseId, evidenceTypes, walletAddress) {
        try {
            const disputeId = uuidv4();
            
            // Mock dispute package creation
            const disputePackage = {
                id: disputeId,
                leaseId,
                evidenceTypes,
                evidenceCount: evidenceTypes.length,
                merkleRoot: 'mock-merkle-root-' + disputeId,
                createdBy: walletAddress,
                createdAt: new Date(),
                arweaveTxId: 'mock-arweave-tx-' + disputeId
            };
            
            // Store dispute
            this.disputes.set(disputeId, disputePackage);
            this.disputeCounter++;
            
            logDisputeAction('package_built', disputeId, leaseId, walletAddress, {
                evidenceCount: evidenceTypes.length,
                merkleRoot: disputePackage.merkleRoot
            });
            
            return disputePackage;
            
        } catch (error) {
            logger.error('Failed to build dispute package:', error);
            throw error;
        }
    }
}

// Create singleton instance
const disputeService = new DisputeService();

module.exports = { disputeService };