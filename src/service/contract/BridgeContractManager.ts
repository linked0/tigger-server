/**
 *  Includes classes that manage contracts related to Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { Amount } from "../common/Amount";
import { Config } from "../common/Config";
import { BridgeDirection } from "../types";

import { BigNumber, providers, Signer, Wallet } from "ethers";

// tslint:disable-next-line:no-submodule-imports
import { NonceManager } from "@ethersproject/experimental";

/**
 * It's a class to manage contracts related to BOA Bridge
 */
export class BridgeContractManager {
    /**
     * The configuration
     */
    protected config: Config;

    /**
     * The provider in EthNet
     */
    // @ts-ignore
    public provider_ethnet: providers.Web3Provider;

    /**
     * The provider in BizNet
     */
    // @ts-ignore
    public provider_biznet: providers.Web3Provider;

    /**
     * The Wallet of manager
     */
    // @ts-ignore
    public manager_wallet: Wallet;

    /**
     * The Signer of manager in EthNet
     */
    // @ts-ignore
    public manager_signer_ethnet: Signer;

    /**
     * The Signer of manager in BizNet
     */
    // @ts-ignore
    public manager_signer_biznet: Signer;

    /**
     * Constructor
     * @param config The instance of Config
     */
    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Reset the transaction nonce of manager address in the source network
     */
    public async resetSourceTransactionCount(direct: BridgeDirection) {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                const signer_ethnet = this.manager_signer_ethnet as NonceManager;
                signer_ethnet.setTransactionCount(await signer_ethnet.getTransactionCount());
                break;
            case BridgeDirection.BIZNET_ETHNET:
                const signer_biznet = this.manager_signer_biznet as NonceManager;
                signer_biznet.setTransactionCount(await signer_biznet.getTransactionCount());
                break;
        }
    }

    /**
     * Reset the transaction nonce of manager address in the target network
     */
    public async resetTargetTransactionCount(direct: BridgeDirection) {
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                const signer_biznet = this.manager_signer_biznet as NonceManager;
                signer_biznet.setTransactionCount(await signer_biznet.getTransactionCount());
                break;
            case BridgeDirection.BIZNET_ETHNET:
                const signer_ethnet = this.manager_signer_ethnet as NonceManager;
                signer_ethnet.setTransactionCount(await signer_ethnet.getTransactionCount());
                break;
        }
    }

    public getSwapFee(amount: BigNumber, decimal: number): Amount {
        return Amount.make(0, decimal);
    }

    public getEstimatedTxFee(
        gas_price: number,
        eth_boa_rate: number,
        direct: BridgeDirection,
        decimal: number
    ): Amount | null {
        return Amount.make(0, decimal);
    }
}
