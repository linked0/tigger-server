import { Scheduler } from "../../modules/scheduler/Scheduler";
import { Config } from "../common/Config";
import { logger } from "../common/Logger";
import { ContractUtils } from "../contract/ContractUtils";
import { SwapStorage } from "../storage/SwapStorage";
import { ICoinPrice } from "../types";

import axios from "axios";

/**
 * Coin Market Cap 에서 제공하는 API 서버에서 코인의 시세를 조회하여 데이타베이스에 기록한다.
 */
export class CMCCoinPriceScheduler extends Scheduler {
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
     * Exchange Rate (KRW / USD)
     * @private
     */
    private _rateKRWUSD: number = 0;

    /**
     * Number of requests
     * @private
     */
    private _loop: number = 0;

    /**
     * 랜덤값
     * @private
     */
    private readonly _random_offset: number;

    constructor(interval: number = 15) {
        super(interval);
        this._random_offset = Math.floor(Math.random() * 86400);
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
        if (this.config.cmc_coin_price.items.length === 0) return;
        this._new_time_stamp = ContractUtils.getTimeStamp() + this._random_offset;
        if (this._old_time_stamp === 0) this._old_time_stamp = this._new_time_stamp;

        try {
            const old_period = Math.floor(this._old_time_stamp / this.interval);
            const new_period = Math.floor(this._new_time_stamp / this.interval);
            if (old_period !== new_period) {
                if (this._rateKRWUSD === 0 || this._loop % 5 === 0)
                    this._rateKRWUSD = await this.getExchangeRateKRWUSD();

                const prices: ICoinPrice[] = await this.getCoinPrice();
                await this.storage.updateCoinPrice(prices);
                if (++this._loop >= 1000) this._loop = 0;
            }
        } catch (error) {
            logger.error("An exception occurred during execution - " + error);
        }

        this._old_time_stamp = this._new_time_stamp;
    }

    private async getExchangeRateKRWUSD(): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let response;
            try {
                response = await axios.get(
                    "https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&convert=KRW&symbol=USD",
                    {
                        headers: {
                            "X-CMC_PRO_API_KEY": process.env.COIN_MARKET_CAP_API_KEY || "",
                        },
                    }
                );
            } catch (ex: any) {
                if (ex.response !== undefined && ex.response.statusText !== undefined) {
                    return reject(
                        new Error("CMC Currency Info: 환율 조회 중 오류가 발생했습니다. - " + ex.response.statusText)
                    );
                } else {
                    return reject(new Error("CMC Currency Info: 환율 조회 중 오류가 발생했습니다."));
                }
            }

            const received = response.data;
            if (received !== undefined && received.status !== undefined && received.status.error_code !== undefined) {
                if (
                    received.status.error_code.toString() === "0" &&
                    received.data !== undefined &&
                    received.data.length > 0
                ) {
                    const data = received.data[0];
                    if (data.symbol === undefined || data.symbol !== "USD")
                        return reject(new Error("CMC Currency Info: USD 정보가 존재하지 않습니다."));
                    if (data.amount === undefined || data.amount !== 1)
                        return reject(new Error("CMC Currency Info: USD 정보가 존재하지 않습니다."));
                    if (data.quote === undefined)
                        return reject(new Error("CMC Currency Info: KRW 정보가 존재하지 않습니다."));
                    if (data.quote.KRW === undefined)
                        return reject(new Error("CMC Currency Info: KRW 정보가 존재하지 않습니다."));
                    if (data.quote.KRW.price === undefined)
                        return reject(new Error("CMC Currency Info: RW 정보가 존재하지 않습니다."));
                    let rate: number;
                    try {
                        rate = Number(data.quote.KRW.price);
                    } catch (ex) {
                        return reject(new Error("CMC Currency Info: KRW 정보가 존재하지 않습니다."));
                    }
                    return resolve(rate);
                } else if (received.status.error_message !== undefined) {
                    return reject(new Error(received.status.error_message));
                } else {
                    return reject(new Error("CMC Currency Info: 알 수 없는 오류가 발생햇습니다."));
                }
            } else {
                return reject(new Error("CMC Currency Info: 알 수 없는 오류가 발생햇습니다."));
            }
        });
    }

    private async getCoinPrice(): Promise<ICoinPrice[]> {
        return new Promise<ICoinPrice[]>(async (resolve, reject) => {
            let response;
            try {
                const symbols = this.config.cmc_coin_price.items.map((m) => m.symbol).join(",");
                response = await axios.get(
                    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols}`,
                    {
                        headers: {
                            "X-CMC_PRO_API_KEY": process.env.COIN_MARKET_CAP_API_KEY || "",
                        },
                    }
                );
            } catch (ex: any) {
                if (ex.response !== undefined && ex.response.statusText !== undefined) {
                    return reject(
                        new Error("CMC Coin Price: 코인시세 조회 중 오류가 발생했습니다. - " + ex.response.statusText)
                    );
                } else {
                    return reject(new Error("CMC Coin Price: 코인시세 조회 중 오류가 발생했습니다."));
                }
            }

            const received = response.data;
            if (received !== undefined && received.status !== undefined && received.status.error_code !== undefined) {
                if (received.status.error_code.toString() === "0" && received.data !== undefined) {
                    let price: number;
                    const coin_prices: ICoinPrice[] = [];
                    for (const m of this.config.cmc_coin_price.items) {
                        if (received.data[m.symbol] !== undefined && received.data[m.symbol].quote !== undefined) {
                            const quote = received.data[m.symbol].quote;
                            if (
                                quote.USD !== undefined &&
                                quote.USD.price !== undefined &&
                                quote.USD.last_updated !== undefined
                            ) {
                                try {
                                    price = Number(quote.USD.price);
                                } catch (ex) {
                                    return reject(new Error("CMC Coin Price: 코인시세에 오류가 있습니다."));
                                }
                                if (price <= 0) {
                                    return reject(new Error("CMC Coin Price: 코인시세가 0 또는 음수 입니다."));
                                }

                                coin_prices.push({
                                    source: "CMC",
                                    symbol: m.symbol,
                                    usd: price,
                                    krw: price * this._rateKRWUSD,
                                    last_updated_at: Math.floor(new Date(quote.USD.last_updated).getTime() / 1000),
                                });
                            }
                        }
                    }
                    return resolve(coin_prices);
                } else if (received.status.error_message !== undefined) {
                    return reject(new Error(received.status.error_message));
                } else {
                    return reject(new Error("CMC Coin Price: 알 수 없는 오류가 발생햇습니다."));
                }
            } else {
                return reject(new Error("CMC Coin Price: 알 수 없는 오류가 발생햇습니다."));
            }
        });
    }
}
