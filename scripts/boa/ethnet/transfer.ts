// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOACoin, BOAToken } from "../../../src/service/common/Amount";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { Config } from "../../../src/service/common/Config";
import { BOSAGORA } from "../../../typechain";

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
    const user = new Wallet(process.env.USER_KEY || "");

    // region ETHNET
    const token_ethnet_Artifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/boa-ethnet/BOSAGORA.sol/BOSAGORA.json", "utf8")
    );
    const provider_ethnet = hre.ethers.provider;
    const boa_ethnet = new hre.ethers.Contract(
        process.env.BOA_ETHNET_CONTRACT_ADDRESS || "",
        token_ethnet_Artifact.abi,
        provider_ethnet
    ) as BOSAGORA;

    const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_ethnet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);
    await boa_ethnet.connect(adminNonceManager).transfer(manager.address, BOAToken.make("1000000").value);
    await boa_ethnet.connect(adminNonceManager).transfer(user.address, BOAToken.make("1000000").value);
    // endregion

    await adminNonceManager.sendTransaction({
        to: manager.address,
        value: BOACoin.make("100").value,
    });
    await adminNonceManager.sendTransaction({
        to: user.address,
        value: BOACoin.make("10").value,
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
