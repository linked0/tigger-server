/* Example in Node.js */
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config({ path: "env/.env" });

export interface ICoinPrice {
    symbol: string;
    krw: number;
    usd: number;
    last_updated_at: number;
}

async function getExchangeRateKRWUSD(): Promise<number> {
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
                return reject(new Error("환율 조회 중 오류가 발생했습니다. - " + ex.response.statusText));
            } else {
                return reject(new Error("환율 조회 중 오류가 발생했습니다."));
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
                    return reject(new Error("USD 정보가 존재하지 않습니다."));
                if (data.amount === undefined || data.amount !== 1)
                    return reject(new Error("USD 정보가 존재하지 않습니다."));
                if (data.quote === undefined) return reject(new Error("KRW 정보가 존재하지 않습니다."));
                if (data.quote.KRW === undefined) return reject(new Error("KRW 정보가 존재하지 않습니다."));
                if (data.quote.KRW.price === undefined) return reject(new Error("KRW 정보가 존재하지 않습니다."));
                let rate: number;
                try {
                    rate = Number(data.quote.KRW.price);
                } catch (ex) {
                    return reject(new Error("KRW 정보가 존재하지 않습니다."));
                }
                return resolve(rate);
            } else if (received.status.error_message !== undefined) {
                return reject(new Error(received.status.error_message));
            } else {
                return reject(new Error("알 수 없는 오류가 발생햇습니다."));
            }
        } else {
            return reject(new Error("알 수 없는 오류가 발생햇습니다."));
        }
    });
}

async function getCoinPrice(): Promise<ICoinPrice[]> {
    return new Promise<ICoinPrice[]>(async (resolve, reject) => {
        let rate: number;
        try {
            rate = await getExchangeRateKRWUSD();
        } catch (ex) {
            return reject(ex);
        }

        const coin_prices: ICoinPrice[] = [];
        let response;
        try {
            response = await axios.get(
                "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH,BOA",
                {
                    headers: {
                        "X-CMC_PRO_API_KEY": process.env.COIN_MARKET_CAP_API_KEY || "",
                    },
                }
            );
        } catch (ex: any) {
            if (ex.response !== undefined && ex.response.statusText !== undefined) {
                return reject(new Error("코인시세 조회 중 오류가 발생했습니다. - " + ex.response.statusText));
            } else {
                return reject(new Error("코인시세 조회 중 오류가 발생했습니다."));
            }
        }

        const received = response.data;
        if (received !== undefined && received.status !== undefined && received.status.error_code !== undefined) {
            if (received.status.error_code.toString() === "0" && received.data !== undefined) {
                let price: number;
                if (
                    received.data.BOA !== undefined &&
                    received.data.BOA.quote !== undefined &&
                    received.data.BOA.quote.USD !== undefined &&
                    received.data.BOA.quote.USD.price !== undefined &&
                    received.data.BOA.quote.USD.last_updated !== undefined
                ) {
                    try {
                        price = Number(received.data.BOA.quote.USD.price);
                    } catch (ex) {
                        return reject(new Error("코인시세에 오류가 있습니다."));
                    }
                    if (price <= 0) {
                        return reject(new Error("코인시세가 0 또는 음수 입니다."));
                    }

                    coin_prices.push({
                        symbol: "BOA",
                        usd: price,
                        krw: price * rate,
                        last_updated_at: Math.floor(
                            new Date(received.data.BOA.quote.USD.last_updated).getTime() / 1000
                        ),
                    });
                }
                if (
                    received.data.ETH !== undefined &&
                    received.data.ETH.quote !== undefined &&
                    received.data.ETH.quote.USD !== undefined &&
                    received.data.ETH.quote.USD.price !== undefined &&
                    received.data.ETH.quote.USD.last_updated !== undefined
                ) {
                    try {
                        price = Number(received.data.ETH.quote.USD.price);
                    } catch (ex) {
                        return reject(new Error("코인시세에 오류가 있습니다."));
                    }
                    if (price <= 0) {
                        return reject(new Error("코인시세가 0 또는 음수 입니다."));
                    }
                    coin_prices.push({
                        symbol: "ETH",
                        usd: price,
                        krw: price * rate,
                        last_updated_at: Math.floor(
                            new Date(received.data.ETH.quote.USD.last_updated).getTime() / 1000
                        ),
                    });
                }
                return resolve(coin_prices);
            } else if (received.status.error_message !== undefined) {
                return reject(new Error(received.status.error_message));
            } else {
                return reject(new Error("알 수 없는 오류가 발생햇습니다."));
            }
        } else {
            return reject(new Error("알 수 없는 오류가 발생햇습니다."));
        }
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
getCoinPrice()
    .then((coin_prices: ICoinPrice[]) => {
        console.log(coin_prices);
    })
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
