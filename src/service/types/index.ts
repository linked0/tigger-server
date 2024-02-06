/**
 *  Includes various types
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { BigNumber } from "ethers";

/**
 * The state of lock box for BOA's bridge
 */
export enum BridgeLockBoxStates {
    INVALID = 0,
    OPEN = 1,
    CLOSED = 2,
    EXPIRED = 3,
}

/**
 * The direction of swap for BOA's bridge
 */
export enum BridgeDirection {
    ETHNET_BIZNET = 0,
    BIZNET_ETHNET = 1,
}

/**
 * The type of asset to be exchanged
 */
export enum BridgeType {
    BOA = 0, // BOA native token in BizNet <=> BOA token in Ethereum
    TOKEN = 1, // Other tokens in BizNet <=> Other tokens in Ethereum
}

/**
 * Information about the lock box in a contract for bridge
 */
export interface IBridgeLockBoxInfo {
    id: string;
    state: number;
    time_lock: number;
    trader_address: string;
    withdraw_address: string;
    amount: BigNumber;
    swap_fee: BigNumber;
    tx_fee: BigNumber;
    secret_lock: string;
    create_time: number;
    token_id: string;
}

export interface IBridgeSwapInfo {
    id: string;
    type: BridgeType;
    trader_address: string;
    withdraw_address: string;
    amount: string;
    swap_fee: string;
    tx_fee: string;
    direction: BridgeDirection;
    secret_lock: string;
    deposit_state: BridgeLockBoxStates;
    deposit_token_id: string;
    deposit_time_lock: number;
    deposit_create_time: number;
    deposit_tx_hash: string;
    withdraw_state: BridgeLockBoxStates;
    withdraw_token_id: string;
    withdraw_time_lock: number;
    withdraw_create_time: number;
    withdraw_tx_hash: string;
    withdraw_time_diff: number;
    process_status: BridgeProcessStatus;
}

export interface IBridgeSwapInfoInternal extends IBridgeSwapInfo {
    secret_key: string;
    process_update_time: number;
}

export interface IBridgeVMError {
    id: string;
    task: string;
    is_error: boolean;
    message: string;
    code: string;
    is_retry: boolean;
    next_try_time: number;
    num_retry: number;
}

export enum BridgeProcessStatus {
    NONE = 0,
    // FINISHED_OPENING_DEPOSIT = 11, //  User Action
    CONFIRMED_OPENING_DEPOSIT = 12,
    ERROR_OPENING_DEPOSIT = 13,
    FINISHED_OPENING_WITHDRAW = 21,
    CONFIRMED_OPENING_WITHDRAW = 22,
    ERROR_OPENING_WITHDRAW = 23,
    FINISHED_CLOSING_WITHDRAW = 31, //  User Action
    CONFIRMED_CLOSING_WITHDRAW = 32,
    ERROR_CLOSING_WITHDRAW = 33,
    FINISHED_CLOSING_DEPOSIT = 41,
    CONFIRMED_CLOSING_DEPOSIT = 42,
    ERROR_CLOSING_DEPOSIT = 43,

    STARTED_EXPIRE_WITHDRAW = 50,
    FINISHED_EXPIRE_WITHDRAW = 51,
    CONFIRMED_EXPIRE_WITHDRAW = 52,
    ERROR_EXPIRE_WITHDRAW = 53,

    ERROR_INVALID_SWAP = 99,
}

export interface IVMError {
    message: string;
    code: string;
}

export interface IBridgeSwapHistory {
    header: IBridgeSwapHeader;
    items: IBridgeSwapItem[];
}

export interface IBridgeSwapHeader {
    address: string;
    page_size: number;
    page: number;
    total_page: number;
}

export interface IBridgeSwapItem {
    id: string;
    type: BridgeType;
    trader_address: string;
    withdraw_address: string;
    amount: string;
    swap_fee: string;
    tx_fee: string;
    direction: BridgeDirection;
    secret_lock: string;
    deposit_state: BridgeLockBoxStates;
    deposit_token_id: string;
    deposit_time_lock: number;
    deposit_create_time: number;
    deposit_tx_hash: string;
    withdraw_state: BridgeLockBoxStates;
    withdraw_token_id: string;
    withdraw_time_lock: number;
    withdraw_create_time: number;
    withdraw_tx_hash: string;
    process_status: BridgeProcessStatus;
}

export interface ICoinPrice {
    source: string;
    symbol: string;
    krw: number;
    usd: number;
    last_updated_at: number;
}

export interface IGasPrice {
    symbol: string;
    fast: number;
    low: number;
    average: number;
    last_updated_at: number;
}
