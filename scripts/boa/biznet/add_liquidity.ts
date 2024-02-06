// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOACoin } from "../../../src/service/common/Amount";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOACoinBridge } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");

    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/BOACoinBridge.sol/BOACoinBridge.json", "utf8")
    );

    const bridge_address = process.env.BRIDGE_BIZNET_CONTRACT_ADDRESS || "";

    // region BIZNET
    const provider_biznet = hre.ethers.provider;
    const adminSigner_biznet = provider_biznet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_biznet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const bridge_biznet = new hre.ethers.Contract(bridge_address, bridgeArtifact.abi, provider_biznet) as BOACoinBridge;

    console.log("increaseLiquidity");
    console.log(`contract address: ${bridge_address}`);
    await bridge_biznet
        .connect(adminNonceManager)
        .increaseLiquidity({ from: admin.address, value: BOACoin.make("100000").value });
    // endregion
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
