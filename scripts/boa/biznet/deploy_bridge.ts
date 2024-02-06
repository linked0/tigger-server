// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOACoinBridge } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const fee_manager_address = process.env.FEE_MANAGER_ADDRESS || "";

    const BOABridgeFactory = await ethers.getContractFactory("BOACoinBridge");

    // region BIZNET
    const timeLock = 60 * 60 * 24;
    const provider_biznet = ethers.provider;
    const adminSigner_biznet = provider_biznet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_biznet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const bridge_biznet = (await BOABridgeFactory.connect(adminNonceManager).deploy(
        timeLock,
        fee_manager_address,
        false
    )) as BOACoinBridge;
    await bridge_biznet.deployed();
    // endregion

    console.log("Bridge-BizNet deployed to:", bridge_biznet.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
