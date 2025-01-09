import { BOACoinBridge, BOATokenBridge, BOSAGORA, ERC20, TokenBridge } from "../../../typechain";
import { Amount, BOACoin, BOAToken } from "../common/Amount";
import { Config } from "../common/Config";
import { ContractUtils } from "../contract/ContractUtils";

// tslint:disable-next-line:no-submodule-imports
import { HardhatNetworkConfig, HttpNetworkConfig } from "hardhat/src/types/config";

import { providers, utils, Wallet } from "ethers";
import * as hre from "hardhat";

export class HardhatUtils {
    public static insertIntoProvider(network_name: string, private_key: string) {
        if (network_name === "hardhat") {
            const network: HardhatNetworkConfig = hre.config.networks[network_name] as HardhatNetworkConfig;
            if (Array.isArray(network.accounts)) {
                if (network.accounts.find((m) => m.privateKey === private_key) === undefined) {
                    network.accounts.push({
                        privateKey: private_key,
                        balance: utils.parseEther("2000000").toString(),
                    });
                }
            }
        } else {
            const network: HttpNetworkConfig = hre.config.networks[network_name] as HttpNetworkConfig;
            if (Array.isArray(network.accounts)) {
                if (network.accounts.find((m) => m === private_key) === undefined) {
                    network.accounts.push(private_key);
                }
            }
        }
    }

    /**
     * It's a function used to test using hardhat for BOABridge.
     * @param config
     */
    public static async deployBOABridgeForTest(config: Config) {
        const admin = new Wallet(process.env.ADMIN_KEY || "");
        const manager = new Wallet(config.bridge.manager_key);
        const user = new Wallet(process.env.USER_KEY || "");

        const timeLock = 60 * 60 * 24;

        if (config.bridge.ethnet_network === "hardhat") {
            HardhatUtils.insertIntoProvider(config.bridge.ethnet_network, manager.privateKey);

            // region ETHNET
            hre.changeNetwork(config.bridge.ethnet_network);
            const BOAEthTokenFactory = await hre.ethers.getContractFactory("BOSAGORA");
            const BOATokenBridgeFactory = await hre.ethers.getContractFactory("BOATokenBridge");
            const provider_ethnet = hre.ethers.provider as providers.Web3Provider;
            const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
            const managerSigner_ethnet = provider_ethnet.getSigner(manager.address);
            const boa_ethnet = (await BOAEthTokenFactory.connect(adminSigner_ethnet).deploy()) as BOSAGORA;
            await boa_ethnet.deployed();
            const bridge_ethnet = (await BOATokenBridgeFactory.connect(adminSigner_ethnet).deploy(
                boa_ethnet.address,
                timeLock,
                config.bridge.fee_address,
                true
            )) as BOATokenBridge;
            await bridge_ethnet.deployed();

            config.bridge.bridge_ethnet_address = bridge_ethnet.address;
            config.bridge.boa_ethnet_address = boa_ethnet.address;
            const amount = BOAToken.make("1000000").value;
            await bridge_ethnet.connect(adminSigner_ethnet).addManager(manager.address);
            await boa_ethnet.connect(adminSigner_ethnet).transfer(user.address, amount);
            await boa_ethnet.connect(adminSigner_ethnet).approve(bridge_ethnet.address, amount);
            await bridge_ethnet.connect(adminSigner_ethnet).increaseLiquidity(admin.address, amount);
            // endregion
        }

        if (config.bridge.biznet_network === "hardhat") {
            HardhatUtils.insertIntoProvider(config.bridge.biznet_network, manager.privateKey);

            // region BIZNET
            hre.changeNetwork(config.bridge.biznet_network);
            const BOACoinBridgeFactory = await hre.ethers.getContractFactory("BOACoinBridge");
            const provider_biznet = hre.ethers.provider as providers.Web3Provider;
            const adminSigner_biznet = provider_biznet.getSigner(admin.address);
            const managerSigner_biznet = provider_biznet.getSigner(manager.address);
            const bridge_biznet = (await BOACoinBridgeFactory.connect(adminSigner_biznet).deploy(
                timeLock,
                config.bridge.fee_address,
                false
            )) as BOACoinBridge;
            await bridge_biznet.deployed();

            config.bridge.bridge_biznet_address = bridge_biznet.address;
            await bridge_biznet.connect(adminSigner_biznet).addManager(manager.address);
            await bridge_biznet
                .connect(adminSigner_biznet)
                .increaseLiquidity({ from: admin.address, value: BOACoin.make("1000000").value });
            // endregion
        }
    }

