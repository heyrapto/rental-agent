// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title DisputeResolution
 * @dev Manages dispute evidence collection and Merkle root generation
 */
contract DisputeResolution is ReentrancyGuard, Ownable {
    using MerkleProof for bytes32[];

    struct DisputePackage {
        string leaseId;
        string merkleRoot;
        string[] evidenceTxIds;
        uint256 createdAt;
        uint256 expiresAt;
        bool resolved;
        string resolution;
        address resolver;
        uint256 resolutionTimestamp;
    }

    struct Evidence {
        string leaseId;
        string evidenceId;
        string evidenceType; // lease, payment, message, ticket
        string arweaveTxId;
        string contentHash;
        uint256 timestamp;
        address submittedBy;
        bool verified;
    }

    mapping(string => DisputePackage) public disputePackages;
    mapping(string => Evidence[]) public leaseEvidence;
    mapping(string => string[]) public leaseDisputes;
    mapping(address => string[]) public userDisputes;
    
    uint256 public disputeExpiryDays = 30;
    uint256 public minEvidenceCount = 3;
    uint256 public maxEvidenceCount = 100;
    
    event DisputePackageCreated(string indexed leaseId, string indexed disputeId, string merkleRoot);
    event EvidenceAdded(string indexed leaseId, string indexed evidenceId, string evidenceType);
    event EvidenceVerified(string indexed leaseId, string indexed evidenceId);
    event DisputeResolved(string indexed leaseId, string indexed disputeId, string resolution);
    event DisputeExpired(string indexed leaseId, string indexed disputeId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyLeaseParty(string memory leaseId) {
        // This would need to be integrated with the RentalContract to verify lease parties
        _;
    }

    modifier disputeExists(string memory disputeId) {
        require(bytes(disputePackages[disputeId].leaseId).length > 0, "Dispute does not exist");
        _;
    }

    modifier disputeNotResolved(string memory disputeId) {
        require(!disputePackages[disputeId].resolved, "Dispute already resolved");
        _;
    }

    modifier disputeNotExpired(string memory disputeId) {
        require(block.timestamp < disputePackages[disputeId].expiresAt, "Dispute has expired");
        _;
    }

    /**
     * @dev Create a new dispute package
     */
    function createDisputePackage(
        string memory leaseId,
        string[] memory evidenceTxIds
    ) external returns (string memory) {
        require(bytes(leaseId).length > 0, "Lease ID cannot be empty");
        require(evidenceTxIds.length >= minEvidenceCount, "Insufficient evidence");
        require(evidenceTxIds.length <= maxEvidenceCount, "Too much evidence");

        string memory disputeId = _generateDisputeId(leaseId);
        require(bytes(disputePackages[disputeId].leaseId).length == 0, "Dispute already exists");

        // Generate Merkle root from evidence
        bytes32[] memory leaves = new bytes32[](evidenceTxIds.length);
        for (uint256 i = 0; i < evidenceTxIds.length; i++) {
            leaves[i] = keccak256(abi.encodePacked(evidenceTxIds[i]));
        }
        bytes32 merkleRoot = _generateMerkleRoot(leaves);

        DisputePackage storage dispute = disputePackages[disputeId];
        dispute.leaseId = leaseId;
        dispute.merkleRoot = _bytes32ToString(merkleRoot);
        dispute.evidenceTxIds = evidenceTxIds;
        dispute.createdAt = block.timestamp;
        dispute.expiresAt = block.timestamp + (disputeExpiryDays * 1 days);
        dispute.resolved = false;
        dispute.resolution = "";
        dispute.resolver = address(0);
        dispute.resolutionTimestamp = 0;

        leaseDisputes[leaseId].push(disputeId);
        userDisputes[msg.sender].push(disputeId);

        emit DisputePackageCreated(leaseId, disputeId, dispute.merkleRoot);
        return disputeId;
    }

    /**
     * @dev Add evidence to a lease
     */
    function addEvidence(
        string memory leaseId,
        string memory evidenceType,
        string memory arweaveTxId,
        string memory contentHash
    ) external returns (string memory) {
        require(bytes(leaseId).length > 0, "Lease ID cannot be empty");
        require(bytes(evidenceType).length > 0, "Evidence type cannot be empty");
        require(bytes(arweaveTxId).length > 0, "Arweave TX ID cannot be empty");
        require(bytes(contentHash).length > 0, "Content hash cannot be empty");

        string memory evidenceId = _generateEvidenceId(leaseId, evidenceType);
        
        Evidence memory evidence = Evidence({
            leaseId: leaseId,
            evidenceId: evidenceId,
            evidenceType: evidenceType,
            arweaveTxId: arweaveTxId,
            contentHash: contentHash,
            timestamp: block.timestamp,
            submittedBy: msg.sender,
            verified: false
        });

        leaseEvidence[leaseId].push(evidence);

        emit EvidenceAdded(leaseId, evidenceId, evidenceType);
        return evidenceId;
    }

    /**
     * @dev Verify evidence (owner or authorized party)
     */
    function verifyEvidence(string memory leaseId, string memory evidenceId) external onlyOwner {
        Evidence[] storage evidenceList = leaseEvidence[leaseId];
        for (uint256 i = 0; i < evidenceList.length; i++) {
            if (keccak256(abi.encodePacked(evidenceList[i].evidenceId)) == keccak256(abi.encodePacked(evidenceId))) {
                evidenceList[i].verified = true;
                emit EvidenceVerified(leaseId, evidenceId);
                break;
            }
        }
    }

    /**
     * @dev Resolve a dispute
     */
    function resolveDispute(
        string memory disputeId,
        string memory resolution
    ) external onlyOwner disputeExists(disputeId) disputeNotResolved(disputeId) {
        require(bytes(resolution).length > 0, "Resolution cannot be empty");

        DisputePackage storage dispute = disputePackages[disputeId];
        dispute.resolved = true;
        dispute.resolution = resolution;
        dispute.resolver = msg.sender;
        dispute.resolutionTimestamp = block.timestamp;

        emit DisputeResolved(dispute.leaseId, disputeId, resolution);
    }

    /**
     * @dev Check if evidence is included in dispute package
     */
    function verifyEvidenceInDispute(
        string memory disputeId,
        string memory evidenceTxId,
        bytes32[] memory proof
    ) external view returns (bool) {
        DisputePackage storage dispute = disputePackages[disputeId];
        require(bytes(dispute.leaseId).length > 0, "Dispute does not exist");

        bytes32 leaf = keccak256(abi.encodePacked(evidenceTxId));
        bytes32 root = _stringToBytes32(dispute.merkleRoot);

        return proof.verify(root, leaf);
    }

    /**
     * @dev Get dispute package details
     */
    function getDisputePackage(string memory disputeId) external view returns (
        string memory leaseId,
        string memory merkleRoot,
        string[] memory evidenceTxIds,
        uint256 createdAt,
        uint256 expiresAt,
        bool resolved,
        string memory resolution,
        address resolver,
        uint256 resolutionTimestamp
    ) {
        DisputePackage storage dispute = disputePackages[disputeId];
        require(bytes(dispute.leaseId).length > 0, "Dispute does not exist");

        return (
            dispute.leaseId,
            dispute.merkleRoot,
            dispute.evidenceTxIds,
            dispute.createdAt,
            dispute.expiresAt,
            dispute.resolved,
            dispute.resolution,
            dispute.resolver,
            dispute.resolutionTimestamp
        );
    }

    /**
     * @dev Get all evidence for a lease
     */
    function getLeaseEvidence(string memory leaseId) external view returns (Evidence[] memory) {
        return leaseEvidence[leaseId];
    }

    /**
     * @dev Get all disputes for a lease
     */
    function getLeaseDisputes(string memory leaseId) external view returns (string[] memory) {
        return leaseDisputes[leaseId];
    }

    /**
     * @dev Get all disputes for a user
     */
    function getUserDisputes(address user) external view returns (string[] memory) {
        return userDisputes[user];
    }

    /**
     * @dev Update dispute expiry period (owner only)
     */
    function updateDisputeExpiryDays(uint256 newExpiryDays) external onlyOwner {
        require(newExpiryDays >= 7 && newExpiryDays <= 365, "Expiry must be between 7 and 365 days");
        disputeExpiryDays = newExpiryDays;
    }

    /**
     * @dev Update evidence count limits (owner only)
     */
    function updateEvidenceLimits(uint256 minCount, uint256 maxCount) external onlyOwner {
        require(minCount >= 1, "Min count must be at least 1");
        require(maxCount <= 1000, "Max count cannot exceed 1000");
        require(minCount < maxCount, "Min count must be less than max count");
        
        minEvidenceCount = minCount;
        maxEvidenceCount = maxCount;
    }

    /**
     * @dev Generate Merkle root from leaves
     */
    function _generateMerkleRoot(bytes32[] memory leaves) internal pure returns (bytes32) {
        if (leaves.length == 0) return bytes32(0);
        if (leaves.length == 1) return leaves[0];

        bytes32[] memory currentLevel = leaves;
        while (currentLevel.length > 1) {
            bytes32[] memory nextLevel = new bytes32[]((currentLevel.length + 1) / 2);
            
            for (uint256 i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel[i / 2] = keccak256(abi.encodePacked(currentLevel[i], currentLevel[i + 1]));
                } else {
                    nextLevel[i / 2] = currentLevel[i];
                }
            }
            
            currentLevel = nextLevel;
        }
        
        return currentLevel[0];
    }

    /**
     * @dev Generate unique dispute ID
     */
    function _generateDisputeId(string memory leaseId) internal view returns (string memory) {
        return string(abi.encodePacked(
            leaseId,
            "-",
            _uint2str(block.timestamp),
            "-",
            _uint2str(uint256(uint160(msg.sender)))
        ));
    }

    /**
     * @dev Generate unique evidence ID
     */
    function _generateEvidenceId(string memory leaseId, string memory evidenceType) internal view returns (string memory) {
        return string(abi.encodePacked(
            leaseId,
            "-",
            evidenceType,
            "-",
            _uint2str(block.timestamp),
            "-",
            _uint2str(uint256(uint160(msg.sender)))
        ));
    }

    /**
     * @dev Convert uint to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        
        uint256 j = _i;
        uint256 length;
        
        while (j != 0) {
            length++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        
        while (_i != 0) {
            k -= 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        
        return string(bstr);
    }

    /**
     * @dev Convert bytes32 to string
     */
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        bytes memory bytesArray = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }

    /**
     * @dev Convert string to bytes32
     */
    function _stringToBytes32(string memory source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(source, 32))
        }
    }
}