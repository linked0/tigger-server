/**
 *  The Tasks of BOA Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { Amount, BOACoin, BOAToken } from "../../common/Amount";
import { Config } from "../../common/Config";
import { logger } from "../../common/Logger";
import { BOABridgeContractManager } from "../../contract/BOABridgeContractManager";
import { ContractUtils } from "../../contract/ContractUtils";
import { SwapStorage } from "../../storage/SwapStorage";
import {
    BridgeDirection,
    BridgeLockBoxStates,
    BridgeProcessStatus,
    IBridgeLockBoxInfo,
    IBridgeSwapInfoInternal,
} from "../../types";
import { BridgeTasks, TaskName } from "./BridgeTasks";

import { BigNumber } from "ethers";

/**
 * EthNet 의 BOA 와 BizNet 의 BOA 를 서로 교환하는 작업을 진행하는 스케줄러 클래스
 */
export class BOABridgeTasks extends BridgeTasks {
    public _contract_manager: BOABridgeContractManager | undefined;

    /**
     * 스마트컨트랙트의 인스턴스를 제공해 주는 인스턴스
     * @private
     */
    private get contract_manager(): BOABridgeContractManager {
        if (this._contract_manager !== undefined) return this._contract_manager;
        else {
            logger.error("Bridge is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * 실행에 필요한 여러 객체를 설정한다
     * @param options 옵션
     */
    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof SwapStorage) this._storage = options.storage;
            if (options.bridge_contract_manager && options.bridge_contract_manager instanceof BOABridgeContractManager)
                this._contract_manager = options.bridge_contract_manager;
        }
    }

