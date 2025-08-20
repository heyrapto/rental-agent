// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title USDAAdapter
 * @dev Adapter for USDA stablecoin payments and escrow management
 */
contract USDAAdapter is ReentrancyGuard, Ownable, Pausable {
    using ECDSA for bytes32;

    struct Escrow {
        string leaseId;
        address tenant;
        address landlord;
        uint256 amount;
        uint256 createdAt;
        uint256 releaseDate;
        bool released;
        string releaseReason;
    }

    struct PaymentVerification {
        string leaseId;
        string txHash;
        uint256 amount;
        uint256 timestamp;
        bool verified;
        string verificationProof;
    }

    mapping(string => Escrow) public escrows;
    mapping(string => PaymentVerification) public paymentVerifications;
    mapping(address => string[]) public userEscrows;
    
    uint256 public escrowFee = 25; // 0.25% fee (basis points)
    uint256 public minEscrowAmount = 100 * 10**6; // 100 USDA (6 decimals)
    uint256 public maxEscrowAmount = 10000 * 10**6; // 10,000 USDA (6 decimals)
    
    event EscrowCreated(string indexed leaseId, address indexed tenant, uint256 amount);
    event EscrowReleased(string indexed leaseId, address indexed recipient, uint256 amount, string reason);
    event PaymentVerified(string indexed leaseId, string indexed txHash, uint256 amount);
    event EscrowFeeUpdated(uint256 newFee);
    event EscrowLimitsUpdated(uint256 minAmount, uint256 maxAmount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyLeaseParty(string memory leaseId) {
        Escrow storage escrow = escrows[leaseId];
        require(
            msg.sender == escrow.landlord || msg.sender == escrow.tenant,
            "Only lease parties can perform this action"
        );
        _;
    }

    modifier escrowExists(string memory leaseId) {
        require(bytes(escrows[leaseId].leaseId).length > 0, "Escrow does not exist");
        _;
    }

    modifier escrowNotReleased(string memory leaseId) {
        require(!escrows[leaseId].released, "Escrow already released");
        _;
    }

    /**
     * @dev Create an escrow for security deposit
     */
    function createEscrow(
        string memory leaseId,
        address tenant,
        address landlord,
        uint256 amount
    ) external payable returns (bool) {
        require(bytes(leaseId).length > 0, "Lease ID cannot be empty");
        require(tenant != address(0), "Invalid tenant address");
        require(landlord != address(0), "Invalid landlord address");
        require(amount >= minEscrowAmount, "Amount below minimum");
        require(amount <= maxEscrowAmount, "Amount above maximum");
        require(msg.value == amount, "Incorrect payment amount");
        require(bytes(escrows[leaseId].leaseId).length == 0, "Escrow already exists");

        Escrow storage escrow = escrows[leaseId];
        escrow.leaseId = leaseId;
        escrow.tenant = tenant;
        escrow.landlord = landlord;
        escrow.amount = amount;
        escrow.createdAt = block.timestamp;
        escrow.releaseDate = 0;
        escrow.released = false;
        escrow.releaseReason = "";

        userEscrows[tenant].push(leaseId);
        userEscrows[landlord].push(leaseId);

        emit EscrowCreated(leaseId, tenant, amount);
        return true;
    }

    /**
     * @dev Release escrow funds
     */
    function releaseEscrow(
        string memory leaseId,
        address recipient,
        uint256 amount,
        string memory reason
    ) external onlyLeaseParty(leaseId) escrowExists(leaseId) escrowNotReleased(leaseId) {
        Escrow storage escrow = escrows[leaseId];
        require(recipient == escrow.tenant || recipient == escrow.landlord, "Invalid recipient");
        require(amount <= escrow.amount, "Amount exceeds escrow balance");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        escrow.released = true;
        escrow.releaseDate = block.timestamp;
        escrow.releaseReason = reason;

        // Calculate fee
        uint256 fee = (amount * escrowFee) / 10000;
        uint256 netAmount = amount - fee;

        // Transfer funds
        (bool success, ) = recipient.call{value: netAmount}("");
        require(success, "Transfer failed");

        // Transfer fee to owner
        if (fee > 0) {
            (bool feeSuccess, ) = owner().call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        emit EscrowReleased(leaseId, recipient, netAmount, reason);
    }

    /**
     * @dev Verify a payment transaction
     */
    function verifyPayment(
        string memory leaseId,
        string memory txHash,
        uint256 amount,
        string memory verificationProof
    ) external onlyOwner returns (bool) {
        require(bytes(leaseId).length > 0, "Lease ID cannot be empty");
        require(bytes(txHash).length > 0, "Transaction hash cannot be empty");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(verificationProof).length > 0, "Verification proof cannot be empty");

        PaymentVerification storage verification = paymentVerifications[leaseId];
        verification.leaseId = leaseId;
        verification.txHash = txHash;
        verification.amount = amount;
        verification.timestamp = block.timestamp;
        verification.verified = true;
        verification.verificationProof = verificationProof;

        emit PaymentVerified(leaseId, txHash, amount);
        return true;
    }

    /**
     * @dev Get escrow details
     */
    function getEscrow(string memory leaseId) external view returns (
        address tenant,
        address landlord,
        uint256 amount,
        uint256 createdAt,
        uint256 releaseDate,
        bool released,
        string memory releaseReason
    ) {
        Escrow storage escrow = escrows[leaseId];
        require(bytes(escrow.leaseId).length > 0, "Escrow does not exist");

        return (
            escrow.tenant,
            escrow.landlord,
            escrow.amount,
            escrow.createdAt,
            escrow.releaseDate,
            escrow.released,
            escrow.releaseReason
        );
    }

    /**
     * @dev Get payment verification details
     */
    function getPaymentVerification(string memory leaseId) external view returns (
        string memory txHash,
        uint256 amount,
        uint256 timestamp,
        bool verified,
        string memory verificationProof
    ) {
        PaymentVerification storage verification = paymentVerifications[leaseId];
        require(bytes(verification.leaseId).length > 0, "Payment verification does not exist");

        return (
            verification.txHash,
            verification.amount,
            verification.timestamp,
            verification.verified,
            verification.verificationProof
        );
    }

    /**
     * @dev Get all escrows for a user
     */
    function getUserEscrows(address user) external view returns (string[] memory) {
        return userEscrows[user];
    }

    /**
     * @dev Update escrow fee (owner only)
     */
    function updateEscrowFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        escrowFee = newFee;
        emit EscrowFeeUpdated(newFee);
    }

    /**
     * @dev Update escrow limits (owner only)
     */
    function updateEscrowLimits(uint256 minAmount, uint256 maxAmount) external onlyOwner {
        require(minAmount < maxAmount, "Min amount must be less than max amount");
        minEscrowAmount = minAmount;
        maxEscrowAmount = maxAmount;
        emit EscrowLimitsUpdated(minAmount, maxAmount);
    }

    /**
     * @dev Withdraw accumulated fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = owner().call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }

    /**
     * @dev Emergency pause (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Emergency unpause (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}