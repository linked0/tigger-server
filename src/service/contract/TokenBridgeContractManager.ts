/**
 *  Includes classes that manage contracts related to Token Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { ERC20, TokenBridge } from "../../../typechain";
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

// tslint:disable-next-line:no-implicit-dependencies
import { Provider } from "@ethersproject/abstract-provider";
// tslint:disable-next-line:no-implicit-dependencies
import { Signer } from "@ethersproject/abstract-signer";
// tslint:disable-next-line:no-submodule-imports
import { NonceManager } from "@ethersproject/experimental";

import * as fs from "fs";

/**
 * Token Info for Token Bridge
 */
export class Token {
    /**
     * 브릿지 컨트랙트의 주소
     */
    public bridge_address: string;

    /**
     * ERC20 토큰 컨트랙트의 주소
     */
    public token_address: string;

    /**
     * 토큰이름
     */
    public token_name: string;

    /**
     * 토큰심벌
     */
    public token_symbol: string;

    /**
     * ERC20 토큰 객체
     */
    public token: ERC20;

    /**
     * 브릿지 컨트랙트 호출에서 사용될 토큰의 고유아이디
     */
    public token_id: string;

    /**
     * 생성자
     * @param bridge_address
     * @param token_address
     * @param provider
     */
    constructor(bridge_address: string, token_address: string, provider: Signer | Provider) {
        this.bridge_address = bridge_address;
        this.token_address = token_address;
        const token_artifact = JSON.parse(
            fs.readFileSync("./artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json", "utf8")
        );
        this.token = new hre.ethers.Contract(this.token_address, token_artifact.abi, provider) as ERC20;

        // 아래 변수들은 컨트랙트를 호출하여 정보를 가지고 와야한다. 그러나 비동기함수이기 때문에 생성자에서 호출할 수 없다.
        // buildTokenInfo()를 사용하여 초기화 한다.
        this.token_name = "";
        this.token_symbol = "";
        this.token_id = "";
    }

    /**
     * 토큰의 정보를 가지고 온다. 비동기 함수들을 호출하여야 하기 때문에 생성자에 호출할 수 없고 별도로 반드시 호출되어야 한다.
     */
    public async buildTokenInfo() {
        this.token_address = await this.token.address;
        this.token_id = ContractUtils.BufferToString(ContractUtils.getTokenId(this.bridge_address, this.token_address));
    }
}

/**
 * TokenPair for Token Bridge
 */
export class TokenPair {
    public ethnet: Token;
    public biznet: Token;

    constructor(eth: Token, biz: Token) {
        this.ethnet = eth;
        this.biznet = biz;
    }

    /**
     * 토큰의 정보를 가지고 온다. 비동기 함수들을 호출하여야 하기 때문에 생성자에 호출할 수 없고 별도로 반드시 호출되어야 한다.
     */
    public async buildTokenInfo() {
        await this.ethnet.buildTokenInfo();
        await this.biznet.buildTokenInfo();
    }
}

/**
 * The Array of TokenPair for Token Bridge
 */
export class TokenPairCollection extends Array<TokenPair> {
    /**
     * Build token info, name, symbol
     */
    public async buildTokenInfo() {
        for (const m of this) {
            await m.buildTokenInfo();
            logger.info(`Ethnet Token : ${m.ethnet.token_address} - ${m.ethnet.token_id}`);
            logger.info(`Biznet Token : ${m.biznet.token_address} - ${m.biznet.token_id}`);
        }
    }
}

/**
 * It's a class to manage contracts related to BOA Bridge
 */
export class TokenBridgeContractManager extends BridgeContractManager {
    /**
     * The contract of BOA in EthNet
     */
    public tokens: TokenPairCollection;

    /**
     * The contract of Bridge in EthNet
     */
    // @ts-ignore
    public bridge_ethnet: TokenBridge;

    /**
     * The contract of Bridge in BizNet
     */
    // @ts-ignore
    public bridge_biznet: TokenBridge;

