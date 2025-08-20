// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RentalContract
 * @dev Manages rental agreements with digital signatures and Arweave integration
 */
contract RentalContract is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    struct Lease {
        string leaseId;
        address landlord;
        address tenant;
        uint256 startDate;
        uint256 endDate;
        uint256 rentAmount;
        uint256 depositAmount;
        string currency;
        string termsHash;
        string arweaveTxId;
        LeaseStatus status;
        mapping(address => bool) signatures;
        uint256 signatureCount;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct Payment {
        string leaseId;
        address payer;
        uint256 amount;
        string currency;
        string chainId;
        string txHash;
        uint256 timestamp;
        string receiptArweaveTxId;
        bool confirmed;
    }

    enum LeaseStatus { DRAFT, ACTIVE, TERMINATED, EXPIRED }

    mapping(string => Lease) public leases;
    mapping(string => Payment[]) public payments;
    mapping(address => string[]) public userLeases;
    
    event LeaseCreated(string indexed leaseId, address indexed landlord, address indexed tenant);
    event LeaseSigned(string indexed leaseId, address indexed signer);
    event LeaseActivated(string indexed leaseId);
    event LeaseTerminated(string indexed leaseId);
    event PaymentRecorded(string indexed leaseId, address indexed payer, uint256 amount);
    event ArweaveUpdated(string indexed leaseId, string arweaveTxId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyLeaseParty(string memory leaseId) {
        Lease storage lease = leases[leaseId];
        require(
            msg.sender == lease.landlord || msg.sender == lease.tenant,
            "Only lease parties can perform this action"
        );
        _;
    }

    modifier onlyLandlord(string memory leaseId) {
        require(msg.sender == leases[leaseId].landlord, "Only landlord can perform this action");
        _;
    }

    modifier leaseExists(string memory leaseId) {
        require(bytes(leases[leaseId].leaseId).length > 0, "Lease does not exist");
        _;
    }

    modifier leaseNotActive(string memory leaseId) {
        require(leases[leaseId].status != LeaseStatus.ACTIVE, "Lease is already active");
        _;
    }

    /**
     * @dev Create a new lease
     */
    function createLease(
        string memory leaseId,
        address tenant,
        uint256 startDate,
        uint256 endDate,
        uint256 rentAmount,
        uint256 depositAmount,
        string memory currency,
        string memory termsHash
    ) external returns (bool) {
        require(bytes(leaseId).length > 0, "Lease ID cannot be empty");
        require(tenant != address(0), "Invalid tenant address");
        require(startDate > block.timestamp, "Start date must be in the future");
        require(endDate > startDate, "End date must be after start date");
        require(rentAmount > 0, "Rent amount must be greater than 0");
        require(depositAmount >= 0, "Deposit amount cannot be negative");
        require(bytes(termsHash).length > 0, "Terms hash cannot be empty");

        Lease storage lease = leases[leaseId];
        require(bytes(lease.leaseId).length == 0, "Lease ID already exists");

        lease.leaseId = leaseId;
        lease.landlord = msg.sender;
        lease.tenant = tenant;
        lease.startDate = startDate;
        lease.endDate = endDate;
        lease.rentAmount = rentAmount;
        lease.depositAmount = depositAmount;
        lease.currency = currency;
        lease.termsHash = termsHash;
        lease.status = LeaseStatus.DRAFT;
        lease.createdAt = block.timestamp;
        lease.updatedAt = block.timestamp;

        userLeases[msg.sender].push(leaseId);
        userLeases[tenant].push(leaseId);

        emit LeaseCreated(leaseId, msg.sender, tenant);
        return true;
    }

    /**
     * @dev Sign a lease (both parties must sign to activate)
     */
    function signLease(string memory leaseId) external leaseExists(leaseId) onlyLeaseParty(leaseId) {
        Lease storage lease = leases[leaseId];
        require(!lease.signatures[msg.sender], "Already signed by this party");
        require(lease.status == LeaseStatus.DRAFT, "Lease is not in draft status");

        lease.signatures[msg.sender] = true;
        lease.signatureCount++;
        lease.updatedAt = block.timestamp;

        emit LeaseSigned(leaseId, msg.sender);

        // Activate lease if both parties have signed
        if (lease.signatureCount == 2) {
            lease.status = LeaseStatus.ACTIVE;
            emit LeaseActivated(leaseId);
        }
    }

    /**
     * @dev Update Arweave transaction ID for lease
     */
    function updateArweaveTx(string memory leaseId, string memory arweaveTxId) 
        external 
        leaseExists(leaseId) 
        onlyLeaseParty(leaseId) 
    {
        require(bytes(arweaveTxId).length > 0, "Arweave TX ID cannot be empty");
        
        leases[leaseId].arweaveTxId = arweaveTxId;
        leases[leaseId].updatedAt = block.timestamp;

        emit ArweaveUpdated(leaseId, arweaveTxId);
    }

    /**
     * @dev Record a payment
     */
    function recordPayment(
        string memory leaseId,
        uint256 amount,
        string memory currency,
        string memory chainId,
        string memory txHash
    ) external leaseExists(leaseId) onlyLeaseParty(leaseId) {
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(chainId).length > 0, "Chain ID cannot be empty");
        require(bytes(txHash).length > 0, "Transaction hash cannot be empty");

        Payment memory payment = Payment({
            leaseId: leaseId,
            payer: msg.sender,
            amount: amount,
            currency: currency,
            chainId: chainId,
            txHash: txHash,
            timestamp: block.timestamp,
            receiptArweaveTxId: "",
            confirmed: false
        });

        payments[leaseId].push(payment);

        emit PaymentRecorded(leaseId, msg.sender, amount);
    }

    /**
     * @dev Confirm payment with Arweave receipt
     */
    function confirmPayment(
        string memory leaseId, 
        uint256 paymentIndex, 
        string memory receiptArweaveTxId
    ) external leaseExists(leaseId) onlyLeaseParty(leaseId) {
        require(paymentIndex < payments[leaseId].length, "Invalid payment index");
        require(bytes(receiptArweaveTxId).length > 0, "Receipt Arweave TX ID cannot be empty");

        Payment storage payment = payments[leaseId][paymentIndex];
        payment.receiptArweaveTxId = receiptArweaveTxId;
        payment.confirmed = true;
    }

    /**
     * @dev Terminate a lease (only landlord can terminate)
     */
    function terminateLease(string memory leaseId) external leaseExists(leaseId) onlyLandlord(leaseId) {
        Lease storage lease = leases[leaseId];
        require(lease.status == LeaseStatus.ACTIVE, "Lease is not active");

        lease.status = LeaseStatus.TERMINATED;
        lease.updatedAt = block.timestamp;

        emit LeaseTerminated(leaseId);
    }

    /**
     * @dev Get lease details
     */
    function getLease(string memory leaseId) external view returns (
        address landlord,
        address tenant,
        uint256 startDate,
        uint256 endDate,
        uint256 rentAmount,
        uint256 depositAmount,
        string memory currency,
        string memory termsHash,
        string memory arweaveTxId,
        LeaseStatus status,
        uint256 signatureCount,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        Lease storage lease = leases[leaseId];
        require(bytes(lease.leaseId).length > 0, "Lease does not exist");

        return (
            lease.landlord,
            lease.tenant,
            lease.startDate,
            lease.endDate,
            lease.rentAmount,
            lease.depositAmount,
            lease.currency,
            lease.termsHash,
            lease.arweaveTxId,
            lease.status,
            lease.signatureCount,
            lease.createdAt,
            lease.updatedAt
        );
    }

    /**
     * @dev Check if a party has signed a lease
     */
    function hasSigned(string memory leaseId, address party) external view returns (bool) {
        return leases[leaseId].signatures[party];
    }

    /**
     * @dev Get all payments for a lease
     */
    function getPayments(string memory leaseId) external view returns (Payment[] memory) {
        return payments[leaseId];
    }

    /**
     * @dev Get all leases for a user
     */
    function getUserLeases(address user) external view returns (string[] memory) {
        return userLeases[user];
    }

    /**
     * @dev Check if lease is expired
     */
    function isLeaseExpired(string memory leaseId) external view returns (bool) {
        Lease storage lease = leases[leaseId];
        return lease.status == LeaseStatus.ACTIVE && block.timestamp > lease.endDate;
    }
}