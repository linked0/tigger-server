// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOACoin } from "../../../src/service/common/Amount";
import { Config } from "../../../src/service/common/Config";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import { NonceManager } from "@ethersproject/experimental";

import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const manager = new Wallet(config.bridge.manager_key);
    const user = new Wallet(process.env.USER_KEY || "");

    const provider_biznet = hre.ethers.provider;
    const adminSigner_biznet = provider_biznet.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner_biznet);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    await adminNonceManager.sendTransaction({
        to: manager.address,
        value: BOACoin.make("1000100").value,
    });
    await adminNonceManager.sendTransaction({
        to: user.address,
        value: BOACoin.make("100100").value,
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
