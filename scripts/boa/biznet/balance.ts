// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOACoin } from "../../../src/service/common/Amount";
import { Config } from "../../../src/service/common/Config";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const manager = new Wallet(config.bridge.manager_key);
    const user = new Wallet(process.env.USER_KEY || "");

    console.log("BizNet");
    await writeBalance("admin   ", admin.address);
    await writeBalance("manager ", manager.address);
    await writeBalance("user    ", user.address);
    await writeBalance("fee     ", config.bridge.fee_address);
    await writeBalance("bridge  ", config.bridge.bridge_biznet_address);
}

async function writeBalance(title: string, address: string) {
    const balance = await hre.ethers.provider.getBalance(address);
    console.log(`${title} ${address} : ${new BOACoin(balance).toBOAString()} BOA`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
