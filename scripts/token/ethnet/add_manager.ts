// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Config } from "../../../src/service/common/Config";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { TokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";
import path from "path";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const manager = new Wallet(config.token_bridge.manager_key);

    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TokenBridge.sol/TokenBridge.json", "utf8")
    );

    const bridge_address = process.env.TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS || "";
    const provider = hre.ethers.provider;
    const adminSigner = provider.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const bridge = new hre.ethers.Contract(bridge_address, bridgeArtifact.abi, provider) as TokenBridge;

    console.log("add manager");
    console.log(`admin address: ${admin.address}`);
    console.log(`manager address: ${manager.address}`);
    console.log(`contract address: ${bridge_address}`);
    const res = await bridge.connect(adminNonceManager).addManager(manager.address);
    await res.wait();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
