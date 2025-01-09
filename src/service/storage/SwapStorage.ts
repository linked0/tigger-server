/**
 *  The class that creates, inserts and reads the ledger into the database.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { BigNumber } from "ethers";
import MybatisMapper from "mybatis-mapper";
// tslint:disable-next-line:no-submodule-imports
import * as mysql from "mysql2/promise";
import path from "path";
import { Storage } from "../../modules/storage/Storage";
import { Utils } from "../../modules/utils/Utils";
import { IDatabaseConfig } from "../common/Config";
import {
    BridgeDirection,
    BridgeLockBoxStates,
    BridgeProcessStatus,
    BridgeType,
    IBridgeSwapInfo,
    IBridgeSwapInfoInternal,
    IBridgeVMError,
    ICoinPrice,
    IGasPrice,
} from "../types";

/**
 * The class that inserts and reads the ledger into the database.
 */
export class SwapStorage extends Storage {
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        super(databaseConfig, callback);
        MybatisMapper.createMapper([
            path.resolve(Utils.getInitCWD(), "src/service/storage/mapper/table.xml"),
            path.resolve(Utils.getInitCWD(), "src/service/storage/mapper/bridge.xml"),
            path.resolve(Utils.getInitCWD(), "src/service/storage/mapper/etc.xml"),
        ]);
    }
    /**
     * Construct an instance of `SwapStorage` using `Promise` API.
     *
     * @param databaseConfig
     */
    public static make(databaseConfig: IDatabaseConfig): Promise<SwapStorage> {
        return new Promise<SwapStorage>((resolve, reject) => {
            const result = new SwapStorage(databaseConfig, (err: Error | null) => {
                if (err) reject(err);
                else resolve(result);
            });
            return result;
        });
    }

    /**
     * Creates tables related to the ledger.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public createTables(): Promise<void> {
        return this.exec(MybatisMapper.getStatement("table", "create_table"));
    }

    /**
     * Drop Database
     * Use this only in the test code.
     * @param database The name of database
     */
    public async dropTestDB(database: any): Promise<void> {
        return this.exec(MybatisMapper.getStatement("table", "drop_table", { database }));
    }

    public postBridgeSwap(
        id: string,
        type: BridgeType,
        trader_address: string,
        withdraw_address: string,
        amount: string,
        swap_fee: string,
        tx_fee: string,
        direction: BridgeDirection,
        secret_lock: string,
        deposit_tx_hash: string,
        conn?: mysql.PoolConnection
    ): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.queryForMapper(
                "bridge",
                "postBridgeSwap",
                {
                    id,
                    type,
                    trader_address,
                    withdraw_address,
                    amount,
                    swap_fee,
                    tx_fee,
                    direction,
                    secret_lock,
                    deposit_tx_hash,
                },
                conn
            )
                .then(() => {
                    return resolve();
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getBridgeSwap(id: string, conn?: mysql.PoolConnection): Promise<IBridgeSwapInfo[]> {
        return new Promise<IBridgeSwapInfo[]>(async (resolve, reject) => {
            this.queryForMapper("bridge", "getBridgeSwap", { id }, conn)
                .then((rows: any[]) => {
                    return resolve(
                        rows.map((m) => {
                            return {
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
                                withdraw_time_diff: m.withdraw_time_diff,
                                process_status: m.process_status,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public getBridgeSwapList(
        trade_address: string,
        page_size: number,
        page_index: number,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "getBridgeSwapList",
            {
                trade_address,
                page_size,
                offset: page_size * (page_index - 1),
            },
            conn
        );
    }

    public getBridgeWaitingSwap(conn?: mysql.PoolConnection): Promise<IBridgeSwapInfoInternal[]> {
        return new Promise<IBridgeSwapInfoInternal[]>(async (resolve, reject) => {
            this.queryForMapper("bridge", "getBridgeWaitingSwap", {}, conn)
                .then((rows: any[]) => {
                    return resolve(
                        rows.map((m) => {
                            return {
                                id: m.id,
                                type: m.type,
                                trader_address: m.trader_address,
                                withdraw_address: m.withdraw_address,
                                amount: m.amount,
                                swap_fee: m.swap_fee,
                                tx_fee: m.tx_fee,
                                direction: m.direction,
                                secret_lock: m.secret_lock,
                                secret_key: m.secret_key,
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
                                withdraw_time_diff: m.withdraw_time_diff,
                                process_status: m.process_status,
                                process_update_time: m.process_update_time,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateBridgeDeposit(
        id: string,
        trader_address: string,
        withdraw_address: string,
        amount: BigNumber,
        swap_fee: BigNumber,
        tx_fee: BigNumber,
        secret_lock: string,
        deposit_state: BridgeLockBoxStates,
        deposit_token_id: string,
        deposit_time_lock: number,
        deposit_create_time: number,
        process_status: BridgeProcessStatus,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeDeposit",
            {
                trader_address,
                withdraw_address,
                amount: amount.toString(),
                swap_fee: swap_fee.toString(),
                tx_fee: tx_fee.toString(),
                secret_lock,
                deposit_state,
                deposit_token_id,
                deposit_time_lock,
                deposit_create_time,
                process_status,
                id,
            },
            conn
        );
    }

    public updateBridgeWithdraw(
        id: string,
        withdraw_state: BridgeLockBoxStates,
        withdraw_token_id: string,
        withdraw_time_lock: number,
        withdraw_create_time: number,
        process_status: BridgeProcessStatus,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeWithdraw",
            {
                withdraw_state,
                withdraw_token_id,
                withdraw_time_lock,
                withdraw_create_time,
                process_status,
                id,
            },
            conn
        );
    }

    public updateBridgeWithdrawTimeDiff(
        id: string,
        withdraw_time_diff: number,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeWithdrawTimeDiff",
            {
                withdraw_time_diff,
                id,
            },
            conn
        );
    }

    public updateBridgeWithdrawTxHash(
        id: string,
        withdraw_tx_hash: string,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeWithdrawTxHash",
            {
                withdraw_tx_hash,
                id,
            },
            conn
        );
    }

    public updateBridgeProcessStatus(
        id: string,
        process_status: BridgeProcessStatus,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeProcessStatus",
            {
                process_status,
                id,
            },
            conn
        );
    }

    public updateBridgeProcessTime(
        id: string,
        process_update_time: number,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "updateBridgeProcessTime",
            {
                process_update_time,
                id,
            },
            conn
        );
    }

    public getBridgeVMError(id: string, task: string, conn?: mysql.PoolConnection): Promise<IBridgeVMError> {
        return new Promise<IBridgeVMError>(async (resolve, reject) => {
            this.queryForMapper(
                "bridge",
                "getBridgeVMError",
                {
                    id,
                    task,
                },
                conn
            )
                .then((rows: any[]) => {
                    if (rows.length > 0) {
                        return resolve({
                            id: rows[0].id,
                            task: rows[0].task,
                            is_error: true,
                            message: rows[0].message,
                            code: rows[0].code,
                            is_retry: rows[0].is_retry === "Y",
                            next_try_time: rows[0].next_try_time,
                            num_retry: rows[0].num_retry,
                        });
                    } else {
                        return resolve({
                            id,
                            task,
                            is_error: false,
                            message: "",
                            code: "",
                            is_retry: true,
                            next_try_time: 0,
                            num_retry: 0,
                        });
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    public updateBridgeVMError(
        id: string,
        task: string,
        message: string,
        code: string,
        is_retry: boolean,
        num_retry: number,
        second: number = 60,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        if (message.length > 256) message = message.substring(0, 255);
        const time = Math.floor(new Date().getTime() / 1000) + second;
        return this.queryForMapper(
            "bridge",
            "updateBridgeVMError",
            {
                id,
                task,
                code,
                message,
                is_retry: is_retry ? "Y" : "N",
                next_try_time: time,
                num_retry,
            },
            conn
        );
    }

    public clearBridgeVMError(id: string, task: string, conn?: mysql.PoolConnection): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "clearBridgeVMError",
            {
                id,
                task,
            },
            conn
        );
    }

    public postBridgeSwapForSampleData(
        id: string,
        trader_address: string,
        withdraw_address: string,
        amount: string,
        direction: BridgeDirection,
        secret_lock: string,
        deposit_state: BridgeLockBoxStates,
        deposit_time_lock: number,
        deposit_create_time: number,
        withdraw_state: BridgeLockBoxStates,
        withdraw_time_lock: number,
        withdraw_create_time: number,
        process_status: BridgeProcessStatus,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return this.queryForMapper(
            "bridge",
            "postBridgeSwapForSampleData",
            {
                id,
                type: BridgeType.BOA,
                trader_address,
                withdraw_address,
                amount,
                swap_fee: 0,
                tx_fee: 0,
                coin_swap_fee: 0,
                coin_tx_fee: 0,
                direction,
                secret_lock,
                deposit_state,
                deposit_time_lock,
                deposit_create_time,
                withdraw_state,
                withdraw_time_lock,
                withdraw_create_time,
                process_status,
            },
            conn
        );
    }

    public updateBridgeSecretKey(id: string, secret_key: string, conn?: mysql.PoolConnection): Promise<any[]> {
        return this.queryForMapper("bridge", "updateBridgeSecretKey", { id, secret_key }, conn);
    }

    /**
     * 코인의 시세를 저장한다.
     * @param prices 코인의 가격정보
     * @param conn
     */
    public updateCoinPrice(prices: ICoinPrice[], conn?: mysql.PoolConnection): Promise<any[]> {
        if (prices.length === 0) return Promise.resolve([]);
        return this.queryForMapper("etc", "updateCoinPrice", { prices: prices as [] }, conn);
    }

    /**
     * 코인의 시세를 조회한다
     * @param conn
     */
    public getCoinPrices(conn?: mysql.PoolConnection): Promise<ICoinPrice[]> {
        return new Promise<ICoinPrice[]>(async (resolve, reject) => {
            this.queryForMapper("etc", "getCoinPrices", {}, conn)
                .then((rows: any[]) => {
                    return resolve(
                        rows.map((m) => {
                            return {
                                source: m.source,
                                symbol: m.symbol,
                                usd: m.usd,
                                krw: m.krw,
                                last_updated_at: m.last_updated_at,
                            };
                        })
                    );
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * BOA 코인의 최종시세를 KRW로 조회한다
     * @param conn
     */
    public getLatestBOAKrwPrice(conn?: mysql.PoolConnection): Promise<BigNumber | null> {
        return new Promise<BigNumber>(async (resolve, reject) => {
            this.queryForMapper("etc", "getLastBOAPrices", {}, conn)
                .then((rows: any[]) => {
                    if (rows?.length) {
                        const krwPrice = BigNumber.from(Math.floor(rows[0].krw));
                        return resolve(krwPrice);
                    } else {
                        return reject(new Error("Data does not exist."));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * 이더리움의 Gas Price 를 저장한다.
     * @param price 이더리움의 Gas Price
     * @param conn
     */
    public updateGasPrice(price: IGasPrice, conn?: mysql.PoolConnection): Promise<any[]> {
        return this.queryForMapper("etc", "updateGasPrice", price as any, conn);
    }

    /**
     * 이더리움의 Gas Price 를 조회한다
     * @param conn
     */
    public getGasPrice(conn?: mysql.PoolConnection): Promise<IGasPrice> {
        return new Promise<IGasPrice>(async (resolve, reject) => {
            this.queryForMapper("etc", "getGasPrice", {}, conn)
                .then((rows: any[]) => {
                    if (rows.length > 0) {
                        return resolve({
                            symbol: rows[0].symbol,
                            fast: rows[0].fast,
                            low: rows[0].low,
                            average: rows[0].average,
                            last_updated_at: rows[0].last_updated_at,
                        });
                    } else {
                        return reject(new Error("Gas price information does not exist."));
                    }
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * 평균 가스가격을 제공한다
     */
    public async getStandardGasPrice(): Promise<number | null> {
        try {
            const value = await this.getGasPrice();
            return value.average;
        } catch (e) {
            return null;
        }
    }

    /**
     * ETH 가격 / BOA 가격 을 제공한다.
     */
    public async getEthBoaRate(): Promise<number | null> {
        try {
            let eth: number | undefined;
            let boa: number | undefined;
            const res = await this.getCoinPrices();
            for (const m of res) {
                if (m.symbol === "ETH") eth = m.krw;
                if (m.symbol === "BOA") boa = m.krw;
            }
            if (eth && boa && eth !== 0 && boa !== 0) return eth / boa;
            else return null;
        } catch (e) {
            return null;
        }
    }
}