    /**
     * Constructor
     * @param config The instance of Config
     */
    constructor(config: Config) {
        super(config);
        this.tokens = new TokenPairCollection();

        try {
            this.manager_wallet = new Wallet(this.config.token_bridge.manager_key);

            HardhatUtils.insertIntoProvider(this.config.token_bridge.ethnet_network, this.manager_wallet.privateKey);
            HardhatUtils.insertIntoProvider(this.config.token_bridge.biznet_network, this.manager_wallet.privateKey);

            const bridge_artifact = JSON.parse(
                fs.readFileSync("./artifacts/contracts/bridge/TokenBridge.sol/TokenBridge.json", "utf8")
            );

            // region ETHNET
            hre.changeNetwork(this.config.token_bridge.ethnet_network);
            this.provider_ethnet = hre.ethers.provider as providers.Web3Provider;
            const manager_signer_ethnet = ContractUtils.getManagerSigner(
                this.config.token_bridge.ethnet_network,
                this.manager_wallet.address
            );

            if (manager_signer_ethnet !== undefined) {
                this.manager_signer_ethnet = manager_signer_ethnet;
            } else {
                this.manager_signer_ethnet = new NonceManager(
                    new GasPriceManager(this.provider_ethnet.getSigner(this.manager_wallet.address))
                );
                ContractUtils.setManagerSigner(
                    this.config.token_bridge.ethnet_network,
                    this.manager_wallet.address,
                    this.manager_signer_ethnet
                );
            }

            this.bridge_ethnet = new hre.ethers.Contract(
                this.config.token_bridge.bridge_ethnet_address,
                bridge_artifact.abi,
                this.provider_ethnet
            ) as TokenBridge;
            // endregion

            // region BIZNET
            hre.changeNetwork(this.config.token_bridge.biznet_network);
            this.provider_biznet = hre.ethers.provider as providers.Web3Provider;

            const manager_signer_biznet = ContractUtils.getManagerSigner(
                this.config.token_bridge.biznet_network,
                this.manager_wallet.address
            );

            if (manager_signer_biznet !== undefined) {
                this.manager_signer_biznet = manager_signer_biznet;
            } else {
                this.manager_signer_biznet = new NonceManager(
                    new GasPriceManager(this.provider_biznet.getSigner(this.manager_wallet.address))
                );
                ContractUtils.setManagerSigner(
                    this.config.token_bridge.biznet_network,
                    this.manager_wallet.address,
                    this.manager_signer_biznet
                );
            }

            this.bridge_biznet = new hre.ethers.Contract(
                this.config.token_bridge.bridge_biznet_address,
                bridge_artifact.abi,
                this.provider_biznet
            ) as TokenBridge;
            // endregion

            this.config.token_bridge.token_addresses.forEach((m) => {
                this.tokens.push(
                    new TokenPair(
                        new Token(this.bridge_ethnet.address, m.ethnet, this.provider_ethnet),
                        new Token(this.bridge_biznet.address, m.biznet, this.provider_biznet)
                    )
                );
            });

            logger.info("Ethnet TokenBridge deployed to: " + this.bridge_ethnet.address);
            logger.info("Biznet TokenBridge deployed to: " + this.bridge_biznet.address);
        } catch (error) {
            logger.error(`Failed to create bridge contracts: ${error}`);
            process.exit(1);
        }
    }

    /**
     * 토큰의 정보를 가지고 온다. 비동기 함수들을 호출하여야 하기 때문에 생성자에 호출할 수 없고 별도로 반드시 호출되어야 한다.
     */
    public async buildTokenInfo() {
        await this.tokens.buildTokenInfo();
    }

