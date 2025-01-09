// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOAToken } from "../../../src/service/common/Amount";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { BOATokenBridge, BOSAGORA } from "../../../typechain";

import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";
import { ContractUtils } from "../../../src/service/contract/ContractUtils";

async function main() {
    const token_ethnet_Artifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/boa-ethnet/BOSAGORA.sol/BOSAGORA.json", "utf8")
    );
    const bridgeArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/BOATokenBridge.sol/BOATokenBridge.json", "utf8")
    );

    // region ETHNET
    const provider_ethnet = ethers.provider;
    const boa_ethnet = new ethers.Contract(
        process.env.BOA_ETHNET_CONTRACT_ADDRESS || "",
        token_ethnet_Artifact.abi,
        provider_ethnet
    ) as BOSAGORA;

    const bridge_ethnet = new ethers.Contract(
        process.env.BRIDGE_ETHNET_CONTRACT_ADDRESS || "",
        bridgeArtifact.abi,
        provider_ethnet
    ) as BOATokenBridge;

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_ethnet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const amount = BOAToken.make("100000").value;
    const allowance_amount = await boa_ethnet.allowance(admin.address, bridge_ethnet.address);
    if (allowance_amount.lt(amount)) {
        console.log("Approve");
        await boa_ethnet.connect(adminNonceManager).approve(bridge_ethnet.address, amount);
        await ContractUtils.waitingForAllowance(boa_ethnet, admin.address, bridge_ethnet.address, amount);
    }

    console.log("increaseLiquidity");
    console.log(`contract address: ${bridge_ethnet.address}`);
    await bridge_ethnet.connect(adminNonceManager).increaseLiquidity(admin.address, amount);
    // endregion
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
