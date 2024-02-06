// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Config } from "../../../src/service/common/Config";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOATokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";
import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const manager = new Wallet(config.bridge.manager_key);

    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/BOATokenBridge.sol/BOATokenBridge.json", "utf8")
    );

    const provider_ethnet = hre.ethers.provider;
    const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_ethnet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const bridge_ethnet = new hre.ethers.Contract(
        process.env.BRIDGE_ETHNET_CONTRACT_ADDRESS || "",
        bridgeArtifact.abi,
        provider_ethnet
    ) as BOATokenBridge;

    console.log("add manager");
    console.log(`admin address: ${admin.address}`);
    console.log(`manager address: ${manager.address}`);
    console.log(`contract address: ${config.bridge.bridge_biznet_address}`);
    const res = await bridge_ethnet.connect(adminNonceManager).addManager(manager.address);
    await res.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
