// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Validation.sol";

contract ValidationTest is Test {
    Validation validation;
    address owner = address(0xABCD);
    address user = address(0x1234);

    event TaxPaid(address indexed payer, uint amount, uint tax, uint rest);
    event Withdrawn(address indexed to, uint amount);
    event TaxRateChanged(uint oldRate, uint newRate);

    function setUp() public {
        vm.prank(owner);
        validation = new Validation(10);
    }

    function testInitialTaxRate() public view {
        assertEq(validation.taxRate(), 10);
        assertEq(validation.owner(), owner);
    }

    function testSetTaxRateByOwner() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit TaxRateChanged(10, 20);
        validation.setTaxRate(20);
        assertEq(validation.taxRate(), 20);
    }

    function testCalculateValue() public view {
        uint amount = 1000;
        uint tax = validation.calculateValue(amount);
        assertEq(tax, 100);
    }

    function testPayAndValidate() public {
        vm.deal(user, 1 ether);

        uint expectedTax = (1 ether * 10) / 100;
        uint expectedRest = 1 ether - expectedTax;

        vm.prank(user);
        vm.expectEmit(true, false, false, true);
        emit TaxPaid(user, 1 ether, expectedTax, expectedRest);
        uint rest = validation.payAndValidate{value: 1 ether}();

        assertEq(rest, expectedRest);
        assertEq(owner.balance, expectedTax);
        assertEq(user.balance, expectedRest);
    }

    function testWithdrawWithFunds() public {
        // Send some AVAX to the contract
        vm.deal(address(validation), 1 ether);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(owner, 1 ether);
        validation.withdraw();

        assertEq(owner.balance, 1 ether);
        assertEq(address(validation).balance, 0);
    }

    function test_RevertWhen_WithdrawNoFunds() public {
        vm.prank(owner);
        vm.expectRevert("No funds to withdraw");
        validation.withdraw();
    }

    function test_RevertWhen_NotOwnerSetsTaxRate() public {
        vm.prank(user);
        vm.expectRevert("Not authorized");
        validation.setTaxRate(20);
    }

    function test_RevertWhen_PayAndValidateWithoutValue() public {
        vm.prank(user);
        vm.expectRevert("No AVAX sent");
        validation.payAndValidate();
    }

    function test_RevertWhen_NotOwnerWithdraws() public {
        vm.prank(user);
        vm.expectRevert("Not authorized");
        validation.withdraw();
    }

    function test_RevertWhen_InvalidTaxRateInConstructor() public {
        vm.expectRevert("Invalid tax rate");
        new Validation(101);
    }

    function testTransferOwnership() public {
        address newOwner = address(0x5678);
        vm.prank(owner);
        validation.transferOwnership(newOwner);
        assertEq(validation.owner(), newOwner);
    }

    function test_RevertWhen_TransferOwnershipToZero() public {
        vm.prank(owner);
        vm.expectRevert("Invalid address");
        validation.transferOwnership(address(0));
    }
}