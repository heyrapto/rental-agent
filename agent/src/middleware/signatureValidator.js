/**
 * Signature validation middleware for AO agent
 * Validates Arweave wallet signatures for secure authentication
 */

const crypto = require('crypto');
const { logger, logSecurityEvent } = require('../utils/logger');
const { config } = require('../config');

/**
 * Validate wallet signature for incoming requests
 */
const signatureValidator = (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Extract required headers
        const walletAddress = req.headers['x-sender-wallet'];
        const signature = req.headers['x-sig'];
        const timestamp = req.headers['x-timestamp'];
        
        // Validate required headers
        if (!walletAddress || !signature || !timestamp) {
            logSecurityEvent('missing_auth_headers', null, req.ip, {
                walletAddress: !!walletAddress,
                signature: !!signature,
                timestamp: !!timestamp
            });
            
            return res.status(401).json({
                ok: false,
                error: 'Missing authentication headers',
                required: ['x-sender-wallet', 'x-sig', 'x-timestamp']
            });
        }

        // Validate wallet address format (Arweave addresses are 43 characters)
        if (!isValidArweaveAddress(walletAddress)) {
            logSecurityEvent('invalid_wallet_address', walletAddress, req.ip, {
                address: walletAddress,
                length: walletAddress.length
            });
            
            return res.status(400).json({
                ok: false,
                error: 'Invalid wallet address format'
            });
        }

        // Validate timestamp to prevent replay attacks
        const requestTime = new Date(timestamp).getTime();
        const currentTime = Date.now();
        const timeDiff = Math.abs(currentTime - requestTime);
        
        if (timeDiff > config.SIGNATURE_EXPIRY) {
            logSecurityEvent('expired_signature', walletAddress, req.ip, {
                requestTime: new Date(requestTime).toISOString(),
                currentTime: new Date(currentTime).toISOString(),
                timeDiff: timeDiff
            });
            
            return res.status(401).json({
                ok: false,
                error: 'Signature expired',
                maxAge: config.SIGNATURE_EXPIRY
            });
        }

        // Validate signature
        if (!validateSignature(req, walletAddress, signature)) {
            logSecurityEvent('invalid_signature', walletAddress, req.ip, {
                signature: signature.substring(0, 20) + '...',
                bodyHash: crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex')
            });
            
            return res.status(401).json({
                ok: false,
                error: 'Invalid signature'
            });
        }

        // Add validated user info to request
        req.user = {
            walletAddress,
            authenticated: true,
            timestamp: requestTime
        };

        const duration = Date.now() - startTime;
        logger.debug('Signature validation completed', {
            walletAddress,
            duration,
            ip: req.ip
        });

        next();

    } catch (error) {
        logSecurityEvent('signature_validation_error', walletAddress, req.ip, {
            error: error.message,
            stack: error.stack
        });
        
        return res.status(500).json({
            ok: false,
            error: 'Signature validation failed'
        });
    }
};

/**
 * Validate Arweave wallet address format
 */
const isValidArweaveAddress = (address) => {
    // Arweave addresses are base64url encoded and 43 characters long
    if (typeof address !== 'string' || address.length !== 43) {
        return false;
    }
    
    // Check if it contains only valid base64url characters
    const validChars = /^[A-Za-z0-9_-]+$/;
    return validChars.test(address);
};

/**
 * Validate the signature against the request data
 */
const validateSignature = (req, walletAddress, signature) => {
    try {
        // Create the message to verify
        const message = createSignatureMessage(req);

        const expected = crypto
        .createHmac("sha256", "mock-secret")
        .update(message + walletAddress)
        .digest("hex");

    console.log("---- SIGNATURE DEBUG ----");
    console.log("Message:", message);
    console.log("Expected:", expected);
    console.log("Got:", signature);
    console.log("-------------------------");
        
        // For now, we'll use a simplified validation
        // In production, this should use proper Arweave signature verification
        if (config.MOCK_ARWEAVE) {
            // Mock validation for testing
            return validateMockSignature(message, signature, walletAddress);
        }
        
        // Real Arweave signature validation would go here
        // This is a placeholder for the actual implementation
        return validateArweaveSignature(message, signature, walletAddress);
        
    } catch (error) {
        logger.error('Signature validation error:', error);
        return false;
    }
};

/**
 * Create the message that was signed
 */
const createSignatureMessage = (req) => {
    const { method, url, body, headers } = req;
    
    // Create a deterministic message string
    const messageParts = [
        method.toUpperCase(),
        url,
        JSON.stringify(body || {}),
        headers['x-timestamp'] || '',
        headers['x-sender-wallet'] || ''
    ];
    
    return messageParts.join('|');
};

/**
 * Mock signature validation for testing
 */
const validateMockSignature = (message, signature, walletAddress) => {
    // In testing mode, accept any signature that looks valid
    if (config.NODE_ENV === 'test') {
        return signature && signature.length > 0;
    }
    
    // For development, create a mock signature
    const expectedSignature = crypto
        .createHmac('sha256', 'mock-secret')
        .update(message + walletAddress)
        .digest('hex');
    
    return signature === expectedSignature;
};

/**
 * Real Arweave signature validation
 */
const validateArweaveSignature = (message, signature, walletAddress) => {
    try {
        // This is where you would implement real Arweave signature verification
        // using the Arweave SDK or similar library
        
        // For now, return false to indicate validation is not implemented
        logger.warn('Real Arweave signature validation not implemented');
        return false;
        
    } catch (error) {
        logger.error('Arweave signature validation error:', error);
        return false;
    }
};

/**
 * Rate limiting for signature validation failures
 */
const signatureFailureRateLimit = new Map();

const checkSignatureFailureRate = (walletAddress, ip) => {
    const key = `${walletAddress}:${ip}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    
    if (!signatureFailureRateLimit.has(key)) {
        signatureFailureRateLimit.set(key, {
            failures: 0,
            firstFailure: now,
            lastFailure: now
        });
    }
    
    const record = signatureFailureRateLimit.get(key);
    record.failures++;
    record.lastFailure = now;
    
    // Reset if outside window
    if (now - record.firstFailure > windowMs) {
        record.failures = 1;
        record.firstFailure = now;
    }
    
    // Block if too many failures
    if (record.failures > 5) {
        logSecurityEvent('signature_failure_rate_limit', walletAddress, ip, {
            failures: record.failures,
            windowMs: windowMs
        });
        return false;
    }
    
    return true;
};

/**
 * Clean up old rate limit records
 */
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [key, record] of signatureFailureRateLimit.entries()) {
        if (now - record.lastFailure > maxAge) {
            signatureFailureRateLimit.delete(key);
        }
    }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = { signatureValidator };