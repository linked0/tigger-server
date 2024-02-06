/**
 *  The scheduler of BOA Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { Scheduler } from "../../modules/scheduler/Scheduler";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractUtils } from "../contract/ContractUtils";
import { SwapStorage } from "../storage/SwapStorage";
import { BridgeDirection, BridgeProcessStatus, BridgeType } from "../types";

import { BOABridgeTasks } from "./bridge/BOABridgeTasks";
import { BridgeTasks } from "./bridge/BridgeTasks";
import { TokenBridgeTasks } from "./bridge/TokenBridgeTasks";

/**
 * EthNet 의 BOA 와 BizNet 의 BOA 를 서로 교환하는 작업을 진행하는 스케줄러 클래스
 */
export class BridgeScheduler extends Scheduler {
    /**
     * 데이타베이스에 접근하기 위한 인스턴스
     */
    public _storage: SwapStorage | undefined;

    /**
     * 설정
     */
    public _config: Config | undefined;

    /**
     * 랜덤값
     * @private
     */
    private readonly _random_offset: number;

    /**
     * 브릿지 유형에 따른 명령어
     * @private
     */
    private tasks: BridgeTasks[];

    /**
     * 생성자
     * @param interval
     */
    constructor(interval: number = 15) {
        super(interval);
        this._random_offset = Math.floor(Math.random() * 86400);
        this.tasks = [new BOABridgeTasks(), new TokenBridgeTasks()];
    }

    /**
     * 데이타베이스에 접근하기 위한 인스턴스
     * @private
     */
    private get storage(): SwapStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * 설정
     */
    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * 실행에 필요한 여러 객체를 설정한다
     * @param options 옵션
     */
    public setOption(options: any) {
        if (options) {
            this.tasks.forEach((m) => m.setOption(options));
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof SwapStorage) this._storage = options.storage;
        }
    }

    /**
     * 실제 작업
     * @protected
     */
    protected override async work() {
        const now = ContractUtils.getTimeStamp();
        const new_time_stamp = now + this._random_offset;
        let old_time_stamp: number;
        try {
            const res = await this.storage.getBridgeWaitingSwap();
            for (const m of res) {
                if (m.type >= this.tasks.length) {
                    await this.storage.updateBridgeProcessStatus(m.id, BridgeProcessStatus.ERROR_INVALID_SWAP);
                    continue;
                }
                old_time_stamp = m.process_update_time + this._random_offset;

                const source_interval =
                    m.type === BridgeType.BOA
                        ? m.direction === BridgeDirection.ETHNET_BIZNET
                            ? this.config.bridge.ethnet_interval
                            : this.config.bridge.biznet_interval
                        : m.direction === BridgeDirection.ETHNET_BIZNET
                        ? this.config.token_bridge.ethnet_interval
                        : this.config.token_bridge.biznet_interval;

                const target_interval =
                    m.type === BridgeType.BOA
                        ? m.direction === BridgeDirection.ETHNET_BIZNET
                            ? this.config.bridge.biznet_interval
                            : this.config.bridge.ethnet_interval
                        : m.direction === BridgeDirection.ETHNET_BIZNET
                        ? this.config.token_bridge.biznet_interval
                        : this.config.token_bridge.ethnet_interval;

                const old_source_period = Math.floor(old_time_stamp / source_interval);
                const new_source_period = Math.floor(new_time_stamp / source_interval);
                const old_target_period = Math.floor(old_time_stamp / target_interval);
                const new_target_period = Math.floor(new_time_stamp / target_interval);

                switch (m.process_status) {
                    case BridgeProcessStatus.NONE:
                        // 사용자가 소스의 박스를 오픈했을 때 => 정상적으로 오픈되었는지 확인한다.
                        if (old_source_period !== new_source_period) {
                            await this.tasks[m.type].checkDepositIsOpened(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.CONFIRMED_OPENING_DEPOSIT:
                        // 소스의 박스가 정상적으로 오픈 되었을 때 => 타켓의 박스를 오픈한다.
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].openWithdraw(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.FINISHED_OPENING_WITHDRAW:
                        // 타켓의 박스가 오픈되었을 때 => 타켓의 박스가 정상적으로 오픈되었는지 확인한다.
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].checkWithdrawIsOpened(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.CONFIRMED_OPENING_WITHDRAW:
                        // 타켓의 박스가 정상적으로 오픈되었을 때 => 사용자가 키를 전달해 줄 때 까지 기다린 후 키를 받아 타켓를 닫는다
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].closeWithdraw(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.FINISHED_CLOSING_WITHDRAW:
                        // 타켓의 박스가 정상적으로 오픈되었을 때 => 타켓의 박스가 닫힐 때 까지 기다린다.
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].checkWithdrawIsClosed(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW:
                        // 타켓의 박스가 정상적으로 닫혔을 때 => 소스의 박스를 닫는다.
                        if (old_source_period !== new_source_period) {
                            await this.tasks[m.type].closeDeposit(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.FINISHED_CLOSING_DEPOSIT:
                        // 소스의 박스를 닫았다면 => 그것이 정상적으로 닫혔는지 확인한다.
                        if (old_source_period !== new_source_period) {
                            await this.tasks[m.type].checkDepositIsClosed(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.STARTED_EXPIRE_WITHDRAW:
                        // 타켓의 박스의 만료프로세스가 진행되었다면 => 타켓 박스를 만료시킨다.
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].expireWithdraw(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                    case BridgeProcessStatus.FINISHED_EXPIRE_WITHDRAW:
                        // 타켓 박스의 만료를 시켰다면 => 그것이 정상적으로 만료되었는지를 확인한다.
                        if (old_target_period !== new_target_period) {
                            await this.tasks[m.type].checkWithdrawIsExpired(m);
                            await this.storage.updateBridgeProcessTime(m.id, now);
                        }
                        break;
                }
            }
        } catch (error) {
            logger.error(`Failed to execute the bridge scheduler: ${error}`);
        }
    }
}
