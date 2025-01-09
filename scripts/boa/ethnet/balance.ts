// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { BOSAGORA } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import fs from "fs";
import { BOACoin, BOAToken } from "../../../src/service/common/Amount";
import { Config } from "../../../src/service/common/Config";
import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const manager = new Wallet(config.bridge.manager_key);
    const user = new Wallet(process.env.USER_KEY || "");
    const token_ethnet_Artifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/boa-ethnet/BOSAGORA.sol/BOSAGORA.json", "utf8")
    );

    const provider_ethnet = hre.ethers.provider;
    const boa_ethnet = new hre.ethers.Contract(
        process.env.BOA_ETHNET_CONTRACT_ADDRESS || "",
        token_ethnet_Artifact.abi,
        provider_ethnet
    ) as BOSAGORA;

    console.log("EthNet - BOA");
    await writeTokenBalance(boa_ethnet, "admin   ", admin.address);
    await writeTokenBalance(boa_ethnet, "manager ", manager.address);
    await writeTokenBalance(boa_ethnet, "user    ", user.address);
    await writeTokenBalance(boa_ethnet, "bridge  ", process.env.BRIDGE_ETHNET_CONTRACT_ADDRESS || "");

    console.log("EthNet - ETH");

    await writeBalance("admin   ", admin.address);
    await writeBalance("manager ", manager.address);
    await writeBalance("user    ", user.address);
    // endregion
}

async function writeBalance(title: string, address: string) {
    const balance = await hre.ethers.provider.getBalance(address);
    console.log(`${title} ${address} : ${new BOACoin(balance).toBOAString()} BOA`);
}

async function writeTokenBalance(contract: BOSAGORA, title: string, address: string) {
    const balance = await contract.balanceOf(address);
    console.log(`${title} ${address} : ${new BOAToken(balance).toBOAString()} BOA`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
