// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Amount, BOACoin } from "../../../src/service/common/Amount";
import { GasPriceManager } from "../../../src/service/contract/GasPriceManager";

import { Config } from "../../../src/service/common/Config";
import { TestToken } from "../../../typechain";

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
    const manager = new Wallet(config.token_bridge.manager_key);
    const user = new Wallet(process.env.USER_KEY || "");

    // region ETHNET
    const token_artifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TestToken.sol/TestToken.json", "utf8")
    );
    const provider = hre.ethers.provider;
    const adminSigner = provider.getSigner(admin.address);
    const adminGasPriceManager = new GasPriceManager(adminSigner);
    const adminNonceManager = new NonceManager(adminGasPriceManager);

    const token_a = new hre.ethers.Contract(
        process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1 || "",
        token_artifact.abi,
        provider
    ) as TestToken;

    const decimal_a = await token_a.decimal();
    await token_a.connect(adminNonceManager).transfer(manager.address, Amount.make("1000000", decimal_a).value);
    await token_a.connect(adminNonceManager).transfer(user.address, Amount.make("1000000", decimal_a).value);

    const token_b = new hre.ethers.Contract(
        process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS2 || "",
        token_artifact.abi,
        provider
    ) as TestToken;

    const decimal_b = await token_b.decimal();
    await token_b.connect(adminNonceManager).transfer(manager.address, Amount.make("1000000", decimal_b).value);
    await token_b.connect(adminNonceManager).transfer(user.address, Amount.make("1000000", decimal_b).value);
    // endregion

    await adminNonceManager.sendTransaction({
        to: manager.address,
        value: BOACoin.make("10000").value,
    });
    await adminNonceManager.sendTransaction({
        to: user.address,
        value: BOACoin.make("10000").value,
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