    /**
     * Return the source token pair according to the direction of swap
     * @param direct The direction of swap
     * @param token_id The id of the token
     */
    public getSourceTokenPair(direct: BridgeDirection, token_id: string): TokenPair | null {
        let pair;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                pair = this.tokens.find((value) => value.ethnet.token_id === token_id);
                return pair !== undefined ? pair : null;
            case BridgeDirection.BIZNET_ETHNET:
                pair = this.tokens.find((value) => value.biznet.token_id === token_id);
                return pair !== undefined ? pair : null;
            default:
                return null;
        }
    }

    /**
     * Return the target token pair according to the direction of swap
     * @param direct The direction of swap
     * @param token_id The id of the token
     */
    public getTargetTokenPair(direct: BridgeDirection, token_id: string): TokenPair | null {
        let pair;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                pair = this.tokens.find((value) => value.biznet.token_id === token_id);
                return pair !== undefined ? pair : null;
            case BridgeDirection.BIZNET_ETHNET:
                pair = this.tokens.find((value) => value.ethnet.token_id === token_id);
                return pair !== undefined ? pair : null;
            default:
                return null;
        }
    }

    /**
     * Return the source token according to the direction of swap
     * @param direct The direction of swap
     * @param token_id The id of the token
     */
    public getSourceToken(direct: BridgeDirection, token_id: string): Token | null {
        let pair;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                pair = this.tokens.find((value) => value.ethnet.token_id === token_id);
                return pair !== undefined ? pair.ethnet : null;
            case BridgeDirection.BIZNET_ETHNET:
                pair = this.tokens.find((value) => value.biznet.token_id === token_id);
                return pair !== undefined ? pair.biznet : null;
            default:
                return null;
        }
    }

    /**
     * Return the target token according to the direction of swap
     * @param direct The direction of swap
     * @param token_id The id of the token
     */
    public getTargetToken(direct: BridgeDirection, token_id: string): Token | null {
        let pair;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                pair = this.tokens.find((value) => value.biznet.token_id === token_id);
                return pair !== undefined ? pair.biznet : null;
            case BridgeDirection.BIZNET_ETHNET:
                pair = this.tokens.find((value) => value.ethnet.token_id === token_id);
                return pair !== undefined ? pair.ethnet : null;
            default:
                return null;
        }
    }

    /**
     * Return the target token according to the direction of swap
     * @param direct The direction of swap
     * @param token_id The id of the token
     */
    public getTargetTokenBySource(direct: BridgeDirection, token_id: string): Token | null {
        let pair;
        switch (direct) {
            case BridgeDirection.ETHNET_BIZNET:
                pair = this.tokens.find((value) => value.ethnet.token_id === token_id);
                return pair !== undefined ? pair.biznet : null;
            case BridgeDirection.BIZNET_ETHNET:
                pair = this.tokens.find((value) => value.biznet.token_id === token_id);
                return pair !== undefined ? pair.ethnet : null;
            default:
                return null;
        }
    }

    /**
     * Return the source bridge according to the direction of swap
     * @param direct The direction of swap
     */
    public getSourceBridge(direct: BridgeDirection): TokenBridge | null {
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
    public getTargetBridge(direct: BridgeDirection): TokenBridge | null {
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
    public getSourceBridgeWithSigner(direct: BridgeDirection): TokenBridge | null {
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
    public getTargetBridgeWithSigner(direct: BridgeDirection): TokenBridge | null {
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
        return Amount.make(0, decimal);
    }

    /**
     * 이더리움 메인넷에서 사용될 트랜잭션 수수료를 계산한다. 교환방향에 따라 리턴되는 통화단위가 다르기 때문에 주의해야 한다.
     * @param gas_price 가스가격
     * @param eth_boa_rate ETH 가격 / BOA 가격
     * @param direct 교환방향
     * @param decimal 소수점 자리수
     */
    public getEstimatedTxFee(
        gas_price: number,
        eth_boa_rate: number,
        direct: BridgeDirection,
        decimal: number
    ): Amount | null {
        const GAS_UNIT = 10000000000;
        switch (direct) {
            // 리턴되는 통화단위가 ETH 이다.
            case BridgeDirection.ETHNET_BIZNET:
                return Amount.make(
                    Math.ceil(this.config.token_bridge.gas_usage_close_deposit * gas_price) / GAS_UNIT,
                    decimal
                );
            // 리턴되는 통화단위가 BOA 이다.
            case BridgeDirection.BIZNET_ETHNET:
                return Amount.make(
                    Math.ceil(
                        (this.config.token_bridge.gas_usage_open_withdraw +
                            this.config.token_bridge.gas_usage_close_withdraw) *
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
