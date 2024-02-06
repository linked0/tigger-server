// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Amount, BOAToken } from "../../../src/service/common/Amount";
import { ContractUtils } from "../../../src/service/contract/ContractUtils";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { TestToken, TokenBridge } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";

async function main() {
    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const bridge_address = process.env.TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS || "";
    const token_address_a = process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1 || "";
    const token_address_b = process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2 || "";

    const tokenArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TestToken.sol/TestToken.json", "utf8")
    );
    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TokenBridge.sol/TokenBridge.json", "utf8")
    );

    // region ETHNET
    const provider = ethers.provider;
    const token_a = new ethers.Contract(token_address_a, tokenArtifact.abi, provider) as TestToken;
    const token_b = new ethers.Contract(token_address_b, tokenArtifact.abi, provider) as TestToken;

    const bridge = new ethers.Contract(bridge_address, bridgeArtifact.abi, provider) as TokenBridge;

    const adminSigner = provider.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    let decimal = await token_a.decimal();
    let amount = Amount.make("100000", decimal).value;
    let allowance_amount = await token_a.allowance(admin.address, bridge.address);
    if (allowance_amount.lt(amount)) {
        console.log("Approve");
        await token_a.connect(adminNonceManager).approve(bridge.address, amount);
        await ContractUtils.waitingForAllowance(token_a, admin.address, bridge.address, amount);
    }
    const tokenId_a = ContractUtils.getTokenId(bridge.address, token_a.address);
    console.log("increaseLiquidity");
    console.log(`contract address: ${bridge.address}`);
    await bridge.connect(adminNonceManager).increaseLiquidity(tokenId_a, amount);

    decimal = await token_b.decimal();
    amount = Amount.make("100000", decimal).value;
    allowance_amount = await token_b.allowance(admin.address, bridge.address);
    if (allowance_amount.lt(amount)) {
        console.log("Approve");
        await token_b.connect(adminNonceManager).approve(bridge.address, amount);
        await ContractUtils.waitingForAllowance(token_b, admin.address, bridge.address, amount);
    }
    const tokenId_b = ContractUtils.getTokenId(bridge.address, token_b.address);
    console.log("increaseLiquidity");
    console.log(`contract address: ${bridge.address}`);
    await bridge.connect(adminNonceManager).increaseLiquidity(tokenId_b, amount);
    // endregion
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
