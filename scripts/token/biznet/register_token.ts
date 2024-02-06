// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Config } from "../../../src/service/common/Config";
import { ContractUtils } from "../../../src/service/contract/ContractUtils";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";
import { HardhatUtils } from "../../../src/service/utils";

import { TestToken, TokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";
import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();
    const manager = new Wallet(config.token_bridge.manager_key);
    const bridge_address = process.env.TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS || "";
    const token_a_address = process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1 || "";
    const token_b_address = process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2 || "";

    const tokenArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TestToken.sol/TestToken.json", "utf8")
    );
    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TokenBridge.sol/TokenBridge.json", "utf8")
    );

    // region BIZNET
    HardhatUtils.insertIntoProvider(hre.network.name, manager.privateKey);

    const provider = hre.ethers.provider;
    const token_a = new hre.ethers.Contract(token_a_address, tokenArtifact.abi, provider) as TestToken;
    const token_b = new hre.ethers.Contract(token_b_address, tokenArtifact.abi, provider) as TestToken;
    const bridge = new hre.ethers.Contract(bridge_address, bridgeArtifact.abi, provider) as TokenBridge;

    const managerSigner = new NonceManager(new GasPriceManager(provider.getSigner(manager.address)));

    const token_id_a = ContractUtils.getTokenId(bridge_address, token_a.address);
    const token_id_b = ContractUtils.getTokenId(bridge_address, token_b.address);
    await bridge.connect(managerSigner).registerToken(token_id_a, token_a.address);
    await bridge.connect(managerSigner).registerToken(token_id_b, token_b.address);
    // endregion
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
