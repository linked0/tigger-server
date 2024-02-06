// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { TestToken } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

async function main() {
    const TokenFactory = await ethers.getContractFactory("TestToken");

    // region ETHNET
    const provider = ethers.provider;
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const adminSigner = provider.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const token_a = (await TokenFactory.connect(adminNonceManager).deploy("Sample Token A", "SMA", 10)) as TestToken;
    await token_a.deployed();

    const token_b = (await TokenFactory.connect(adminNonceManager).deploy("Sample Token B", "SMB", 10)) as TestToken;
    await token_a.deployed();
    // endregion

    console.log("Token A deployed to:", token_a.address);
    console.log("Token B deployed to:", token_b.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
