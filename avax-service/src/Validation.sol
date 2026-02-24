// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Validation {
    address public owner;
    uint public taxRate;
    bool private _locked;

    event TaxPaid(address indexed payer, uint amount, uint tax, uint rest);
    event Withdrawn(address indexed to, uint amount);
    event TaxRateChanged(uint oldRate, uint newRate);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(uint _taxRate) {
        require(_taxRate <= 100, "Invalid tax rate");
        owner = msg.sender;
        taxRate = _taxRate;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    function setTaxRate(uint _taxRate) external onlyOwner {
        require(_taxRate <= 100, "Invalid tax rate");
        uint oldRate = taxRate;
        taxRate = _taxRate;
        emit TaxRateChanged(oldRate, _taxRate);
    }

    function calculateValue(uint amount) public view returns (uint) {
        return (amount * taxRate) / 100;
    }

    function payAndValidate() external payable nonReentrant returns (uint rest) {
        require(msg.value > 0, "No AVAX sent");

        uint tax = calculateValue(msg.value);
        rest = msg.value - tax;

        // Checks-effects-interactions: emit event before external calls
        emit TaxPaid(msg.sender, msg.value, tax, rest);

        // Use call instead of transfer (2300 gas limit can fail with smart wallets)
        (bool sentTax, ) = payable(owner).call{value: tax}("");
        require(sentTax, "Tax transfer failed");

        (bool sentRest, ) = payable(msg.sender).call{value: rest}("");
        require(sentRest, "Rest transfer failed");
    }

    function withdraw() external onlyOwner nonReentrant {
        uint balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        emit Withdrawn(owner, balance);

        (bool sent, ) = payable(owner).call{value: balance}("");
        require(sent, "Withdraw failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}