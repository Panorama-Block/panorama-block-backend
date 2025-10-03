// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Validation.sol";

contract DeployValidationScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy Validation contract with 10% tax rate
        Validation validation = new Validation(10);
        
        console.log("Validation contract deployed at:", address(validation));
        console.log("Owner:", validation.owner());
        console.log("Initial tax rate:", validation.taxRate());
        console.log("");
        console.log("Add this to your .env file:");
        console.log("VALIDATION_CONTRACT_ADDRESS=%s", address(validation));

        vm.stopBroadcast();
    }
}
