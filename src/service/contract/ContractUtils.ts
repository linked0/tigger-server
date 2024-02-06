/**
 *  Includes various useful functions for the solidity
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import crypto from "crypto";
import { BigNumber, ethers } from "ethers";
import { BOACoinBridge, BOATokenBridge, ERC20, TokenBridge } from "../../../typechain";
import { BridgeLockBoxStates, IBridgeLockBoxInfo, IVMError } from "../types";

export class ContractUtils {
    /**
     * It generates 32-bytes random data.
     */
    public static createKey(): Buffer {
        return crypto.randomBytes(32);
    }

    /**
     * It generates hash values.
     * @param data The source data
     */
    public static sha256(data: Buffer): Buffer {
        return crypto.createHash("sha256").update(data).digest();
    }

    /**
     * Convert hexadecimal strings into Buffer.
     * @param hex The hexadecimal string
     */
    public static StringToBuffer(hex: string): Buffer {
        const start = hex.substring(0, 2) === "0x" ? 2 : 0;
        return Buffer.from(hex.substring(start), "hex");
    }

    /**
     * Convert Buffer into hexadecimal strings.
     * @param data The data
     */
    public static BufferToString(data: Buffer): string {
        return "0x" + data.toString("hex");
    }

    /**
     * Create the ID of lock box
     */
    public static createLockBoxID(): Buffer {
        const baseTimestamp = new Date(2020, 0, 1).getTime();
        const nowTimestamp = new Date().getTime();
        const value = Math.floor((nowTimestamp - baseTimestamp) / 1000);
        const timestamp_buffer = Buffer.alloc(4);
        timestamp_buffer.writeUInt32BE(value, 0);
        return Buffer.concat([timestamp_buffer, crypto.randomBytes(28)]);
    }

    /**
     * Get epoch Unix Timestamp
     */
    public static getTimeStamp(): number {
        return Math.floor(new Date().getTime() / 1000);
    }

    /**
     * Wait until "ERC20.approve" is completed. When a timeout occurs, call reject().
     * @param token     The contract of token
     * @param owner     The address of owner
     * @param spender   The address of spender
     * @param amount    The amount
     * @param timeout   The timeout (unit is second), default is 5 minutes
     * @param interval
     */
    public static waitingForAllowance(
        token: ERC20,
        owner: string,
        spender: string,
        amount: BigNumber,
        timeout: number = 600,
        interval: number = 1000
    ): Promise<BigNumber> {
        return new Promise<BigNumber>(async (resolve, reject) => {
            const start = ContractUtils.getTimeStamp();
            const check = async () => {
                const allowance_amount = await token.allowance(owner, spender);
                if (allowance_amount.gte(amount)) {
                    resolve(allowance_amount);
                } else {
                    const now = ContractUtils.getTimeStamp();
                    if (now - start < timeout) setTimeout(check, interval);
                    else reject(new Error("A timeout occurred."));
                }
            };
            await check();
        });
    }

    /**
     * Get information of the deposit lock box
     * @param swap  The contract of Swap
     * @param id    The ID of lock box
     */
    public static getBridgeDepositLockBoxInfo(
        swap: BOACoinBridge | BOATokenBridge,
        id: string
    ): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>((resolve, reject) => {
            swap.checkDeposit(id)
                .then((result) => {
                    resolve({
                        id,
                        state: result[0],
                        token_id: "",
                        time_lock: result[1].toNumber(),
                        amount: result[2],
                        swap_fee: result[3],
                        tx_fee: result[4],
                        trader_address: result[5],
                        withdraw_address: result[6],
                        secret_lock: result[7],
                        create_time: result[8].toNumber(),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * Get information of the withdrawal lock box
     * @param bridge  The contract of the bridge
     * @param id      The ID of lock box
     */
    public static getBridgeWithdrawLockBoxInfo(
        bridge: BOACoinBridge | BOATokenBridge,
        id: string
    ): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>((resolve, reject) => {
            bridge
                .checkWithdraw(id)
                .then((result) => {
                    resolve({
                        id,
                        state: result[0],
                        token_id: "",
                        time_lock: result[1].toNumber(),
                        amount: result[2],
                        swap_fee: result[3],
                        tx_fee: result[4],
                        trader_address: result[5],
                        withdraw_address: result[6],
                        secret_lock: result[7],
                        create_time: result[8].toNumber(),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * Wait until the deposit lock box opens. When a timeout occurs, call reject().
     * @param swap  The contract of Swap
     * @param id    The ID of lock box
     * @param timeout   The timeout (unit is second), default is 5 minutes
     * @param interval
     */
    public static waitingForBridgeOpeningDeposit(
        swap: BOACoinBridge | BOATokenBridge,
        id: string,
        timeout: number = 600,
        interval: number = 1000
    ): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>(async (resolve, reject) => {
            const start = ContractUtils.getTimeStamp();
            const check = async () => {
                let result: IBridgeLockBoxInfo | undefined;
                let success: boolean = false;
                try {
                    result = await ContractUtils.getBridgeDepositLockBoxInfo(swap, id);
                    success = result.state === BridgeLockBoxStates.OPEN;
                } catch (err) {
                    result = undefined;
                }

                if (success && result) {
                    resolve(result);
                } else {
                    const now = ContractUtils.getTimeStamp();
                    if (now - start < timeout) setTimeout(check, interval);
                    else reject(new Error("A timeout occurred."));
                }
            };
            await check();
        });
    }

    /**
     * Get information of the deposit lock box
     * @param swap  The contract of Swap
     * @param id    The ID of lock box
     */
    public static getTokenBridgeDepositLockBoxInfo(swap: TokenBridge, id: string): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>((resolve, reject) => {
            swap.checkDeposit(id)
                .then((result) => {
                    resolve({
                        id,
                        state: result[0],
                        token_id: result[1],
                        time_lock: result[2].toNumber(),
                        amount: result[3],
                        swap_fee: BigNumber.from(0),
                        tx_fee: result[4],
                        trader_address: result[5],
                        withdraw_address: result[6],
                        secret_lock: result[7],
                        create_time: result[8].toNumber(),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * Get information of the withdrawal lock box
     * @param bridge  The contract of the bridge
     * @param id      The ID of lock box
     */
    public static getTokenBridgeWithdrawLockBoxInfo(bridge: TokenBridge, id: string): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>((resolve, reject) => {
            bridge
                .checkWithdraw(id)
                .then((result) => {
                    resolve({
                        id,
                        state: result[0],
                        token_id: result[1],
                        time_lock: result[2].toNumber(),
                        amount: result[3],
                        swap_fee: BigNumber.from(0),
                        tx_fee: BigNumber.from(0),
                        trader_address: result[4],
                        withdraw_address: result[5],
                        secret_lock: result[6],
                        create_time: result[7].toNumber(),
                    });
                })
                .catch((reason) => {
                    if (reason instanceof Error) return reject(reason);
                    return reject(new Error(reason));
                });
        });
    }

    /**
     * Wait until the deposit lock box opens. When a timeout occurs, call reject().
     * @param swap  The contract of Swap
     * @param id    The ID of lock box
     * @param timeout   The timeout (unit is second), default is 5 minutes
     * @param interval
     */
    public static waitingForTokenBridgeOpeningDeposit(
        swap: TokenBridge,
        id: string,
        timeout: number = 600,
        interval: number = 1000
    ): Promise<IBridgeLockBoxInfo> {
        return new Promise<IBridgeLockBoxInfo>(async (resolve, reject) => {
            const start = ContractUtils.getTimeStamp();
            const check = async () => {
                let result: IBridgeLockBoxInfo | undefined;
                let success: boolean = false;
                try {
                    result = await ContractUtils.getTokenBridgeDepositLockBoxInfo(swap, id);
                    success = result.state === BridgeLockBoxStates.OPEN;
                } catch (err) {
                    result = undefined;
                }

                if (success && result) {
                    resolve(result);
                } else {
                    const now = ContractUtils.getTimeStamp();
                    if (now - start < timeout) setTimeout(check, interval);
                    else reject(new Error("A timeout occurred."));
                }
            };
            await check();
        });
    }

    private static find_message = "reverted with reason string";
    private static find_length = ContractUtils.find_message.length;
    public static getVMError(error: any): IVMError {
        if (error instanceof Error) {
            const idx = error.message.indexOf(ContractUtils.find_message);
            const message =
                idx >= 0
                    ? error.message.substring(idx + ContractUtils.find_length).replace(/['|"]/gi, "")
                    : error.message;
            const fields = message.split("|");
            if (fields.length === 1) return { message: fields[0], code: "" };
            else return { message: fields[0], code: fields[1] };
        } else if (error.message) {
            return { message: error.message, code: "" };
        } else {
            return { message: error.toString(), code: "" };
        }
    }

    /**
     * It generates hash values.
     * @param address
     * @param name
     * @param symbol
     */
    public static getTokenId(address: string, tokenAddress: string): Buffer {
        return crypto
            .createHash("sha256")
            .update(ContractUtils.StringToBuffer(address))
            .update(ContractUtils.StringToBuffer(tokenAddress))
            .digest();
    }

    public static SignerMap: Map<string, ethers.Signer> = new Map<string, ethers.Signer>();
    public static getManagerSigner(network: string, address: string): ethers.Signer | undefined {
        const key = network + "_" + address;
        return ContractUtils.SignerMap.get(key);
    }

    public static setManagerSigner(network: string, address: string, signer: ethers.Signer) {
        const key = network + "_" + address;
        ContractUtils.SignerMap.set(key, signer);
    }
}

/**
 * Value when 1BOA is stored
 */
const UNIT_PER_COIN: number = 10_000_000;

/**
 * Decimal Digits in a BOA
 */
const LENGTH_DECIMAL: number = 7;

/**
 * Convert the amount of BOA units with seven decimal points into `BigNumber` with internal data.
 * @param value The monetary amount to be converted
 */
export function BOA(value: string | number): BigNumber {
    const amount = value.toString();
    if (amount === "") return BigNumber.from("0");
    const numbers = amount.replace(/[,_]/gi, "").split(".");
    if (numbers.length === 1) return BigNumber.from(numbers[0] + "0000000");
    let tx_decimal = numbers[1];
    if (tx_decimal.length > LENGTH_DECIMAL) tx_decimal = tx_decimal.slice(0, LENGTH_DECIMAL);
    else if (tx_decimal.length < LENGTH_DECIMAL) tx_decimal = tx_decimal.padEnd(LENGTH_DECIMAL, "0");
    const integral = BigNumber.from(numbers[0] + "0000000");
    return integral.add(BigNumber.from(tx_decimal));
}
