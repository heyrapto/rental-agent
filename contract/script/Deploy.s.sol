// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/RentalContract.sol";
import "../src/USDAAdapter.sol";
import "../src/DisputeResolution.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy RentalContract
        RentalContract rentalContract = new RentalContract(deployer);
        console.log("RentalContract deployed at:", address(rentalContract));

        // Deploy USDAAdapter
        USDAAdapter usdaAdapter = new USDAAdapter(deployer);
        console.log("USDAAdapter deployed at:", address(usdaAdapter));

        // Deploy DisputeResolution
        DisputeResolution disputeResolution = new DisputeResolution(deployer);
        console.log("DisputeResolution deployed at:", address(disputeResolution));

        vm.stopBroadcast();

        // Save deployment addresses
        string memory deploymentInfo = string(abi.encodePacked(
            "Deployment completed successfully!\n\n",
            "RentalContract: ", vm.toString(address(rentalContract)), "\n",
            "USDAAdapter: ", vm.toString(address(usdaAdapter)), "\n",
            "DisputeResolution: ", vm.toString(address(disputeResolution)), "\n\n",
            "Deployer: ", vm.toString(deployer), "\n",
            "Network: ", vm.toString(block.chainid)
        ));

        console.log(deploymentInfo);

        // Write deployment info to file
        vm.writeFile("deployment.txt", deploymentInfo);
    }
}