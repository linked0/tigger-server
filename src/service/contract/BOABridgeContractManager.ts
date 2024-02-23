/**
 *  Includes classes that manage contracts related to BOA Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { BOACoinBridge, BOATokenBridge, BOSAGORA, ERC20 } from "../../../typechain";
import { Amount } from "../common/Amount";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { BridgeDirection } from "../types";
import { HardhatUtils } from "../utils";
import { BridgeContractManager } from "./BridgeContractManager";
import { ContractUtils } from "./ContractUtils";
import { GasPriceManager } from "./GasPriceManager";

import { BigNumber, providers, Wallet } from "ethers";
import * as hre from "hardhat";

// tslint:disable-next-line:no-submodule-imports
import { NonceManager } from "@ethersproject/experimental";

import fs from "fs";

/**
 * It's a class to manage contracts related to BOA Bridge
 */
export class BOABridgeContractManager extends BridgeContractManager {
    /**
     * The contract of BOA in EthNet
     */
    public boa_ethnet: ERC20;

    /**
     * The contract of Bridge in EthNet
     */
    // @ts-ignore
    public bridge_ethnet: BOATokenBridge;

    /**
     * The contract of Bridge in BizNet
     */
    // @ts-ignore
    public bridge_biznet: BOACoinBridge;

    /**
     * Constructor
     * @param config The instance of Config
     */
    constructor(config: Config) {
        super(config);

        try {
            this.manager_wallet = new Wallet(this.config.bridge.manager_key);

            HardhatUtils.insertIntoProvider(this.config.bridge.ethnet_network, this.manager_wallet.privateKey);
            HardhatUtils.insertIntoProvider(this.config.bridge.biznet_network, this.manager_wallet.privateKey);

            const token_ethnet_Artifact = JSON.parse(
                fs.readFileSync("./artifacts/contracts/boa-ethnet/PoohToken.sol/PoohToken.json", "utf8")
            );
            const bridgeTokenArtifact = JSON.parse(
                fs.readFileSync("./artifacts/contracts/bridge/BOATokenBridge.sol/BOATokenBridge.json", "utf8")
            );

            const bridgeCoinArtifact = JSON.parse(
                fs.readFileSync("./artifacts/contracts/bridge/BOACoinBridge.sol/BOACoinBridge.json", "utf8")
            );
            // region ETHNET
            hre.changeNetwork(this.config.bridge.ethnet_network);
            console.log("hardhat.network.url:", hre.network.config.url);
            this.provider_ethnet = hre.ethers.provider as providers.Web3Provider;
            const manager_signer_ethnet = ContractUtils.getManagerSigner(
                this.config.bridge.ethnet_network,
                this.manager_wallet.address
            );

            if (manager_signer_ethnet !== undefined) {
                this.manager_signer_ethnet = manager_signer_ethnet;
            } else {
                this.manager_signer_ethnet = new NonceManager(
                    new GasPriceManager(this.provider_ethnet.getSigner(this.manager_wallet.address))
                );
                ContractUtils.setManagerSigner(
                    this.config.bridge.ethnet_network,
                    this.manager_wallet.address,
                    this.manager_signer_ethnet
                );
            }

            this.boa_ethnet = new hre.ethers.Contract(
                this.config.bridge.boa_ethnet_address,
                token_ethnet_Artifact.abi,
                this.provider_ethnet
            ) as PoohToken;

            this.bridge_ethnet = new hre.ethers.Contract(
                this.config.bridge.bridge_ethnet_address,
                bridgeTokenArtifact.abi,
                this.provider_ethnet
            ) as BOATokenBridge;
            // endregion

            // region BIZNET
            console.log("this.config.bridge.biznet_network:", this.config.bridge.biznet_network);
            hre.changeNetwork(this.config.bridge.biznet_network);
            this.provider_biznet = hre.ethers.provider as providers.Web3Provider;

            const manager_signer_biznet = ContractUtils.getManagerSigner(
                this.config.bridge.biznet_network,
                this.manager_wallet.address
            );

            if (manager_signer_biznet !== undefined) {
                this.manager_signer_biznet = manager_signer_biznet;
            } else {
                this.manager_signer_biznet = new NonceManager(
                    new GasPriceManager(this.provider_biznet.getSigner(this.manager_wallet.address))
                );
                ContractUtils.setManagerSigner(
                    this.config.bridge.biznet_network,
                    this.manager_wallet.address,
                    this.manager_signer_biznet
                );
            }

            this.bridge_biznet = new hre.ethers.Contract(
                this.config.bridge.bridge_biznet_address,
                bridgeCoinArtifact.abi,
                this.provider_biznet
            ) as BOACoinBridge;
            // endregion

            console.log("Ethnet BOA deployed to: " + this.boa_ethnet.address);
            console.log("Ethnet BOABridge deployed to: " + this.bridge_ethnet.address);
            console.log("Biznet BOABridge deployed to: " + this.bridge_biznet.address);

            // wait the previous code to complete
            console.log("$$$$ call detectNetwork()");
            this.provider_biznet.detectNetwork().then((network) => {
                console.log("$$$$ provider_biznet.detectNetwork():", network);
            });

            const address: string = String("0xC64edC529C17D593f5339E02C9055312cE0718B7");
            console.log("$$$ balance_ethnet - this.provider_ethnet:", this.provider_ethnet);
            this.boa_ethnet.balanceOf(address).then((balance) => {
                console.log("$$$ balance_ethnet:", balance);
            });

        } catch (error) {
            logger.error(`Failed to create bridge contracts: ${error}`);
            process.exit(1);
        }
    }

