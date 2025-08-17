/**
 * Message handler for AO agent
 * Routes all agent actions to appropriate services
 */

const Joi = require('joi');
const { logger, logAction } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// Import services
const { leaseService } = require('../services/leaseService');
const { paymentService } = require('../services/paymentService');
const { disputeService } = require('../services/disputeService');
const { maintenanceService } = require('../services/maintenanceService');
const { communicationService } = require('../services/communicationService');
const { arweaveService } = require('../services/arweaveService');

// Action validation schemas
const actionSchemas = {
    createLease: Joi.object({
        leaseId: Joi.string().optional(),
        landlordAddr: Joi.string().required(),
        tenantAddr: Joi.string().required(),
        termsHash: Joi.string().required(),
        rent: Joi.number().positive().required(),
        currency: Joi.string().required(),
        deposit: Joi.number().min(0).required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
    }),

    signLease: Joi.object({
        leaseId: Joi.string().required(),
        walletAddress: Joi.string().required()
    }),

    recordPayment: Joi.object({
        leaseId: Joi.string().required(),
        payer: Joi.string().required(),
        amount: Joi.number().positive().required(),
        currency: Joi.string().required(),
        chainId: Joi.number().integer().positive().required(),
        txHash: Joi.string().required(),
        receiptArweaveTxId: Joi.string().optional()
    }),

    postMessage: Joi.object({
        leaseId: Joi.string().required(),
        sender: Joi.string().required(),
        recipient: Joi.string().required(),
        subject: Joi.string().max(200).optional(),
        content: Joi.string().required(),
        messageType: Joi.string().valid('general', 'maintenance', 'payment', 'legal', 'emergency').optional(),
        priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional()
    }),

    createTicket: Joi.object({
        leaseId: Joi.string().required(),
        reportedBy: Joi.string().required(),
        title: Joi.string().required(),
        description: Joi.string().required(),
        priority: Joi.string().valid('low', 'medium', 'high').optional(),
        category: Joi.string().valid('plumbing', 'electrical', 'hvac', 'structural', 'appliance', 'general').optional(),
        estimatedCost: Joi.number().min(0).optional(),
        dueDate: Joi.date().iso().optional()
    }),

    updateTicket: Joi.object({
        ticketId: Joi.string().required(),
        updates: Joi.object({
            status: Joi.string().valid('open', 'assigned', 'in_progress', 'completed', 'cancelled').optional(),
            assignedTo: Joi.string().optional(),
            estimatedCost: Joi.number().min(0).optional(),
            actualCost: Joi.number().min(0).optional(),
            dueDate: Joi.date().iso().optional(),
            notes: Joi.string().optional()
        }).min(1).required()
    }),

    buildDisputePackage: Joi.object({
        leaseId: Joi.string().required(),
        evidenceTxIds: Joi.array().items(Joi.string()).min(1).required()
    })
};

/**
 * Main message handler
 */
const handleMessage = async (req, res) => {
    try {
        const { action, data } = req.body;
        const walletAddress = req.walletAddress;

        if (!action) {
            throw new ValidationError('Action is required');
        }

        if (!data) {
            throw new ValidationError('Data is required');
        }

        logger.info('Processing agent action', { action, walletAddress, requestId: req.id });

        let result;

        switch (action) {
            case 'createLease':
                result = await handleCreateLease(data, walletAddress);
                break;

            case 'signLease':
                result = await handleSignLease(data, walletAddress);
                break;

            case 'recordPayment':
                result = await handleRecordPayment(data, walletAddress);
                break;

            case 'postMessage':
                result = await handlePostMessage(data, walletAddress);
                break;

            case 'createTicket':
                result = await handleCreateTicket(data, walletAddress);
                break;

            case 'updateTicket':
                result = await handleUpdateTicket(data, walletAddress);
                break;

            case 'buildDisputePackage':
                result = await handleBuildDisputePackage(data, walletAddress);
                break;

            default:
                throw new ValidationError(`Unknown action: ${action}`);
        }

        logAction(action, walletAddress, { success: true, result });
        
        res.status(200).json({
            success: true,
            action,
            result,
            timestamp: new Date().toISOString(),
            requestId: req.id
        });

    } catch (error) {
        logger.error('Message handling failed:', error);
        
        logAction(req.body?.action || 'unknown', req.walletAddress, { 
            success: false, 
            error: error.message 
        });

        if (error.name === 'ValidationError') {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.message,
                requestId: req.id
            });
        } else if (error.name === 'NotFoundError') {
            res.status(404).json({
                success: false,
                error: 'Resource not found',
                details: error.message,
                requestId: req.id
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                requestId: req.id
            });
        }
    }
};

/**
 * Handle lease creation
 */
const handleCreateLease = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.createLease.validate(data);
    if (error) {
        throw new ValidationError(`Lease creation validation failed: ${error.details[0].message}`);
    }

    // Verify sender is the landlord
    if (value.landlordAddr !== walletAddress) {
        throw new ValidationError('Only the landlord can create a lease');
    }

    // Store lease terms on Arweave
    const arweaveTxId = await arweaveService.storeLeaseTerms(value, {
        leaseId: value.leaseId,
        landlordAddr: value.landlordAddr,
        tenantAddr: value.tenantAddr
    });

    // Create lease in local database
    const lease = await leaseService.createLease({
        ...value,
        arweaveTxId
    });

    return {
        leaseId: lease.id,
        arweaveTxId,
        status: lease.status
    };
};