    /**
     * 소스측의 박스가 오픈된 것을 확인한다.
     * @param swap Swap Data
     */
    public async checkDepositIsOpened(swap: IBridgeSwapInfoInternal) {
        const gas_price = await this.storage.getStandardGasPrice();
        const eth_boa_rate = await this.storage.getEthBoaRate();
        if (gas_price === null) {
            logger.error("This task will be put on hold because the Ethereum gas price is unknown.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        if (eth_boa_rate === null) {
            logger.error("This task will be put on hold because the ETH & BOA price is unknown.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const source_bridge = this.contract_manager.getSourceBridgeWithSigner(swap.direction);
        if (source_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const task = async () => {
            try {
                return { deposit_box: await ContractUtils.getBridgeDepositLockBoxInfo(source_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check deposit lock box opening", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.CheckDepositIsOpened, task);

        if (!result || !result.deposit_box) return;
        const deposit_box: IBridgeLockBoxInfo = result.deposit_box;

        const decimal = swap.direction === BridgeDirection.ETHNET_BIZNET ? BOAToken.DECIMAL : BOACoin.DECIMAL;

        if (deposit_box.state === BridgeLockBoxStates.OPEN) {
            const calculated_swap_fee = this.contract_manager.getSwapFee(deposit_box.amount, decimal);
            const calculated_tx_fee = this.contract_manager.getEstimatedTxFee(
                gas_price,
                eth_boa_rate,
                swap.direction,
                decimal
            );
            const tolerance = 0.1; // 현재 계산한 트랜잭션 수수료와 프론트가 설정한 수수료와의 오차범위 - 10%
            if (calculated_tx_fee === null || calculated_tx_fee.value.eq(0)) {
                logger.error("The transaction fee of the network does not exist.", {
                    id: swap.id,
                    status: swap.process_status,
                });
                return;
            }

            if (deposit_box.swap_fee.lt(calculated_swap_fee.value)) {
                logger.error("The swap fee is inappropriate.", {
                    id: swap.id,
                    status: swap.process_status,
                });
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.ERROR_OPENING_DEPOSIT);
                return;
            }

            if (deposit_box.tx_fee < calculated_tx_fee.value) {
                let fee1: number;
                let fee2: number;
                const precision = 5;
                if (swap.direction === BridgeDirection.ETHNET_BIZNET) {
                    fee1 = deposit_box.tx_fee.div(BigNumber.from(10).pow(BOAToken.DECIMAL - precision)).toNumber();
                    fee2 = calculated_tx_fee.value.div(BigNumber.from(10).pow(BOAToken.DECIMAL - precision)).toNumber();
                } else {
                    fee1 = deposit_box.tx_fee.div(BigNumber.from(10).pow(BOACoin.DECIMAL - precision)).toNumber();
                    fee2 = calculated_tx_fee.value.div(BigNumber.from(10).pow(BOACoin.DECIMAL - precision)).toNumber();
                }
                if (Math.abs(fee1 / fee2 - 1.0) > tolerance) {
                    logger.error("The transaction fee is inappropriate.", {
                        id: swap.id,
                        status: swap.process_status,
                    });
                    await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.ERROR_OPENING_DEPOSIT);
                    return;
                }
            }

            const expire_timestamp = deposit_box.time_lock + deposit_box.create_time;
            const now_timestamp = ContractUtils.getTimeStamp();
            if (expire_timestamp - now_timestamp >= deposit_box.time_lock / 2) {
                await this.storage.updateBridgeDeposit(
                    deposit_box.id,
                    deposit_box.trader_address,
                    deposit_box.withdraw_address,
                    deposit_box.amount,
                    deposit_box.swap_fee,
                    deposit_box.tx_fee,
                    deposit_box.secret_lock,
                    deposit_box.state,
                    deposit_box.token_id,
                    deposit_box.time_lock,
                    deposit_box.create_time,
                    BridgeProcessStatus.CONFIRMED_OPENING_DEPOSIT
                );
            } else {
                await this.storage.updateBridgeDeposit(
                    deposit_box.id,
                    deposit_box.trader_address,
                    deposit_box.withdraw_address,
                    deposit_box.amount,
                    deposit_box.swap_fee,
                    deposit_box.tx_fee,
                    deposit_box.secret_lock,
                    deposit_box.state,
                    deposit_box.token_id,
                    deposit_box.time_lock,
                    deposit_box.create_time,
                    BridgeProcessStatus.ERROR_OPENING_DEPOSIT
                );
            }
        } else if (
            deposit_box.state === BridgeLockBoxStates.CLOSED ||
            deposit_box.state === BridgeLockBoxStates.EXPIRED
        ) {
            await this.storage.updateBridgeDeposit(
                deposit_box.id,
                deposit_box.trader_address,
                deposit_box.withdraw_address,
                deposit_box.amount,
                deposit_box.swap_fee,
                deposit_box.tx_fee,
                deposit_box.secret_lock,
                deposit_box.state,
                deposit_box.token_id,
                deposit_box.time_lock,
                deposit_box.create_time,
                BridgeProcessStatus.ERROR_OPENING_DEPOSIT
            );
        }
    }

    /**
     * 타켓측의 박스를 오픈한다.
     * @param swap Swap Data
     */
    public async openWithdraw(swap: IBridgeSwapInfoInternal) {
        // Deposit Box 의 정보와 데이타베이스의 SWAP 정보가 동일한지 한번더 검증한다 (데이타베이스 검증)
        {
            const source_bridge = this.contract_manager.getSourceBridgeWithSigner(swap.direction);
            if (source_bridge === null) {
                logger.error("The bridge contract of the network does not exist.", {
                    id: swap.id,
                    status: swap.process_status,
                });
                return;
            }

            const task_deposit = async () => {
                try {
                    return { deposit_box: await ContractUtils.getBridgeDepositLockBoxInfo(source_bridge, swap.id) };
                } catch (error) {
                    const vm_error = ContractUtils.getVMError(error);
                    logger.error("Failed to check deposit lock box opening", {
                        id: swap.id,
                        status: swap.process_status,
                        vm_message: vm_error.message,
                        vm_code: vm_error.code,
                    });
                    return { vm_error };
                }
            };

            const result_deposit = await this.runVMTask(swap.id, TaskName.CheckDepositIsOpened, task_deposit);

            if (!result_deposit || !result_deposit.deposit_box) return;
            const deposit_box: IBridgeLockBoxInfo = result_deposit.deposit_box;

            // 이전 단계에서 이미 열려 있음을 확인했는데, 그렇지 않다는것은 데이타베이스가 변조되었을 가능성이 있다.
            if (deposit_box.state !== BridgeLockBoxStates.OPEN) {
                logger.error("Failed to open withdraw lock box - Not open deposit lock box", {
                    id: swap.id,
                    status: swap.process_status,
                });
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.ERROR_OPENING_WITHDRAW);
                return;
            }

            // 이전 단계에서 이미 확인했는데, 그렇지 않다는것은 데이타베이스가 변조되었을 가능성이 있다.
            if (
                deposit_box.trader_address !== swap.trader_address ||
                deposit_box.withdraw_address !== swap.withdraw_address ||
                deposit_box.secret_lock !== swap.secret_lock ||
                deposit_box.time_lock !== swap.deposit_time_lock ||
                deposit_box.create_time !== swap.deposit_create_time
            ) {
                logger.error("Failed to open withdraw lock box - The information in the deposit box does not match.", {
                    id: swap.id,
                    status: swap.process_status,
                });
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.ERROR_OPENING_WITHDRAW);
                return;
            }
        }

        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const task = async () => {
            try {
                return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check withdraw lock box", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        // 이전의 VM 오류를 가지고 온다. 연속적으로 오류가 발생하는 것을 방지한다.
        const result = await this.runVMTask(swap.id, TaskName.CheckWithdrawIsNone, task);

        if (!result || !result.withdraw_box) return;
        const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box;

        let source_amount: Amount;
        let source_swap_fee: Amount;
        let source_tx_fee: Amount;
        let target_amount: Amount;
        let target_swap_fee: Amount;
        let target_tx_fee: Amount;
        if (swap.direction === BridgeDirection.ETHNET_BIZNET) {
            source_amount = new BOAToken(BigNumber.from(swap.amount));
            source_swap_fee = new BOAToken(BigNumber.from(swap.swap_fee));
            source_tx_fee = new BOAToken(BigNumber.from(swap.tx_fee));
            target_amount = source_amount.convert(BOACoin.DECIMAL);
            target_swap_fee = source_swap_fee.convert(BOACoin.DECIMAL);
            target_tx_fee = source_tx_fee.convert(BOACoin.DECIMAL);
        } else {
            source_amount = new BOACoin(BigNumber.from(swap.amount));
            source_swap_fee = new BOACoin(BigNumber.from(swap.swap_fee));
            source_tx_fee = new BOACoin(BigNumber.from(swap.tx_fee));
            target_amount = source_amount.convert(BOAToken.DECIMAL);
            target_swap_fee = source_swap_fee.convert(BOAToken.DECIMAL);
            target_tx_fee = source_tx_fee.convert(BOAToken.DECIMAL);
        }

        // 박스가 존재하지 않을 때 생성한다.
        if (withdraw_box.state === BridgeLockBoxStates.INVALID) {
            const task2 = async () => {
                try {
                    await target_bridge.openWithdraw(
                        swap.id,
                        target_amount.value,
                        target_swap_fee.value,
                        target_tx_fee.value,
                        swap.trader_address,
                        swap.withdraw_address,
                        swap.secret_lock
                    );
                } catch (error) {
                    await this.contract_manager.resetTargetTransactionCount(swap.direction);
                    const vm_error = ContractUtils.getVMError(error);
                    logger.error("Failed to open withdraw lock box", {
                        id: swap.id,
                        status: swap.process_status,
                        vm_message: vm_error.message,
                        vm_code: vm_error.code,
                    });
                    return { vm_error };
                }
                return {};
            };
            const result2 = await this.runVMTask(
                swap.id,
                TaskName.OpenWithdraw,
                task2,
                3,
                BridgeProcessStatus.ERROR_OPENING_WITHDRAW
            );

            if (!result2) return;
            if (result2.vm_error) return;

            await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.FINISHED_OPENING_WITHDRAW);
        } else {
            if (
                withdraw_box.amount.toString() === target_amount.value.toString() &&
                withdraw_box.trader_address === swap.trader_address &&
                withdraw_box.withdraw_address === swap.withdraw_address &&
                withdraw_box.secret_lock === swap.secret_lock
            ) {
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.FINISHED_OPENING_WITHDRAW);
            } else {
                logger.error("Failed to open withdraw lock box - There's a box with the same ID", {
                    id: swap.id,
                    status: swap.process_status,
                });
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.ERROR_OPENING_WITHDRAW);
            }
        }
    }

    /**
     * 타켓측의 박스가 오픈된 것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsOpened(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const task = async () => {
            try {
                return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check withdraw lock box opening", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.CheckWithdrawIsOpened, task);

        if (!result || !result.withdraw_box) return;
        const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box;

        const time_diff = withdraw_box.create_time - ContractUtils.getTimeStamp();
        if (withdraw_box.state === BridgeLockBoxStates.OPEN || withdraw_box.state === BridgeLockBoxStates.CLOSED) {
            await this.storage.updateBridgeWithdraw(
                withdraw_box.id,
                withdraw_box.state,
                withdraw_box.token_id,
                withdraw_box.time_lock,
                withdraw_box.create_time,
                BridgeProcessStatus.CONFIRMED_OPENING_WITHDRAW
            );
            await this.storage.updateBridgeWithdrawTimeDiff(withdraw_box.id, time_diff);
        } else if (withdraw_box.state === BridgeLockBoxStates.EXPIRED) {
            await this.storage.updateBridgeWithdraw(
                withdraw_box.id,
                withdraw_box.state,
                withdraw_box.token_id,
                withdraw_box.time_lock,
                withdraw_box.create_time,
                BridgeProcessStatus.ERROR_OPENING_WITHDRAW
            );
            await this.storage.updateBridgeWithdrawTimeDiff(withdraw_box.id, time_diff);
        }
    }

    /**
     * 소스측의 박스를 닫는다.
     * @param swap Swap Data
     */
    public async closeWithdraw(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        {
            const task = async () => {
                try {
                    return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
                } catch (error) {
                    const vm_error = ContractUtils.getVMError(error);
                    logger.error("Failed to check withdraw lock box opening", {
                        id: swap.id,
                        status: swap.process_status,
                        vm_message: vm_error.message,
                        vm_code: vm_error.code,
                    });
                    return { vm_error };
                }
            };

            const result = await this.runVMTask(swap.id, TaskName.CheckWithdrawIsOpened, task);

            if (!result || !result.withdraw_box) return;
            const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box;

            if (withdraw_box.state === BridgeLockBoxStates.CLOSED) {
                await this.storage.updateBridgeWithdraw(
                    withdraw_box.id,
                    withdraw_box.state,
                    withdraw_box.token_id,
                    withdraw_box.time_lock,
                    withdraw_box.create_time,
                    BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW
                );
                return;
            } else if (withdraw_box.state === BridgeLockBoxStates.OPEN) {
                // 만기시간을 계산하여 만기시킨다.
                const expire_timestamp = withdraw_box.time_lock + withdraw_box.create_time;
                const now_timestamp = ContractUtils.getTimeStamp();
                if (expire_timestamp - swap.withdraw_time_diff < now_timestamp) {
                    await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.STARTED_EXPIRE_WITHDRAW);
                    return;
                }
            }
        }

        if (swap.secret_key === undefined) return;
        if (swap.secret_key === "") return;

        const secret_key = swap.secret_key;

        const task2 = async () => {
            let tx;
            try {
                tx = await target_bridge.closeWithdraw(swap.id, secret_key);
            } catch (error) {
                await this.contract_manager.resetTargetTransactionCount(swap.direction);
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to close withdraw lock box", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
            return {
                tx_hash: tx.hash,
            };
        };

        const result2 = await this.runVMTask(
            swap.id,
            TaskName.CloseWithdraw,
            task2,
            3,
            BridgeProcessStatus.ERROR_CLOSING_WITHDRAW
        );

        if (!result2) return;
        if (result2.tx_hash) await this.storage.updateBridgeWithdrawTxHash(swap.id, result2.tx_hash);
        await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.FINISHED_CLOSING_WITHDRAW);
    }

    /**
     * 타켓측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsClosed(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const task = async () => {
            try {
                return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check withdraw lock box opening", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.CheckWithdrawIsClosed, task);

        if (!result || !result.withdraw_box) return;
        const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box;

        if (withdraw_box.state === BridgeLockBoxStates.CLOSED) {
            await this.storage.updateBridgeWithdraw(
                withdraw_box.id,
                withdraw_box.state,
                withdraw_box.token_id,
                withdraw_box.time_lock,
                withdraw_box.create_time,
                BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW
            );
        } else if (withdraw_box.state === BridgeLockBoxStates.OPEN) {
            // 만기시간을 계산하여 만기시킨다.
            const expire_timestamp = withdraw_box.time_lock + withdraw_box.create_time;
            const now_timestamp = ContractUtils.getTimeStamp();
            if (expire_timestamp - swap.withdraw_time_diff < now_timestamp) {
                await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.STARTED_EXPIRE_WITHDRAW);
            }
        } else if (withdraw_box.state === BridgeLockBoxStates.EXPIRED) {
            await this.storage.updateBridgeWithdraw(
                withdraw_box.id,
                withdraw_box.state,
                withdraw_box.token_id,
                withdraw_box.time_lock,
                withdraw_box.create_time,
                BridgeProcessStatus.ERROR_CLOSING_WITHDRAW
            );
        }
    }

    /**
     * 타켓측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async expireWithdraw(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        // 사용자가 혹시 박스를 닫았는지 확인해 봅니다.
        const task1 = async () => {
            try {
                return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check withdraw lock box for expire", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        let result = await this.runVMTask(swap.id, TaskName.CheckWithdrawExpire, task1);

        if (!result || !result.withdraw_box) return;
        const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box;

        if (withdraw_box.state === BridgeLockBoxStates.CLOSED) {
            await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW);
        } else if (withdraw_box.state === BridgeLockBoxStates.OPEN) {
            const task2 = async () => {
                try {
                    await target_bridge.expireWithdraw(swap.id);
                } catch (error) {
                    await this.contract_manager.resetTargetTransactionCount(swap.direction);
                    const vm_error = ContractUtils.getVMError(error);
                    logger.error("Failed to expire withdraw lock box", {
                        id: swap.id,
                        status: swap.process_status,
                        vm_message: vm_error.message,
                        vm_code: vm_error.code,
                    });
                    return { vm_error };
                }
                return {};
            };

            result = await this.runVMTask(
                swap.id,
                TaskName.ExpireWithdraw,
                task2,
                3,
                BridgeProcessStatus.ERROR_EXPIRE_WITHDRAW
            );

            if (!result) return;

            await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.FINISHED_EXPIRE_WITHDRAW);
        }
    }

    /**
     * 소스측의 박스를 닫는다.
     * @param swap Swap Data
     */
    public async closeDeposit(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.", {
                id: swap.id,
                status: swap.process_status,
            });
            return;
        }

