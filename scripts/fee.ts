// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import * as hre from "hardhat";

async function main() {
    const block = await hre.ethers.provider.getBlock("latest");
    const baseFeePerGas = block.baseFeePerGas != null ? block.baseFeePerGas.toNumber() : 0;
    const maxPriorityFeePerGas = 1500000000;
    const maxFeePerGas = Math.floor(baseFeePerGas * 1.265625) + maxPriorityFeePerGas;

    console.log("baseFeePerGas:", baseFeePerGas);
    console.log("maxFeePerGas:", maxFeePerGas);
    console.log("maxPriorityFeePerGas", maxPriorityFeePerGas);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
