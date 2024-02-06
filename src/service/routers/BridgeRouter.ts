/**
 *  The router of BOA Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { WebService } from "../../modules/service/WebService";
import { Utils } from "../../modules/utils/Utils";
import { Amount, BOACoin, BOAToken } from "../common/Amount";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { BOABridgeContractManager } from "../contract/BOABridgeContractManager";
import { ContractUtils } from "../contract/ContractUtils";
import { TokenBridgeContractManager } from "../contract/TokenBridgeContractManager";
import { SwapStorage } from "../storage/SwapStorage";
import {
    BridgeDirection,
    BridgeType,
    IBridgeSwapHeader,
    IBridgeSwapHistory,
    IBridgeSwapInfo,
    IBridgeSwapItem,
} from "../types";
import { Validation } from "../validation";

import { BigNumber } from "ethers";
import express from "express";

// tslint:disable-next-line:no-var-requires
const { body, param, query, validationResult } = require("express-validator");

export class BridgeRouter {
    /**
     *
     * @private
     */
    private _web_service: WebService;

    /**
     *
     * @private
     */
    private _contract_manager: BOABridgeContractManager;

    /**
     *
     * @private
     */
    private _token_contract_manager: TokenBridgeContractManager;

    /**
     *
     * @private
     */
    private _swap_storage: SwapStorage;

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    /**
     *
     * @param service  WebService
     * @param swap_storage
     * @param contract BOABridgeContractManager
     * @param token_contract TokenBridgeContractManager
     * @param config Configuration
     */
    constructor(
        service: WebService,
        swap_storage: SwapStorage,
        contract: BOABridgeContractManager,
        token_contract: TokenBridgeContractManager,
        config: Config
    ) {
        this._web_service = service;
        this._swap_storage = swap_storage;
        this._contract_manager = contract;
        this._token_contract_manager = token_contract;
        this._config = config;
    }

    private get app(): express.Application {
        return this._web_service.app;
    }

    /**
     * Make the response data
     * @param status    The result code
     * @param data      The result data
     * @param error     The error
     * @private
     */
    private static makeResponseData(status: number, data: any, error?: any): any {
        return {
            status,
            data,
            error,
        };
    }

    public registerRoutes() {
        this.app.get("/", [], this.getDummy.bind(this));
        this.app.get(
            "/bridge/balance/:address",
            [param("address").exists().isEthereumAddress()],
            this.getBalance.bind(this)
        );

        const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;

        this.app.get("/bridge/swap/:id", [param("id").exists().matches(reg_bytes64)], this.getBox.bind(this));
        this.app.get(
            "/bridge/swaps/:address",
            [param("address").exists().isEthereumAddress()],
            this.getBoxes.bind(this)
        );
        this.app.post(
            "/bridge/deposit",
            [
                body("id").exists().matches(reg_bytes64),
                body("trader_address").exists().isEthereumAddress(),
                body("withdraw_address").exists().isEthereumAddress(),
                body("amount").exists().custom(Validation.isAmount),
                body("swap_fee").exists().custom(Validation.isAmount),
                body("tx_fee").exists().custom(Validation.isAmount),
                body("direction").exists().isIn(["0", "1"]),
                body("secret_lock").exists().matches(reg_bytes64),
                body("tx_hash").exists().matches(reg_bytes64),
            ],
            this.postDeposit.bind(this)
        );
        this.app.post(
            "/bridge/close",
            [body("id").exists().matches(reg_bytes64), body("key").exists().matches(reg_bytes64)],
            this.postSecretKey.bind(this)
        );
        this.app.get("/bridge/prices", [], this.getPrices.bind(this));
        this.app.get("/bridge/contracts", [], this.getContracts.bind(this));
        this.app.get(
            "/bridge/fees",
            [query("amount").exists().custom(Validation.isAmount), query("direction").exists().isIn(["0", "1"])],
            this.getFees.bind(this)
        );
    }

    private async getDummy(req: express.Request, res: express.Response) {
        return res.json("OK");
    }

    /**
     * GET /bridge/balance/:address
     *
     * Return the highest block height stored in SwapServer
     * @private
     */
    private async getBalance(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }
        const address: string = String(req.params.address);
        logger.http(`GET /balance/:address`);

        const balance_biznet = await this._contract_manager.provider_biznet.getBalance(address);
        const balance_ethnet = await this._contract_manager.boa_ethnet.balanceOf(address);

        return res.json(
            BridgeRouter.makeResponseData(200, {
                biznet: balance_biznet.toString(),
                ethnet: balance_ethnet.toString(),
            })
        );
    }

    /**
     *
     * POST /bridge/deposit
     *
     * @private
     */
    private async postDeposit(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }

        logger.http(`POST /bridge/deposit`);

        let type: number;
        if (req.body.type !== undefined) {
            type = Number(req.body.type);
            if (type !== 0 && type !== 1) {
                return res.json(
                    BridgeRouter.makeResponseData(400, undefined, {
                        message: "Failed to check the validity of parameters.",
                    })
                );
            }
        } else {
            type = 0;
        }

        this._swap_storage
            .getBridgeSwap(req.body.id)
            .then((rows: any[]) => {
                if (rows.length === 0) {
                    this._swap_storage
                        .postBridgeSwap(
                            req.body.id,
                            type,
                            req.body.trader_address,
                            req.body.withdraw_address,
                            req.body.amount,
                            req.body.swap_fee,
                            req.body.tx_fee,
                            Number(req.body.direction),
                            req.body.secret_lock,
                            req.body.tx_hash
                        )
                        .then(() => {
                            return res.json(
                                BridgeRouter.makeResponseData(200, {
                                    id: req.body.id,
                                })
                            );
                        })
                        .catch(() => {
                            return res.json(
                                BridgeRouter.makeResponseData(500, undefined, {
                                    message: "Failed to save data.",
                                })
                            );
                        });
                } else {
                    return res.json(
                        BridgeRouter.makeResponseData(400, undefined, {
                            message: "A record with the same ID exists.",
                        })
                    );
                }
            })
            .catch(() => {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "Failed to save data.",
                    })
                );
            });
    }

    /**
     * GET /bridge/swap/:id
     *
     * @private
     */
    private async getBox(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }
        logger.http(`GET /bridge/swap/:id`);

        this._swap_storage
            .getBridgeSwap(req.params.id)
            .then((rows: IBridgeSwapInfo[]) => {
                if (rows.length > 0) {
                    return res.json(BridgeRouter.makeResponseData(200, rows[0]));
                } else {
                    return res.json(
                        BridgeRouter.makeResponseData(204, undefined, {
                            message: "Record does not exist.",
                        })
                    );
                }
            })
            .catch(() => {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "Failed to save data.",
                    })
                );
            });
    }

    /**
     * GET /bridge/swaps/:address
     *
     * @private
     */
    private async getBoxes(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }
        logger.http(`GET /bridge/swaps/:address`);

        let page: number;
        let page_size: number;
        if (req.query.page !== undefined && Number(req.query.page) !== 0) {
            if (!Utils.isPositiveInteger(req.query.page.toString())) {
                res.status(400).send(`Invalid value for parameter 'page': ${req.query.page.toString()}`);
                return;
            }
            page = Number(req.query.page.toString());
        } else page = 1;

        if (req.query.page_size !== undefined) {
            if (!Utils.isPositiveInteger(req.query.page_size.toString())) {
                res.status(400).send(`Invalid value for parameter 'limit': ${req.query.page_size.toString()}`);
                return;
            }
            page_size = Number(req.query.page_size.toString());
            if (page_size > 10000) {
                res.status(400).send(`Page size cannot be a number greater than 10000: ${page_size}`);
                return;
            }
        } else page_size = 10;

        this._swap_storage
            .getBridgeSwapList(req.params.address, page_size, page)
            .then(async (rows: any[]) => {
                let full_count = 0;
                if (rows.length === 0) {
                    if (page > 1) {
                        const rows_second = await this._swap_storage.getBridgeSwapList(
                            req.params.address,
                            page_size,
                            1
                        );
                        full_count = rows_second.length > 0 ? rows_second[0].full_count : 0;
                    }
                } else {
                    full_count = rows[0].full_count;
                }

                const total_page = full_count === 0 ? 0 : Math.floor((full_count - 1) / page_size) + 1;
                const header: IBridgeSwapHeader = {
                    address: req.params.address,
                    page_size,
                    page,
                    total_page,
                };
                const items: IBridgeSwapItem[] = [];
                for (const m of rows) {
                    items.push({
                        id: m.id,
                        type: m.type,
                        trader_address: m.trader_address,
                        withdraw_address: m.withdraw_address,
                        amount: m.amount,
                        swap_fee: m.swap_fee,
                        tx_fee: m.tx_fee,
                        direction: m.direction,
                        secret_lock: m.secret_lock,
                        deposit_state: m.deposit_state,
                        deposit_token_id: m.deposit_token_id,
                        deposit_time_lock: m.deposit_time_lock,
                        deposit_create_time: m.deposit_create_time,
                        deposit_tx_hash: m.deposit_tx_hash,
                        withdraw_state: m.withdraw_state,
                        withdraw_token_id: m.withdraw_token_id,
                        withdraw_time_lock: m.withdraw_time_lock,
                        withdraw_create_time: m.withdraw_create_time,
                        withdraw_tx_hash: m.withdraw_tx_hash,
                        process_status: m.process_status,
                    });
                }
                const history: IBridgeSwapHistory = {
                    header,
                    items,
                };
                return res.json(BridgeRouter.makeResponseData(200, history));
            })
            .catch(() => {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "Failed to query data.",
                    })
                );
            });
    }

    /**
     *
     * POST /bridge/close
     *
     * @private
     */
    private async postSecretKey(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }

        logger.http(`POST /bridge/close`);

        this._swap_storage
            .getBridgeSwap(req.body.id)
            .then((rows: any[]) => {
                if (rows.length === 0) {
                    return res.json(
                        BridgeRouter.makeResponseData(400, undefined, {
                            message: "A record with the same ID does not exists.",
                        })
                    );
                } else {
                    const key = ContractUtils.StringToBuffer(req.body.key);
                    const lock = ContractUtils.StringToBuffer(rows[0].secret_lock);
                    if (Buffer.compare(lock, ContractUtils.sha256(key)) === 0) {
                        this._swap_storage
                            .updateBridgeSecretKey(req.body.id, req.body.key)
                            .then(() => {
                                return res.json(
                                    BridgeRouter.makeResponseData(200, {
                                        id: req.body.id,
                                    })
                                );
                            })
                            .catch(() => {
                                return res.json(
                                    BridgeRouter.makeResponseData(500, undefined, {
                                        message: "Failed to save data.",
                                    })
                                );
                            });
                    } else {
                        return res.json(
                            BridgeRouter.makeResponseData(400, undefined, {
                                message: "The key entered is not valid.",
                            })
                        );
                    }
                }
            })
            .catch(() => {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "Failed to save data.",
                    })
                );
            });
    }

    /**
     *
     * POST /bridge/prices
     *
     * @private
     */
    private async getPrices(req: express.Request, res: express.Response) {
        logger.http(`GET /bridge/prices`);

        try {
            const gas_price = await this._swap_storage.getStandardGasPrice();
            let eth_boa_rate;
            const coin_prices: {
                eth: { krw: number; usd: number };
                boa: { krw: number; usd: number };
            } = { eth: { krw: 0, usd: 0 }, boa: { krw: 0, usd: 0 } };

            const response = await this._swap_storage.getCoinPrices();
            for (const m of response) {
                if (m.symbol === "ETH") {
                    coin_prices.eth.usd = m.usd;
                    coin_prices.eth.krw = m.krw;
                }
                if (m.symbol === "BOA") {
                    coin_prices.boa.usd = m.usd;
                    coin_prices.boa.krw = m.krw;
                }
            }
            eth_boa_rate =
                coin_prices.eth.krw !== 0 && coin_prices.boa.krw !== 0
                    ? coin_prices.eth.krw / coin_prices.boa.krw
                    : null;

            if (gas_price === null || gas_price === 0) {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "The ether gas price information is not ready.",
                    })
                );
            }

            if (eth_boa_rate === null) {
                return res.json(
                    BridgeRouter.makeResponseData(500, undefined, {
                        message: "The ETH & BOA price information is not ready.",
                    })
                );
            }

            return res.json(
                BridgeRouter.makeResponseData(200, {
                    gas_price,
                    eth_boa_rate,
                    coin_prices,
                })
            );
        } catch (e) {
            return res.json(
                BridgeRouter.makeResponseData(500, undefined, {
                    message: "Failed to read data.",
                })
            );
        }
    }

    /**
     * GET /bridge/contracts
     *
     * @private
     */
    private async getContracts(req: express.Request, res: express.Response) {
        logger.http(`GET /bridge/contracts`);

        const data = {
            boa_bridge: {
                boa_ethnet_address: this._config.bridge.boa_ethnet_address,
                bridge_ethnet_address: this._config.bridge.bridge_ethnet_address,
                bridge_biznet_address: this._config.bridge.bridge_biznet_address,
                gas_usage: {
                    open_deposit: this._config.bridge.gas_usage_open_deposit,
                    close_deposit: this._config.bridge.gas_usage_close_deposit,
                    open_withdraw: this._config.bridge.gas_usage_open_withdraw,
                    close_withdraw: this._config.bridge.gas_usage_close_withdraw,
                },
                fee: this._config.bridge.fee,
            },
            token_bridge: {
                bridge_ethnet_address: this._config.token_bridge.bridge_ethnet_address,
                bridge_biznet_address: this._config.token_bridge.bridge_biznet_address,
                tokens: [],
                gas_usage: {
                    open_deposit: this._config.token_bridge.gas_usage_open_deposit,
                    close_deposit: this._config.token_bridge.gas_usage_close_deposit,
                    open_withdraw: this._config.token_bridge.gas_usage_open_withdraw,
                    close_withdraw: this._config.token_bridge.gas_usage_close_withdraw,
                },
                fee: 0,
            },
        };

        for (const m of this._config.token_bridge.token_addresses) {
            // @ts-ignore
            data.token_bridge.tokens.push({ ethnet: m.ethnet, biznet: m.biznet });
        }
        return res.json(BridgeRouter.makeResponseData(200, data));
    }

    /**
     * GET /bridge/fees
     *
     * @private
     */
    private async getFees(req: express.Request, res: express.Response) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.json(
                BridgeRouter.makeResponseData(400, undefined, {
                    validation: errors.array(),
                    message: "Failed to check the validity of parameters.",
                })
            );
        }
        logger.http(`GET /bridge/fees`);

        let type: number;
        if (req.query.type !== undefined) {
            type = Number(req.query.type);
            if (type !== 0 && type !== 1) {
                return res.json(
                    BridgeRouter.makeResponseData(400, undefined, {
                        message: "Failed to check the validity of parameters.",
                    })
                );
            }
        } else {
            type = 0;
        }

        const gas_price = await this._swap_storage.getStandardGasPrice();
        const eth_boa_rate = await this._swap_storage.getEthBoaRate();
        if (gas_price === null) {
            return res.json(
                BridgeRouter.makeResponseData(500, undefined, {
                    message: "Failed to read data.",
                })
            );
        }

        if (eth_boa_rate === null) {
            return res.json(
                BridgeRouter.makeResponseData(500, undefined, {
                    message: "Failed to read data.",
                })
            );
        }

        let calculated_swap_fee: Amount;
        let calculated_tx_fee: Amount | null;
        if (type === BridgeType.BOA) {
            const direction = Number(req.query.direction) as BridgeDirection;
            const decimal = direction === BridgeDirection.ETHNET_BIZNET ? BOAToken.DECIMAL : BOACoin.DECIMAL;
            calculated_swap_fee = this._contract_manager.getSwapFee(BigNumber.from(req.query.amount), decimal);
            calculated_tx_fee = this._contract_manager.getEstimatedTxFee(gas_price, eth_boa_rate, direction, decimal);
        } else {
            const direction = Number(req.query.direction) as BridgeDirection;
            const decimal = BOACoin.DECIMAL;
            calculated_swap_fee = this._token_contract_manager.getSwapFee(BigNumber.from(req.query.amount), decimal);
            calculated_tx_fee = this._token_contract_manager.getEstimatedTxFee(
                gas_price,
                eth_boa_rate,
                direction,
                decimal
            );
        }

        if (calculated_tx_fee !== null) {
            return res.json(
                BridgeRouter.makeResponseData(200, {
                    swap_fee: calculated_swap_fee.toString(),
                    tx_fee: calculated_tx_fee.toString(),
                })
            );
        } else {
            return res.json(
                BridgeRouter.makeResponseData(500, undefined, {
                    message: "Failed to read data.",
                })
            );
        }
    }
}
