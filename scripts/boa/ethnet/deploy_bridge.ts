// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOATokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const fee_manager_address = process.env.FEE_MANAGER_ADDRESS || "";

    const BOABridgeFactory = await ethers.getContractFactory("BOATokenBridge");

    // region ETHNET
    const timeLock = 60 * 60 * 24;
    const provider_ethnet = ethers.provider;
    const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_ethnet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);
    const bridge_ethnet = (await BOABridgeFactory.connect(adminNonceManager).deploy(
        process.env.BOA_ETHNET_CONTRACT_ADDRESS || "",
        timeLock,
        fee_manager_address,
        true
    )) as BOATokenBridge;
    await bridge_ethnet.deployed();
    // endregion

    console.log("Bridge-EthNet deployed to:", bridge_ethnet.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