    /**
     * It's a function used to test using hardhat for TokenBridge
     * @param config
     */
    public static async deployTokenBridgeForTest(config: Config) {
        const admin = new Wallet(process.env.ADMIN_KEY || "");
        const manager = new Wallet(config.bridge.manager_key);
        const user = new Wallet(process.env.USER_KEY || "");

        const timeLock = 60 * 60 * 24;
        const decimal = 10;
        const amount = Amount.make("1000000", decimal).value;

        const TestTokenFactory = await hre.ethers.getContractFactory("TestToken");
        const TokenBridgeFactory = await hre.ethers.getContractFactory("TokenBridge");

        if (config.token_bridge.ethnet_network === "hardhat" && config.token_bridge.biznet_network === "hardhat") {
            HardhatUtils.insertIntoProvider(config.token_bridge.ethnet_network, manager.privateKey);

            // region ETHNET
            hre.changeNetwork(config.token_bridge.ethnet_network);
            const provider_ethnet = hre.ethers.provider as providers.Web3Provider;
            const adminSigner_ethnet = provider_ethnet.getSigner(admin.address);
            const managerSigner_ethnet = provider_ethnet.getSigner(manager.address);
            const bridge_ethnet = (await TokenBridgeFactory.connect(adminSigner_ethnet).deploy(
                timeLock
            )) as TokenBridge;
            await bridge_ethnet.deployed();

            const tokenA_ethnet = (await TestTokenFactory.connect(adminSigner_ethnet).deploy(
                "Sample Token A",
                "SMA",
                decimal
            )) as ERC20;
            await tokenA_ethnet.deployed();
            const tokenAId_ethnet = ContractUtils.getTokenId(bridge_ethnet.address, tokenA_ethnet.address);

            const tokenB_ethnet = (await TestTokenFactory.connect(adminSigner_ethnet).deploy(
                "Sample Token B",
                "SMB",
                decimal
            )) as ERC20;
            await tokenB_ethnet.deployed();
            const tokenBId_ethnet = ContractUtils.getTokenId(bridge_ethnet.address, tokenB_ethnet.address);

            await bridge_ethnet.connect(adminSigner_ethnet).addManager(manager.address);
            await bridge_ethnet.connect(managerSigner_ethnet).registerToken(tokenAId_ethnet, tokenA_ethnet.address);
            await bridge_ethnet.connect(managerSigner_ethnet).registerToken(tokenBId_ethnet, tokenB_ethnet.address);

            await tokenA_ethnet.connect(adminSigner_ethnet).transfer(manager.address, amount);
            await tokenA_ethnet.connect(adminSigner_ethnet).transfer(user.address, amount);
            await tokenA_ethnet.connect(adminSigner_ethnet).approve(bridge_ethnet.address, amount);
            await bridge_ethnet.connect(adminSigner_ethnet).increaseLiquidity(tokenAId_ethnet, amount);

            await tokenB_ethnet.connect(adminSigner_ethnet).transfer(manager.address, amount);
            await tokenB_ethnet.connect(adminSigner_ethnet).transfer(user.address, amount);
            await tokenB_ethnet.connect(adminSigner_ethnet).approve(bridge_ethnet.address, amount);
            await bridge_ethnet.connect(adminSigner_ethnet).increaseLiquidity(tokenBId_ethnet, amount);
            // endregion

            HardhatUtils.insertIntoProvider(config.token_bridge.biznet_network, manager.privateKey);

            // region BIZNET
            hre.changeNetwork(config.token_bridge.biznet_network);
            const provider_biznet = hre.ethers.provider as providers.Web3Provider;
            const adminSigner_biznet = provider_biznet.getSigner(admin.address);
            const managerSigner_biznet = provider_biznet.getSigner(manager.address);
            const bridge_biznet = (await TokenBridgeFactory.connect(adminSigner_biznet).deploy(
                timeLock
            )) as TokenBridge;
            await bridge_biznet.deployed();

            const tokenA_biznet = (await TestTokenFactory.connect(adminSigner_biznet).deploy(
                "Sample Token A",
                "SMA",
                10
            )) as ERC20;
            await tokenA_biznet.deployed();
            const tokenAId_biznet = ContractUtils.getTokenId(bridge_biznet.address, tokenA_biznet.address);

            const tokenB_biznet = (await TestTokenFactory.connect(adminSigner_biznet).deploy(
                "Sample Token B",
                "SMB",
                10
            )) as ERC20;
            await tokenB_biznet.deployed();
            const tokenBId_biznet = ContractUtils.getTokenId(bridge_biznet.address, tokenB_biznet.address);

            await bridge_biznet.connect(adminSigner_biznet).addManager(manager.address);
            await bridge_biznet.connect(managerSigner_biznet).registerToken(tokenAId_biznet, tokenA_biznet.address);
            await bridge_biznet.connect(managerSigner_biznet).registerToken(tokenBId_biznet, tokenB_biznet.address);

            await tokenA_biznet.connect(adminSigner_biznet).transfer(manager.address, amount);
            await tokenA_biznet.connect(adminSigner_biznet).transfer(user.address, amount);
            await tokenA_biznet.connect(adminSigner_biznet).approve(bridge_biznet.address, amount);
            await bridge_biznet.connect(adminSigner_biznet).increaseLiquidity(tokenAId_biznet, amount);

            await tokenB_biznet.connect(adminSigner_biznet).transfer(manager.address, amount);
            await tokenB_biznet.connect(adminSigner_biznet).transfer(user.address, amount);
            await tokenB_biznet.connect(adminSigner_biznet).approve(bridge_biznet.address, amount);
            await bridge_biznet.connect(adminSigner_biznet).increaseLiquidity(tokenBId_biznet, amount);
            // endregion

            config.token_bridge.bridge_ethnet_address = bridge_ethnet.address;
            config.token_bridge.bridge_biznet_address = bridge_biznet.address;
            config.token_bridge.token_addresses = [
                {
                    ethnet: tokenA_ethnet.address,
                    biznet: tokenA_biznet.address,
                },
                {
                    ethnet: tokenB_ethnet.address,
                    biznet: tokenB_biznet.address,
                },
            ];
        }
    }
}