/**
 * Handle lease signing
 */
const handleSignLease = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.signLease.validate(data);
    if (error) {
        throw new ValidationError(`Lease signing validation failed: ${error.details[0].message}`);
    }

    // Verify signer is a party to the lease
    const lease = await leaseService.getLease(value.leaseId);
    if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
        throw new ValidationError('Only lease parties can sign');
    }

    // Sign the lease
    const result = await leaseService.signLease(value.leaseId, walletAddress);

    return {
        leaseId: value.leaseId,
        signatureCount: result.signatureCount,
        status: result.status
    };
};

/**
 * Handle payment recording
 */
const handleRecordPayment = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.recordPayment.validate(data);
    if (error) {
        throw new ValidationError(`Payment recording validation failed: ${error.details[0].message}`);
    }

    // Verify payment on blockchain
    const paymentVerified = await paymentService.verifyPayment(
        value.chainId,
        value.txHash,
        value.amount,
        value.currency
    );

    if (!paymentVerified) {
        throw new ValidationError('Payment verification failed');
    }

    // Store payment receipt on Arweave
    const receiptArweaveTxId = await arweaveService.storePaymentReceipt(value, {
        leaseId: value.leaseId,
        payer: value.payer,
        amount: value.amount.toString(),
        currency: value.currency
    });

    // Record payment in local database
    const payment = await paymentService.recordPayment({
        ...value,
        receiptArweaveTxId
    });

    // Confirm payment
    await paymentService.confirmPayment(payment.id, receiptArweaveTxId);

    return {
        paymentId: payment.id,
        receiptArweaveTxId,
        confirmed: true
    };
};

/**
 * Handle message posting
 */
const handlePostMessage = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.postMessage.validate(data);
    if (error) {
        throw new ValidationError(`Message posting validation failed: ${error.details[0].message}`);
    }

    // Verify sender is a party to the lease
    const lease = await leaseService.getLease(value.leaseId);
    if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
        throw new ValidationError('Only lease parties can post messages');
    }

    // Store message on Arweave
    const arweaveTxId = await arweaveService.storeMessage(value, {
        leaseId: value.leaseId,
        sender: value.sender,
        recipient: value.recipient
    });

    // Store message in local database
    const message = await communicationService.postMessage({
        ...value,
        arweaveTxId
    });

    return {
        messageId: message.id,
        arweaveTxId,
        timestamp: message.createdAt
    };
};

/**
 * Handle maintenance ticket creation
 */
const handleCreateTicket = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.createTicket.validate(data);
    if (error) {
        throw new ValidationError(`Ticket creation validation failed: ${error.details[0].message}`);
    }

    // Verify reporter is a party to the lease
    const lease = await leaseService.getLease(value.leaseId);
    if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
        throw new ValidationError('Only lease parties can create maintenance tickets');
    }

    // Store ticket on Arweave
    const arweaveTxId = await arweaveService.storeMaintenanceTicket(value, {
        leaseId: value.leaseId,
        reportedBy: value.reportedBy,
        priority: value.priority,
        category: value.category
    });

    // Create ticket in local database
    const ticket = await maintenanceService.createTicket({
        ...value,
        arweaveTxId
    });

    return {
        ticketId: ticket.id,
        arweaveTxId,
        status: ticket.status
    };
};

/**
 * Handle maintenance ticket updates
 */
const handleUpdateTicket = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.updateTicket.validate(data);
    if (error) {
        throw new ValidationError(`Ticket update validation failed: ${error.details[0].message}`);
    }

    // Update ticket
    const ticket = await maintenanceService.updateTicket(
        value.ticketId,
        value.updates,
        walletAddress
    );

    return {
        ticketId: ticket.id,
        status: ticket.status,
        updatedAt: ticket.updatedAt
    };
};

/**
 * Handle dispute package creation
 */
const handleBuildDisputePackage = async (data, walletAddress) => {
    // Validate input data
    const { error, value } = actionSchemas.buildDisputePackage.validate(data);
    if (error) {
        throw new ValidationError(`Dispute package creation validation failed: ${error.details[0].message}`);
    }

    // Verify creator is a party to the lease
    const lease = await leaseService.getLease(value.leaseId);
    if (lease.landlordAddr !== walletAddress && lease.tenantAddr !== walletAddress) {
        throw new ValidationError('Only lease parties can create dispute packages');
    }

    // Create dispute package
    const disputePackage = await disputeService.buildDisputePackage(
        value.leaseId,
        value.evidenceTxIds,
        walletAddress
    );

    return {
        disputeId: disputePackage.disputeId,
        merkleRoot: disputePackage.merkleRoot,
        arweaveTxId: disputePackage.arweaveTxId,
        evidenceCount: disputePackage.evidenceCount
    };
};

module.exports = { handleMessage };