    /**
     * Return the source bridge according to the direction of swap
     * @param direct The direction of swap
     */
    public getSourceBridge(direct: BridgeDirection): BOACoinBridge | BOATokenBridge | null {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                return this.bridge_ethnet;
            case BridgeDirection.BIZNET_ETHNET:
                return this.bridge_biznet;
            default:
                return null;
        }
    }

    /**
     * Return the target bridge according to the direction of swap
     * @param direct The direction of swap
     */
    public getTargetBridge(direct: BridgeDirection): BOACoinBridge | BOATokenBridge | null {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                return this.bridge_biznet;
            case BridgeDirection.BIZNET_ETHNET:
                return this.bridge_ethnet;
            default:
                return null;
        }
    }

    /**
     * Return the source bridge with signer according to the direction of swap
     * @param direct The direction of swap
     */
    public getSourceBridgeWithSigner(direct: BridgeDirection): BOACoinBridge | BOATokenBridge | null {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                return this.bridge_ethnet.connect(this.manager_signer_ethnet);
            case BridgeDirection.BIZNET_ETHNET:
                return this.bridge_biznet.connect(this.manager_signer_biznet);
            default:
                return null;
        }
    }

    /**
     * Return the target bridge with signer according to the direction of swap
     * @param direct The direction of swap
     */
    public getTargetBridgeWithSigner(direct: BridgeDirection): BOACoinBridge | BOATokenBridge | null {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                return this.bridge_biznet.connect(this.manager_signer_biznet);
            case BridgeDirection.BIZNET_ETHNET:
                return this.bridge_ethnet.connect(this.manager_signer_ethnet);
            default:
                return null;
        }
    }

    public getSwapFee(amount: BigNumber, decimal: number): Amount {
        return Amount.make(this.config.bridge.fee, decimal);
    }

    public getEstimatedTxFee(
        gas_price: number,
        eth_boa_rate: number,
        direct: BridgeDirection,
        decimal: number
    ): Amount | null {
        const GAS_UNIT = 10000000000;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                return Amount.make(
                    Math.ceil(this.config.bridge.gas_usage_close_deposit * (gas_price / GAS_UNIT) * eth_boa_rate),
                    decimal
                );
            case BridgeDirection.BIZNET_ETHNET:
                return Amount.make(
                    Math.ceil(
                        (this.config.bridge.gas_usage_open_withdraw + this.config.bridge.gas_usage_close_withdraw) *
                            (gas_price / GAS_UNIT) *
                            eth_boa_rate
                    ),
                    decimal
                );
            default:
                return null;
        }
    }
}
