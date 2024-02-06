import { Scheduler } from "../../modules/scheduler/Scheduler";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractUtils } from "../contract/ContractUtils";
import { SwapStorage } from "../storage/SwapStorage";

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * Eth Gas Station 에서 제공하는 GAS Price 를 조회하여 데이타베이스에 기록한다.
 */
export class GasPriceScheduler extends Scheduler {
    /**
     * 데이타베이스에 접근하기 위한 인스턴스
     */
    public _storage: SwapStorage | undefined;

    /**
     * 설정
     */
    public _config: Config | undefined;

    /**
     * 이전의 진입했을 때의 타임스탬프
     * @private
     */
    private _old_time_stamp: number = 0;

    /**
     * 새로 진입했을 때의 타임스탬프
     * @private
     */
    private _new_time_stamp: number = 0;

    /**
     * 랜덤값
     * @private
     */
    private readonly _random_offset: number;

    private client: AxiosInstance;

    constructor(interval: number = 15) {
        super(interval);
        this._random_offset = Math.floor(Math.random() * 86400);
        this.client = axios.create();
    }

    private get storage(): SwapStorage {
        if (this._storage !== undefined) return this._storage;
        else {
            logger.error("Storage is not ready yet.");
            process.exit(1);
        }
    }

    private get config(): Config {
        if (this._config !== undefined) return this._config;
        else {
            logger.error("Config is not ready yet.");
            process.exit(1);
        }
    }

    public setOption(options: any) {
        if (options) {
            if (options.config && options.config instanceof Config) this._config = options.config;
            if (options.storage && options.storage instanceof SwapStorage) this._storage = options.storage;
        }
    }

    /**
     * 작업을 반복적으로 수행한다.
     * @protected
     */
    protected override async work() {
        this._new_time_stamp = ContractUtils.getTimeStamp() + this._random_offset;
        if (this._old_time_stamp === 0) this._old_time_stamp = this._new_time_stamp;

        try {
            const old_period = Math.floor(this._old_time_stamp / this.interval);
            const new_period = Math.floor(this._new_time_stamp / this.interval);
            if (old_period !== new_period) {
                const response = await this.client.get("https://ethgasstation.info/json/ethgasAPI.json");
                try {
                    if (response.data.fast && response.data.safeLow && response.data.average) {
                        const price = {
                            symbol: "GAS",
                            fast: response.data.fast,
                            low: response.data.safeLow,
                            average: response.data.average,
                            last_updated_at: ContractUtils.getTimeStamp(),
                        };
                        await this.storage.updateGasPrice(price);
                    }
                } catch (reason) {
                    logger.error(`Failed to save the gas price: ${reason}`);
                }
            }
        } catch (error) {
            logger.error("An exception occurred during execution - " + error);
        }

        this._old_time_stamp = this._new_time_stamp;
    }
}
