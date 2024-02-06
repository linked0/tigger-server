// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { TokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");

    const TokenBridgeFactory = await ethers.getContractFactory("TokenBridge");

    // region BIZNET
    const timeLock = 60 * 60 * 24;
    const provider = ethers.provider;
    const adminSigner = provider.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const bridge = (await TokenBridgeFactory.connect(adminNonceManager).deploy(timeLock)) as TokenBridge;
    await bridge.deployed();
    // endregion

    console.log("Bridge-BizNet deployed to:", bridge.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
