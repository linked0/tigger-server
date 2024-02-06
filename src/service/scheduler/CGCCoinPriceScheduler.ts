import { Scheduler } from "../../modules/scheduler/Scheduler";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractUtils } from "../contract/ContractUtils";
import { SwapStorage } from "../storage/SwapStorage";
import { ICoinPrice } from "../types";

import { CoinGeckoClient } from "coingecko-api-v3";

/**
 * CoinGecko 에서 제공하는 API 서버에서 코인의 시세를 조회하여 데이타베이스에 기록한다.
 */
export class CGCCoinPriceScheduler extends Scheduler {
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

    private _coin_gecko_client: CoinGeckoClient;

    constructor(interval: number = 15) {
        super(interval);
        this._random_offset = Math.floor(Math.random() * 86400);
        this._coin_gecko_client = new CoinGeckoClient({
            timeout: 10000,
            autoRetry: true,
        });
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
        if (this.config.cgc_coin_price.items.length === 0) return;
        this._new_time_stamp = ContractUtils.getTimeStamp() + this._random_offset;
        if (this._old_time_stamp === 0) this._old_time_stamp = this._new_time_stamp;

        try {
            const old_period = Math.floor(this._old_time_stamp / this.interval);
            const new_period = Math.floor(this._new_time_stamp / this.interval);
            if (old_period !== new_period) {
                const success = await this.ping();
                if (!success) {
                    logger.warn("Wait until api.coingecko.com is available or check the internet.");
                } else {
                    const prices: ICoinPrice[] = await this.getCoinPrice();
                    await this.storage.updateCoinPrice(prices);
                }
            }
        } catch (error) {
            logger.error("An exception occurred during execution - " + error);
        }

        this._old_time_stamp = this._new_time_stamp;
    }

    private async getCoinPrice(): Promise<ICoinPrice[]> {
        return new Promise<ICoinPrice[]>(async (resolve, reject) => {
            let response;
            try {
                response = await this._coin_gecko_client.simplePrice({
                    ids: this.config.cgc_coin_price.items.map((m) => m.id).join(","),
                    vs_currencies: "usd,krw",
                    include_market_cap: false,
                    include_24hr_vol: false,
                    include_24hr_change: false,
                    include_last_updated_at: true,
                });
            } catch (e) {
                return reject(
                    new Error("CGC Coin Price: An error occurred while inquiring about the coin price - " + e)
                );
            }

            if (response?.error) {
                return reject(
                    new Error(
                        "CGC Coin Price: An error occurred while inquiring about the coin price - " + response.error
                    )
                );
            } else {
                const coin_prices: ICoinPrice[] = [];
                let krw: number;
                let usd: number;
                for (const m of this.config.cgc_coin_price.items) {
                    if (response[m.id]) {
                        const quote = response[m.id];
                        if (quote.krw !== undefined && quote.usd !== undefined && quote.last_updated_at !== undefined) {
                            try {
                                krw = Number(quote.krw);
                                usd = Number(quote.usd);
                            } catch (ex) {
                                return reject(new Error("CGC Coin Price: 코인시세에 오류가 있습니다."));
                            }
                            if (krw <= 0) {
                                return reject(new Error("CMC Coin Price: 코인시세가 0 또는 음수 입니다."));
                            }
                            if (usd <= 0) {
                                return reject(new Error("CMC Coin Price: 코인시세가 0 또는 음수 입니다."));
                            }
                            coin_prices.push({
                                source: "CGC",
                                symbol: m.symbol,
                                krw,
                                usd,
                                last_updated_at: Number(quote.last_updated_at),
                            });
                        }
                    }
                }
                resolve(coin_prices);
            }
        });
    }

    /**
     * CoinGecko 의 API 서버가 정상인지 검사한다. 정상이면 true 를 리턴하고, 아니면 false 를 리턴한다
     */
    private ping(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            await this._coin_gecko_client
                .ping()
                .then((data: any) => {
                    if (data.gecko_says) {
                        resolve(true);
                    }
                })
                .catch((err: any) => {
                    logger.error("The ping for CoinGecko failed.");
                    resolve(false);
                });
        });
    }
}
