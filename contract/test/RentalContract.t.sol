// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/RentalContract.sol";

contract RentalContractTest is Test {
    RentalContract public rentalContract;
    
    address public landlord;
    address public tenant;
    address public unauthorized;
    
    string public constant LEASE_ID = "lease-123";
    string public constant TERMS_HASH = "QmHash123";
    string public constant ARWEAVE_TX = "arweave-tx-123";
    
    uint256 public startDate;
    uint256 public endDate;
    uint256 public rentAmount = 1000;
    uint256 public depositAmount = 2000;

    event LeaseCreated(string indexed leaseId, address indexed landlord, address indexed tenant);
    event LeaseSigned(string indexed leaseId, address indexed signer);
    event LeaseActivated(string indexed leaseId);
    event PaymentRecorded(string indexed leaseId, address indexed payer, uint256 amount);

    function setUp() public {
        landlord = makeAddr("landlord");
        tenant = makeAddr("tenant");
        unauthorized = makeAddr("unauthorized");
        
        startDate = block.timestamp + 1 days;
        endDate = block.timestamp + 365 days;
        
        rentalContract = new RentalContract(address(this));
    }

    function testCreateLease() public {
        vm.startPrank(landlord);
        
        vm.expectEmit(true, true, true, true);
        emit LeaseCreated(LEASE_ID, landlord, tenant);
        
        bool success = rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        assertTrue(success);
        
        // Verify lease was created
        (
            address actualLandlord,
            address actualTenant,
            uint256 actualStartDate,
            uint256 actualEndDate,
            uint256 actualRentAmount,
            uint256 actualDepositAmount,
            string memory actualCurrency,
            string memory actualTermsHash,
            string memory actualArweaveTxId,
            RentalContract.LeaseStatus actualStatus,
            uint256 actualSignatureCount,
            uint256 actualCreatedAt,
            uint256 actualUpdatedAt
        ) = rentalContract.getLease(LEASE_ID);
        
        assertEq(actualLandlord, landlord);
        assertEq(actualTenant, tenant);
        assertEq(actualStartDate, startDate);
        assertEq(actualEndDate, endDate);
        assertEq(actualRentAmount, rentAmount);
        assertEq(actualDepositAmount, depositAmount);
        assertEq(actualCurrency, "USDA");
        assertEq(actualTermsHash, TERMS_HASH);
        assertEq(actualArweaveTxId, "");
        assertEq(uint256(actualStatus), uint256(RentalContract.LeaseStatus.DRAFT));
        assertEq(actualSignatureCount, 0);
        assertEq(actualCreatedAt, block.timestamp);
        assertEq(actualUpdatedAt, block.timestamp);
        
        vm.stopPrank();
    }

    function testCreateLeaseInvalidInputs() public {
        vm.startPrank(landlord);
        
        // Test empty lease ID
        vm.expectRevert("Lease ID cannot be empty");
        rentalContract.createLease(
            "",
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Test invalid tenant address
        vm.expectRevert("Invalid tenant address");
        rentalContract.createLease(
            LEASE_ID,
            address(0),
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Test start date in the past
        vm.expectRevert("Start date must be in the future");
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            block.timestamp - 1 days,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Test end date before start date
        vm.expectRevert("End date must be after start date");
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            startDate - 1 days,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Test zero rent amount
        vm.expectRevert("Rent amount must be greater than 0");
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            0,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Test zero deposit amount (should be valid)
        bool success = rentalContract.createLease(
            "test_zero_deposit",
            tenant,
            startDate,
            endDate,
            rentAmount,
            0,
            "USDA",
            TERMS_HASH
        );
        assertTrue(success);
        
        // Test empty terms hash
        vm.expectRevert("Terms hash cannot be empty");
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            ""
        );
        
        vm.stopPrank();
    }

    function testCreateLeaseDuplicateId() public {
        vm.startPrank(landlord);
        
        // Create first lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Try to create duplicate
        vm.expectRevert("Lease ID already exists");
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
    }

    function testSignLease() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Landlord signs
        vm.startPrank(landlord);
        vm.expectEmit(true, true, false, true);
        emit LeaseSigned(LEASE_ID, landlord);
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        // Verify signature count
        (,,,,,,,,,, uint256 signatureCount,,) = rentalContract.getLease(LEASE_ID);
        assertEq(signatureCount, 1);
        
        // Tenant signs
        vm.startPrank(tenant);
        vm.expectEmit(true, true, false, true);
        emit LeaseSigned(LEASE_ID, tenant);
        vm.expectEmit(true, false, false, true);
        emit LeaseActivated(LEASE_ID);
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        // Verify lease is now active
        (,,,,,,,,, RentalContract.LeaseStatus status,,,) = rentalContract.getLease(LEASE_ID);
        assertEq(uint256(status), uint256(RentalContract.LeaseStatus.ACTIVE));
        
        // Verify signature count
        (,,,,,,,,,, signatureCount,,) = rentalContract.getLease(LEASE_ID);
        assertEq(signatureCount, 2);
    }

    function testSignLeaseUnauthorized() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Unauthorized user tries to sign
        vm.startPrank(unauthorized);
        vm.expectRevert("Only lease parties can perform this action");
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
    }

    function testSignLeaseAlreadySigned() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Sign once
        rentalContract.signLease(LEASE_ID);
        
        // Try to sign again
        vm.expectRevert("Already signed by this party");
        rentalContract.signLease(LEASE_ID);
        
        vm.stopPrank();
    }

    function testUpdateArweaveTx() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Update Arweave TX
        rentalContract.updateArweaveTx(LEASE_ID, ARWEAVE_TX);
        
        // Verify update
        (,,,,,,,, string memory arweaveTxId,,,,) = rentalContract.getLease(LEASE_ID);
        assertEq(arweaveTxId, ARWEAVE_TX);
        
        vm.stopPrank();
    }

    function testRecordPayment() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Tenant records payment
        vm.startPrank(tenant);
        vm.expectEmit(true, true, false, true);
        emit PaymentRecorded(LEASE_ID, tenant, rentAmount);
        rentalContract.recordPayment(
            LEASE_ID,
            rentAmount,
            "USDA",
            "ethereum-mainnet",
            "0x1234567890abcdef"
        );
        vm.stopPrank();
        
        // Verify payment was recorded
        RentalContract.Payment[] memory payments = rentalContract.getPayments(LEASE_ID);
        assertEq(payments.length, 1);
        assertEq(payments[0].leaseId, LEASE_ID);
        assertEq(payments[0].payer, tenant);
        assertEq(payments[0].amount, rentAmount);
        assertEq(payments[0].currency, "USDA");
        assertEq(payments[0].chainId, "ethereum-mainnet");
        assertEq(payments[0].txHash, "0x1234567890abcdef");
        assertEq(payments[0].confirmed, false);
    }

    function testConfirmPayment() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Tenant records payment
        vm.startPrank(tenant);
        rentalContract.recordPayment(
            LEASE_ID,
            rentAmount,
            "USDA",
            "ethereum-mainnet",
            "0x1234567890abcdef"
        );
        vm.stopPrank();
        
        // Confirm payment
        vm.startPrank(tenant);
        rentalContract.confirmPayment(LEASE_ID, 0, ARWEAVE_TX);
        vm.stopPrank();
        
        // Verify payment is confirmed
        RentalContract.Payment[] memory payments = rentalContract.getPayments(LEASE_ID);
        assertEq(payments[0].confirmed, true);
        assertEq(payments[0].receiptArweaveTxId, ARWEAVE_TX);
    }

    function testTerminateLease() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Activate lease
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        vm.startPrank(tenant);
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        // Terminate lease
        vm.startPrank(landlord);
        rentalContract.terminateLease(LEASE_ID);
        vm.stopPrank();
        
        // Verify lease is terminated
        (,,,,,,,,, RentalContract.LeaseStatus status,,,) = rentalContract.getLease(LEASE_ID);
        assertEq(uint256(status), uint256(RentalContract.LeaseStatus.TERMINATED));
    }

    function testTerminateLeaseUnauthorized() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Tenant tries to terminate
        vm.startPrank(tenant);
        vm.expectRevert("Only landlord can perform this action");
        rentalContract.terminateLease(LEASE_ID);
        vm.stopPrank();
    }

    function testGetUserLeases() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        vm.stopPrank();
        
        // Get user leases
        string[] memory landlordLeases = rentalContract.getUserLeases(landlord);
        string[] memory tenantLeases = rentalContract.getUserLeases(tenant);
        
        assertEq(landlordLeases.length, 1);
        assertEq(landlordLeases[0], LEASE_ID);
        assertEq(tenantLeases.length, 1);
        assertEq(tenantLeases[0], LEASE_ID);
    }

    function testHasSigned() public {
        vm.startPrank(landlord);
        
        // Create lease
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            endDate,
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Check signatures before signing
        assertFalse(rentalContract.hasSigned(LEASE_ID, landlord));
        assertFalse(rentalContract.hasSigned(LEASE_ID, tenant));
        
        // Landlord signs
        rentalContract.signLease(LEASE_ID);
        
        // Check signatures after signing
        assertTrue(rentalContract.hasSigned(LEASE_ID, landlord));
        assertFalse(rentalContract.hasSigned(LEASE_ID, tenant));
        
        vm.stopPrank();
    }

    function testIsLeaseExpired() public {
        vm.startPrank(landlord);
        
        // Create lease with past end date
        rentalContract.createLease(
            LEASE_ID,
            tenant,
            startDate,
            block.timestamp - 1 days, // Past end date
            rentAmount,
            depositAmount,
            "USDA",
            TERMS_HASH
        );
        
        // Activate lease
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        vm.startPrank(tenant);
        rentalContract.signLease(LEASE_ID);
        vm.stopPrank();
        
        // Check if expired
        assertTrue(rentalContract.isLeaseExpired(LEASE_ID));
    }
}
