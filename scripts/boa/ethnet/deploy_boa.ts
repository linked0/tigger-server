// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOSAGORA } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

async function main() {
    const BOAEthTokenFactory = await ethers.getContractFactory("BOSAGORA");

    // region ETHNET
    const provider_ethnet = ethers.provider;
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_ethnet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const boa_ethnet = (await BOAEthTokenFactory.connect(adminNonceManager).deploy()) as BOSAGORA;
    await boa_ethnet.deployed();
    // endregion

    console.log("BOA-EthNet deployed to:", boa_ethnet.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
