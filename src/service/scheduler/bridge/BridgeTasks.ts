/**
 *  The Tasks of Bridge
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { Config } from "../../common/Config";
import { logger } from "../../common/Logger";
import { ContractUtils } from "../../contract/ContractUtils";
import { SwapStorage } from "../../storage/SwapStorage";
import { BridgeProcessStatus, IBridgeLockBoxInfo, IBridgeSwapInfoInternal, IVMError } from "../../types";

export interface ITaskResult {
    vm_error?: IVMError;
    secret_key?: string;
    deposit_box?: IBridgeLockBoxInfo;
    withdraw_box?: IBridgeLockBoxInfo;
    tx_hash?: string;
}

export enum TaskName {
    CheckDepositIsOpened = "CheckDepositIsOpened",
    CheckWithdrawIsNone = "CheckWithdrawIsNone",
    OpenWithdraw = "OpenWithdraw",
    CheckWithdrawIsOpened = "CheckWithdrawIsOpened",
    CloseWithdraw = "CloseWithdraw",
    CheckWithdrawIsClosed = "CheckWithdrawIsClosed",
    CheckWithdrawExpire = "CheckWithdrawExpire",
    ExpireWithdraw = "ExpireWithdraw",
    GetSecretKey = "GetSecretKey",
    CloseDeposit = "CloseDeposit",
    CheckDepositIsClosed = "CheckDepositIsClosed",
}

/**
 *
 */
export class BridgeTasks {
    /**
     * 데이타베이스에 접근하기 위한 인스턴스
     */
    protected _storage: SwapStorage | undefined;

    /**
     * 데이타베이스에 접근하기 위한 인스턴스
     * @private
     */
    protected get storage(): SwapStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    /**
     * 설정
     */
    protected _config: Config | undefined;

    /**
     * 설정
     */
    protected get config(): Config {
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
        //
    }

    /**
     * 소스측의 박스가 오픈된 것을 확인한다.
     * @param swap Swap Data
     */
    public async checkDepositIsOpened(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 타켓측의 박스를 오픈한다.
     * @param swap Swap Data
     */
    public async openWithdraw(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 타켓측의 박스가 오픈된 것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsOpened(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 소스측의 박스를 닫는다.
     * @param swap Swap Data
     */
    public async closeWithdraw(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 타켓측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsClosed(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 타켓측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async expireWithdraw(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 소스측의 박스를 닫는다.
     * @param swap Swap Data
     */
    public async closeDeposit(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 소스측의 박스가 닫힌것을 확인한다.
     * @param swap Swap Data
     */
    public async checkDepositIsClosed(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 타켓측의 박스가 무효화 된것을 확인한다.
     * @param swap Swap Data
     */
    public async checkWithdrawIsExpired(swap: IBridgeSwapInfoInternal) {
        //
    }

    /**
     * 하나의 작은 테스크를 실행해 주는 함수이다. 테스크가 실패했을 때 그 실패횟수와 결과를 데이타베이스에 기록한다.
     * 그리하여 테스크 실패시 지정한 횟수 만큼 성공할 때 까지 실행할 수 있도록 한다.
     * @param id Swap ID
     * @param task_name 테스크의 이름
     * @param task 테스크 함수
     * @param max_num_retry 최대 반복횟수
     * @param error_status 최종 오류코드
     * @protected
     */
    protected async runVMTask(
        id: string,
        task_name: string,
        task: () => Promise<ITaskResult>,
        max_num_retry: number = 0,
        error_status: BridgeProcessStatus = 0
    ): Promise<ITaskResult | null> {
        // 이전의 VM 오류를 가지고 온다. 연속적으로 오류가 발생하는 것을 방지한다.
        const vm = await this.storage.getBridgeVMError(id, task_name);
        // 재시도가 허용되지 않았다면 그냥 리턴한다.
        if (vm.is_error && !vm.is_retry) {
            await this.storage.updateBridgeProcessStatus(id, error_status);
            return null;
        }
        // 재시도가 허용되었지만 아직 재시도 시간이 안되었다면 그냥리턴한다. 오류발생 후 1분뒤에 재시도 할 수 있다.
        if (vm.is_error && vm.is_retry && ContractUtils.getTimeStamp() < vm.next_try_time) {
            return null;
        }
        // 재시도가 허용되었지만 이미 설정한 횟수 만큼 실패했다면 최종적으로 오류를 확정하고 리턴한다.
        if (vm.is_error && vm.is_retry && vm.num_retry >= max_num_retry && max_num_retry > 0) {
            await this.storage.updateBridgeProcessStatus(id, error_status);
            return null;
        }

        const res = await task();

        if (res.vm_error) {
            // VM 오류가 발생하여 저장한다.
            await this.storage.updateBridgeVMError(
                id,
                task_name,
                res.vm_error.message,
                res.vm_error.code,
                true,
                vm.num_retry + 1
            );
            return res;
        } else {
            // VM 오류가 해결되어 초기화 한다
            if (vm.is_error) await this.storage.clearBridgeVMError(id, task_name);
            return res;
        }
    }
}
