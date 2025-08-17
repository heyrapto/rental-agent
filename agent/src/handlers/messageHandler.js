/**
 * Main message handler for AO agent
 * Routes incoming messages to appropriate action handlers
 */

const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const { logger, logLeaseAction, logPaymentAction, logDisputeAction, logMaintenanceAction } = require('../utils/logger');
const { asyncHandler, handleJoiValidationError, ValidationError } = require('../middleware/errorHandler');
const { leaseService } = require('../services/leaseService');
const { paymentService } = require('../services/paymentService');
const { disputeService } = require('../services/disputeService');
const { maintenanceService } = require('../services/maintenanceService');
const { communicationService } = require('../services/communicationService');
const { arweaveService } = require('../services/arweaveService');

/**
 * Main message handler for POST /agent endpoint
 */
const messageHandler = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const { action, ...payload } = req.body;
    const { walletAddress } = req.user;

    logger.info(`Processing ${action} action`, {
        action,
        walletAddress,
        payload: Object.keys(payload)
    });

    try {
        // Validate action
        if (!action) {
            throw new ValidationError('Action is required');
        }

        // Route to appropriate handler
        let result;
        switch (action) {
            case 'createLease':
                result = await handleCreateLease(payload, walletAddress);
                break;
                
            case 'signLease':
                result = await handleSignLease(payload, walletAddress);
                break;
                
            case 'recordPayment':
                result = await handleRecordPayment(payload, walletAddress);
                break;
                
            case 'postMessage':
                result = await handlePostMessage(payload, walletAddress);
                break;
                
            case 'createTicket':
                result = await handleCreateTicket(payload, walletAddress);
                break;
                
            case 'updateTicket':
                result = await handleUpdateTicket(payload, walletAddress);
                break;
                
            case 'buildDisputePackage':
                result = await handleBuildDisputePackage(payload, walletAddress);
                break;
                
            default:
                throw new ValidationError(`Unknown action: ${action}`);
        }

        const duration = Date.now() - startTime;
        logger.info(`Action ${action} completed successfully`, {
            action,
            walletAddress,
            duration,
            result: Object.keys(result)
        });

        res.json({
            ok: true,
            ...result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Action ${action} failed`, {
            action,
            walletAddress,
            duration,
            error: error.message
        });

        throw error;
    }
});

/**
 * Handle lease creation
 */
const handleCreateLease = async (payload, walletAddress) => {
    // Validate payload
    const { error, value } = createLeaseSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { landlordAddr, tenantAddr, terms, rent, currency, deposit, startDate, endDate } = value;

    // Verify sender is the landlord
    if (landlordAddr !== walletAddress) {
        throw new ValidationError('Only the landlord can create a lease');
    }

    // Store lease terms on Arweave
    const termsTxId = await arweaveService.storeLeaseTerms(terms, {
        leaseId: uuidv4(),
        landlordAddr,
        tenantAddr,
        rent,
        currency,
        deposit,
        startDate,
        endDate
    });

    // Create lease record
    const lease = await leaseService.createLease({
        leaseId: uuidv4(),
        landlordAddr,
        tenantAddr,
        termsHash: termsTxId,
        rent,
        currency,
        deposit,
        startDate,
        endDate
    });

    logLeaseAction('created', lease.leaseId, walletAddress, {
        tenantAddr,
        rent,
        currency,
        deposit
    });

    return {
        leaseId: lease.leaseId,
        arTxId: termsTxId
    };
};

/**
 * Handle lease signing
 */
const handleSignLease = async (payload, walletAddress) => {
    const { error, value } = signLeaseSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { leaseId } = value;

    // Sign the lease
    const result = await leaseService.signLease(leaseId, walletAddress);

    logLeaseAction('signed', leaseId, walletAddress, {
        signatureCount: result.signatureCount,
        status: result.status
    });

    return {
        leaseId,
        signatureCount: result.signatureCount,
        status: result.status
    };
};

/**
 * Handle payment recording
 */
const handleRecordPayment = async (payload, walletAddress) => {
    const { error, value } = recordPaymentSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { leaseId, amount, currency, chainId, txHash } = value;

    // Verify payment on blockchain
    const paymentVerified = await paymentService.verifyPayment(chainId, txHash, amount, currency);
    if (!paymentVerified) {
        throw new ValidationError('Payment verification failed');
    }

    // Store payment receipt on Arweave
    const receiptTxId = await arweaveService.storePaymentReceipt({
        leaseId,
        payer: walletAddress,
        amount,
        currency,
        chainId,
        txHash,
        timestamp: new Date().toISOString()
    });

    // Record payment
    const payment = await paymentService.recordPayment({
        leaseId,
        payer: walletAddress,
        amount,
        currency,
        chainId,
        txHash,
        receiptArweaveTxId: receiptTxId
    });

    logPaymentAction('recorded', leaseId, walletAddress, amount, currency, {
        chainId,
        txHash,
        receiptTxId: receiptTxId
    });

    return {
        leaseId,
        paymentId: payment.id,
        arTxId: receiptTxId
    };
};

/**
 * Handle message posting
 */
const handlePostMessage = async (payload, walletAddress) => {
    const { error, value } = postMessageSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { leaseId, content, threadId } = value;

    // Store message on Arweave
    const messageTxId = await arweaveService.storeMessage({
        leaseId,
        sender: walletAddress,
        content,
        threadId,
        timestamp: new Date().toISOString()
    });

    // Record message
    const message = await communicationService.postMessage({
        leaseId,
        sender: walletAddress,
        content,
        threadId,
        arweaveTxId: messageTxId
    });

    return {
        leaseId,
        messageId: message.id,
        arTxId: messageTxId
    };
};

/**
 * Handle maintenance ticket creation
 */
const handleCreateTicket = async (payload, walletAddress) => {
    const { error, value } = createTicketSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { leaseId, title, description, priority } = value;

    // Store ticket details on Arweave
    const ticketTxId = await arweaveService.storeMaintenanceTicket({
        leaseId,
        title,
        description,
        priority,
        createdBy: walletAddress,
        timestamp: new Date().toISOString()
    });

    // Create ticket
    const ticket = await maintenanceService.createTicket({
        leaseId,
        title,
        description,
        priority,
        createdBy: walletAddress,
        arweaveTxId: ticketTxId
    });

    logMaintenanceAction('created', ticket.id, leaseId, walletAddress, {
        title,
        priority
    });

    return {
        leaseId,
        ticketId: ticket.id,
        arTxId: ticketTxId
    };
};

/**
 * Handle maintenance ticket updates
 */
const handleUpdateTicket = async (payload, walletAddress) => {
    const { error, value } = updateTicketSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { ticketId, status, notes } = value;

    // Update ticket
    const ticket = await maintenanceService.updateTicket(ticketId, {
        status,
        notes,
        updatedBy: walletAddress
    });

    logMaintenanceAction('updated', ticketId, ticket.leaseId, walletAddress, {
        status,
        notes
    });

    return {
        ticketId,
        status: ticket.status
    };
};

/**
 * Handle dispute package building
 */
const handleBuildDisputePackage = async (payload, walletAddress) => {
    const { error, value } = buildDisputePackageSchema.validate(payload);
    if (error) {
        throw handleJoiValidationError(error);
    }

    const { leaseId, evidenceTypes } = value;

    // Build dispute package
    const disputePackage = await disputeService.buildDisputePackage(leaseId, evidenceTypes, walletAddress);

    logDisputeAction('package_built', disputePackage.id, leaseId, walletAddress, {
        evidenceCount: disputePackage.evidenceCount,
        merkleRoot: disputePackage.merkleRoot
    });

    return {
        leaseId,
        disputeId: disputePackage.id,
        merkleRoot: disputePackage.merkleRoot,
        evidenceCount: disputePackage.evidenceCount,
        arTxId: disputePackage.arweaveTxId
    };
};

// Validation schemas
const createLeaseSchema = Joi.object({
    landlordAddr: Joi.string().required(),
    tenantAddr: Joi.string().required(),
    terms: Joi.string().required(),
    rent: Joi.number().positive().required(),
    currency: Joi.string().valid('USDA', 'AR', 'USDC').required(),
    deposit: Joi.number().min(0).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
});

const signLeaseSchema = Joi.object({
    leaseId: Joi.string().uuid().required()
});

const recordPaymentSchema = Joi.object({
    leaseId: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid('USDA', 'AR', 'USDC').required(),
    chainId: Joi.string().required(),
    txHash: Joi.string().required()
});

const postMessageSchema = Joi.object({
    leaseId: Joi.string().uuid().required(),
    content: Joi.string().max(10000).required(),
    threadId: Joi.string().optional()
});

const createTicketSchema = Joi.object({
    leaseId: Joi.string().uuid().required(),
    title: Joi.string().max(200).required(),
    description: Joi.string().max(5000).required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required()
});

const updateTicketSchema = Joi.object({
    ticketId: Joi.string().uuid().required(),
    status: Joi.string().valid('open', 'in-progress', 'resolved', 'closed').required(),
    notes: Joi.string().max(1000).optional()
});

const buildDisputePackageSchema = Joi.object({
    leaseId: Joi.string().uuid().required(),
    evidenceTypes: Joi.array().items(Joi.string().valid('lease', 'payment', 'message', 'ticket')).min(1).required()
});

module.exports = { messageHandler };