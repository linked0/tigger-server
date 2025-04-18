import * as dotenv from "dotenv";

import "hardhat-change-network";
// tslint:disable-next-line:no-submodule-imports
import { HardhatUserConfig, task } from "hardhat/config";
// tslint:disable-next-line:no-submodule-imports
import { HardhatNetworkAccountUserConfig } from "hardhat/types/config";

import { utils, Wallet } from "ethers";

import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config({ path: "env/.env" });

// If not defined, randomly generated.
function createPrivateKey() {
    const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;
    const reg_bytes40: RegExp = /^(0x)[0-9a-f]{40}$/i;
    if (
        process.env.ADMIN_KEY === undefined ||
        process.env.ADMIN_KEY.trim() === "" ||
        !reg_bytes64.test(process.env.ADMIN_KEY)
    ) {
        console.log("환경 변수에 `ADMIN_KEY` 이 존재하지 않아서 무작위로 생성합니다.");
        process.env.ADMIN_KEY = Wallet.createRandom().privateKey;
    }
    if (
        process.env.MANAGER_KEY === undefined ||
        process.env.MANAGER_KEY.trim() === "" ||
        !reg_bytes64.test(process.env.MANAGER_KEY)
    ) {
        console.log("환경 변수에 `MANAGER_KEY` 이 존재하지 않아서 무작위로 생성합니다.");
        process.env.MANAGER_KEY = Wallet.createRandom().privateKey;
    }
    if (
        process.env.USER_KEY === undefined ||
        process.env.USER_KEY.trim() === "" ||
        !reg_bytes64.test(process.env.USER_KEY)
    ) {
        console.log("환경 변수에 `USER_KEY` 이 존재하지 않아서 무작위로 생성합니다.");
        process.env.USER_KEY = Wallet.createRandom().privateKey;
    }
    if (
        process.env.FEE_MANAGER_ADDRESS === undefined ||
        process.env.FEE_MANAGER_ADDRESS.trim() === "" ||
        !reg_bytes40.test(process.env.FEE_MANAGER_ADDRESS)
    ) {
        console.log("환경 변수에 `FEE_MANAGER_ADDRESS` 이 존재하지 않아서 무작위로 생성합니다.");
        process.env.FEE_MANAGER_ADDRESS = Wallet.createRandom().address;
    }
}
createPrivateKey();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

function getAccounts() {
    return [process.env.ADMIN_KEY || "", process.env.MANAGER_KEY || "", process.env.USER_KEY || ""];
}

function getTestAccounts() {
    const accounts: HardhatNetworkAccountUserConfig[] = [];
    const defaultBalance = utils.parseEther("2000000").toString();

    const n = 10;
    for (let i = 0; i < n; ++i) {
        accounts.push({
            privateKey: Wallet.createRandom().privateKey,
            balance: defaultBalance,
        });
    }
    const acc = getAccounts();
    for (let idx = 0; idx < acc.length; idx++) accounts[idx].privateKey = acc[idx];
    accounts[0].balance = utils.parseEther("100000000").toString();

    return accounts;
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.5.0",
            },
            {
                version: "0.8.0",
            },
        ],
    },
    networks: {
        hardhat: {
            accounts: getTestAccounts(),
            gas: 2100000,
            gasPrice: 8000000000,
        },
        localnet: {
            url: process.env.STANDALONE_URL,
            chainId: 7212309,
            accounts: getAccounts(),
        },
        marigold: {
            url: process.env.MARIGOLD_URL,
            chainId: 12301,
            accounts: getAccounts(),
        },
        marigold_localnet: {
            url: process.env.MARIGOLD_LOCALNET_URL,
            chainId: 12309,
            accounts: getAccounts(),
        },
        biznet_main_net: {
            url: process.env.BIZNET_MAIN_NET_URL || "",
            chainId: 2151,
            accounts: getAccounts(),
        },
        biznet_test_net: {
            url: process.env.BIZNET_TEST_NET_URL || "",
            chainId: 2019,
            accounts: getAccounts(),
        },
        biznet_dev_net: {
            url: process.env.BIZNET_DEV_NET_URL || "",
            chainId: 7212302,
            accounts: getAccounts(),
        },
        ethnet_main_net: {
            url: process.env.ETHNET_MAIN_NET_URL || "",
            chainId: 1,
            accounts: getAccounts(),
        },
        goeril: {
            url: process.env.GOERLI_URL || "",
            chainId: 5,
            accounts: getAccounts(),
        },
        sepolia: {
            url: process.env.SEPOLIA_URL || "",
            chainId: 11155111,
            accounts: getAccounts(),
        },
        ethnet_sample: {
            url: process.env.ETHNET_SAMPLE_URL || "",
            chainId: 51029,
            accounts: getAccounts(),
        },
        biznet_sample: {
            url: process.env.BIZNET_SAMPLE_URL || "",
            chainId: 51030,
            accounts: getAccounts(),
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
};

export default config;