        const task = async () => {
            try {
                return { secret_key: await target_bridge.checkSecretKeyWithdraw(swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Fail to get withdraw secret key", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.GetSecretKey, task);

        if (!result || !result.secret_key) return;
        const secret_key: string = result.secret_key;

        const source_bridge = this.contract_manager.getSourceBridgeWithSigner(swap.direction);
        if (source_bridge === null) {
            logger.error("The bridge contract of the network does not exist.");
            return;
        }

        const task2 = async () => {
            try {
                await source_bridge.closeDeposit(swap.id, secret_key);
            } catch (error) {
                await this.contract_manager.resetSourceTransactionCount(swap.direction);
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Fail to close deposit lock box", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
            return {};
        };

        const result2 = await this.runVMTask(
            swap.id,
            TaskName.CloseDeposit,
            task2,
            3,
            BridgeProcessStatus.ERROR_CLOSING_DEPOSIT
        );

        if (!result2) return;

        await this.storage.updateBridgeProcessStatus(swap.id, BridgeProcessStatus.FINISHED_CLOSING_DEPOSIT);
    }

    /**
     * 소스측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async checkDepositIsClosed(swap: IBridgeSwapInfoInternal) {
        const source_bridge = this.contract_manager.getSourceBridgeWithSigner(swap.direction);
        if (source_bridge === null) {
            logger.error("The bridge contract of the network does not exist.");
            return;
        }

        const task = async () => {
            try {
                return { deposit_box: await ContractUtils.getBridgeDepositLockBoxInfo(source_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Fail to check deposit lock box closing", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.CheckDepositIsClosed, task);

        if (!result || !result.deposit_box) return;
        const deposit_box: IBridgeLockBoxInfo = result.deposit_box;

        if (deposit_box.state === BridgeLockBoxStates.CLOSED) {
            await this.storage.updateBridgeProcessStatus(deposit_box.id, BridgeProcessStatus.CONFIRMED_CLOSING_DEPOSIT);
        }
    }

    /**
     * 타켓측의 박스가 무효화 된것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsExpired(swap: IBridgeSwapInfoInternal) {
        const target_bridge = this.contract_manager.getTargetBridgeWithSigner(swap.direction);
        if (target_bridge === null) {
            logger.error("The bridge contract of the network does not exist.");
            return;
        }

        const task = async () => {
            try {
                return { withdraw_box: await ContractUtils.getBridgeWithdrawLockBoxInfo(target_bridge, swap.id) };
            } catch (error) {
                const vm_error = ContractUtils.getVMError(error);
                logger.error("Failed to check withdraw lock box expiring", {
                    id: swap.id,
                    status: swap.process_status,
                    vm_message: vm_error.message,
                    vm_code: vm_error.code,
                });
                return { vm_error };
            }
        };

        const result = await this.runVMTask(swap.id, TaskName.CheckDepositIsOpened, task);

        if (!result || !result.withdraw_box) return;
        const withdraw_box: IBridgeLockBoxInfo = result.withdraw_box as IBridgeLockBoxInfo;

        if (withdraw_box.state === BridgeLockBoxStates.EXPIRED) {
            await this.storage.updateBridgeProcessStatus(
                withdraw_box.id,
                BridgeProcessStatus.CONFIRMED_EXPIRE_WITHDRAW
            );
        }
    }
}
