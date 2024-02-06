// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

import { Amount, BOACoin, BOAToken } from "../../../src/service/common/Amount";
import { Config } from "../../../src/service/common/Config";
import { TestToken } from "../../../typechain";

import { Wallet } from "ethers";
import * as hre from "hardhat";

import fs from "fs";
import path from "path";

async function main() {
    const config = new Config();
    config.readFromFile(path.resolve(process.cwd(), "config/config.yaml"));
    await config.decrypt();

    const admin = new Wallet(process.env.ADMIN_KEY || "");
    const manager = new Wallet(config.token_bridge.manager_key);
    const user = new Wallet(process.env.USER_KEY || "");

    const bridge_address = process.env.TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS || "";
    const token_address_a = process.env.TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS1 || "";
    const token_address_b = process.env.TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS2 || "";

    const tokenArtifact = JSON.parse(
        fs.readFileSync("./artifacts/contracts/bridge/TestToken.sol/TestToken.json", "utf8")
    );

    const provider = hre.ethers.provider;
    const token_a = new hre.ethers.Contract(token_address_a, tokenArtifact.abi, provider) as TestToken;
    const token_b = new hre.ethers.Contract(token_address_b, tokenArtifact.abi, provider) as TestToken;

    console.log("EthNet - Token A");
    await writeTokenBalance(token_a, "admin   ", admin.address);
    await writeTokenBalance(token_a, "manager ", manager.address);
    await writeTokenBalance(token_a, "user    ", user.address);
    await writeTokenBalance(token_a, "bridge  ", bridge_address);

    console.log("EthNet - Token B");
    await writeTokenBalance(token_b, "admin   ", admin.address);
    await writeTokenBalance(token_b, "manager ", manager.address);
    await writeTokenBalance(token_b, "user    ", user.address);
    await writeTokenBalance(token_b, "bridge  ", bridge_address);

    console.log("EthNet - Native Token");
    await writeBalance("admin   ", admin.address);
    await writeBalance("manager ", manager.address);
    await writeBalance("user    ", user.address);
    // endregion
}

async function writeBalance(title: string, address: string) {
    const balance = await hre.ethers.provider.getBalance(address);
    console.log(`${title} ${address} : ${new BOACoin(balance).toBOAString()} Native Token`);
}

async function writeTokenBalance(contract: TestToken, title: string, address: string) {
    const balance = await contract.balanceOf(address);
    console.log(`${title} ${address} : ${new Amount(balance, await contract.decimal()).toBOAString()} Token`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
