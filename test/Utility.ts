import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { handleNetworkError } from "../src/modules/network/ErrorTypes";
import { SwapServer } from "../src/service/SwapServer";

const bridge_sample_data = [
    {
        id: "0x0414c7b7cdce219bb939795124bb25bf39286b1fb8677af06ae5aa80579a63c9",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0x7a4178a4a4e5e1501545f1fb27d89d0850915e3c61c1e91ef99f355c0e767775",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275122,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275124,
        withdraw_time_diff: 9,
        process_status: 42,
    },
    {
        id: "0x0414c7be66848fe36d27c3993c2dac3b09a91e8114110edf7faf7cf80265f42d",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0xfe96e1748141b8f0efd46f2ec1b93faeace8d82477899b2e786f25d7dc3fdad0",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275129,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275131,
        withdraw_time_diff: 9,
        process_status: 42,
    },
    {
        id: "0x0414c7c55c1e65f8e8ce17b8fd58724815f2ed086cc7bf7ce3a33146de3359f4",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xf347d05684a35e833c8859564bd8b536500b58697d7c71f0c39a0b281abdab9f",
        deposit_state: 1,
        deposit_time_lock: 10,
        deposit_create_time: 1646275139,
        withdraw_state: 1,
        withdraw_time_lock: 5,
        withdraw_create_time: 1646275141,
        withdraw_time_diff: 11,
        process_status: 22,
    },
    {
        id: "0x0414c7d6abe0409692ed21c5fbe3b94bb8d60087eb9bb796cc36b5a043f91167",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0x91de5c954c1133fe81ceef0c23f9d303da0e58ad500ae9d909775ee1dc51d351",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275153,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275155,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c7dd0d71aa67a9ef4a90aa14dfb24f171774da0279865c0687be8f187ba0",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0xaedec87a36628c7c9e67429840d8040a7f0ccc5435cab43b6bbbe9ae78b1109f",
        deposit_state: 0,
        deposit_time_lock: 0,
        deposit_create_time: 0,
        withdraw_state: 0,
        withdraw_time_lock: 0,
        withdraw_create_time: 0,
        withdraw_time_diff: 0,
        process_status: 0,
    },
    {
        id: "0x0414c7e8efd85a251a1c6357f6a6a3499cd3628d376ca9a63932e2dc033f1604",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xd729df4a46ecdeba1191660cda72ff2bee26c9517c177774fcd22babd2034c35",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275173,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275174,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c7f0d4a2aef35391ada5ffd077624ae2d648fb4c819b9574ebff200d2382",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0xe4841e35f364ebcd88535207c6349ea44032cc2955a387f7721abb0338e6754a",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275180,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275183,
        withdraw_time_diff: 11,
        process_status: 32,
    },
    {
        id: "0x0414c8052adbcb35b95f07d6252c7f0449f49e4edcf3b0dcddd28bf56db5bbdb",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xddc2d300fae50d51ef75cf704390b9ee7f562550836cd19958444f4501d5352f",
        deposit_state: 0,
        deposit_time_lock: 0,
        deposit_create_time: 0,
        withdraw_state: 0,
        withdraw_time_lock: 0,
        withdraw_create_time: 0,
        withdraw_time_diff: 0,
        process_status: 0,
    },
    {
        id: "0x0414c824aaa866fb631acfcabb46a5135a2228ee79cea9503c7cecd1acbba576",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0x5c260f3839b8761394f792f0f17c7e27c0215419c3c99d38d04e0c26df90bede",
        deposit_state: 0,
        deposit_time_lock: 0,
        deposit_create_time: 0,
        withdraw_state: 0,
        withdraw_time_lock: 0,
        withdraw_create_time: 0,
        withdraw_time_diff: 0,
        process_status: 0,
    },
    {
        id: "0x0414c848d92d6f376605c5f441db88c60f14748ff546a23e1073c0e406b358be",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xa488c8b33456896f66bc63a3696acecc5db4bb8e805a34c64d2af745073e8a65",
        deposit_state: 0,
        deposit_time_lock: 0,
        deposit_create_time: 0,
        withdraw_state: 0,
        withdraw_time_lock: 0,
        withdraw_create_time: 0,
        withdraw_time_diff: 0,
        process_status: 0,
    },
    {
        id: "0x0414c8d3f400ffe6d1c83dc9d81eaee501ccd59348f403f435c4008c7cf69ae3",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0x1701dbdab21994f6ef1ff3cd1eadd43d14da5294dd986057e34cedbc29086822",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275407,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275409,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c8da59ecb79bc0f557517bef98b40746db930c87c481a466451263e541bf",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0xa8ecc80ba02cdd66be39d7df283b6770e4c105e8edc438e83249604a6408f0cc",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275415,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275417,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c8e2ea77b047a88aabdc4474a6e4111a90d21cbc01d054b228caa5be8cf6",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xeeaf93a9b0072320a70eeff425ec5b69ff9c8b28c84241309bb38afbef0733ff",
        deposit_state: 1,
        deposit_time_lock: 10,
        deposit_create_time: 1646275425,
        withdraw_state: 1,
        withdraw_time_lock: 5,
        withdraw_create_time: 1646275427,
        withdraw_time_diff: 12,
        process_status: 52,
        updated_at: "2022-03-03 11:43:43",
        created_at: "2022-03-03 11:43:32",
    },
    {
        id: "0x0414c900c99db1fb7e90f2c5147cf3c56455998da7845b8a3cb186f80054711e",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xbe01e6599c8e2e78f50953ac7556c9ffdef1bb4e184cafad3af4866b34858801",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275452,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275454,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c907ee5fb216bddbc94c4e890ddbbb4056e3ded51b29e4c56a100ffc3f63",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0xc14c349241f46f3d519368f5a8b00141219a61d5b9107fba654429716ab008e5",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275460,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275462,
        withdraw_time_diff: 10,
        process_status: 42,
    },
    {
        id: "0x0414c910e8d80a72b3c1f3a000c3c8bcc9db8fbcdcecdbded244fb9e83ffb4fc",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0x6ccd8a8e35f6c6851a59087a38bc4f4dca5c1b93363994c84c3517f63a048a46",
        deposit_state: 1,
        deposit_time_lock: 10,
        deposit_create_time: 1646275469,
        withdraw_state: 1,
        withdraw_time_lock: 5,
        withdraw_create_time: 1646275471,
        withdraw_time_diff: 11,
        process_status: 52,
    },
    {
        id: "0x0414c92cc986c4acdfa5d402744a860c341439769a223015c629dc909eb7d858",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xdc56febfc26fe90da075c2a5bf5fed14579c77708c6255dbb046c9f179dab11b",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275497,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275499,
        withdraw_time_diff: 11,
        process_status: 42,
    },
    {
        id: "0x0414c9349290428231f3bd087f8db338641de0c2fcb8ef65c5b3c76189197780",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "10000000000000000000000",
        direction: 1,
        secret_lock: "0x5192b6216ff064c8c9294e87f240849a9ff42f967ed6f1a1daf35213a6a955de",
        deposit_state: 1,
        deposit_time_lock: 172800,
        deposit_create_time: 1646275504,
        withdraw_state: 2,
        withdraw_time_lock: 86400,
        withdraw_create_time: 1646275507,
        withdraw_time_diff: 11,
        process_status: 42,
    },
    {
        id: "0x0414c93c82662107e5cb8030fc8bb8f7efba258d3e91b57086f3bc48ab1e2ef7",
        trader_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        withdraw_address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        amount: "100000000000",
        direction: 0,
        secret_lock: "0xf69986938c4d873ee650b9d373401568159e296ec96a6c9aad491006929f5df1",
        deposit_state: 1,
        deposit_time_lock: 10,
        deposit_create_time: 1646275514,
        withdraw_state: 1,
        withdraw_time_lock: 5,
        withdraw_create_time: 1646275517,
        withdraw_time_diff: 13,
        process_status: 52,
    },
];

export class TestSwapServer extends SwapServer {
    public async pushBridgeSampleData() {
        for (const m of bridge_sample_data) {
            await this.swap_storage.postBridgeSwapForSampleData(
                m.id,
                m.trader_address,
                m.withdraw_address,
                m.amount,
                m.direction,
                m.secret_lock,
                m.deposit_state,
                m.deposit_time_lock,
                m.deposit_create_time,
                m.withdraw_state,
                m.withdraw_time_lock,
                m.withdraw_create_time,
                m.process_status
            );
        }
    }
}

/**
 * This is a client for testing.
 * Test codes can easily access error messages received from the server.
 */
export class TestClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create();
    }

    public get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return new Promise<AxiosResponse>((resolve, reject) => {
            this.client
                .get(url, config)
                .then((response: AxiosResponse) => {
                    resolve(response);
                })
                .catch((reason: any) => {
                    reject(handleNetworkError(reason));
                });
        });
    }

    public delete(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return new Promise<AxiosResponse>((resolve, reject) => {
            this.client
                .delete(url, config)
                .then((response: AxiosResponse) => {
                    resolve(response);
                })
                .catch((reason: any) => {
                    reject(handleNetworkError(reason));
                });
        });
    }

    public post(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return new Promise<AxiosResponse>((resolve, reject) => {
            this.client
                .post(url, data, config)
                .then((response: AxiosResponse) => {
                    resolve(response);
                })
                .catch((reason: any) => {
                    reject(handleNetworkError(reason));
                });
        });
    }

    public put(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return new Promise<AxiosResponse>((resolve, reject) => {
            this.client
                .put(url, data, config)
                .then((response: AxiosResponse) => {
                    resolve(response);
                })
                .catch((reason: any) => {
                    reject(handleNetworkError(reason));
                });
        });
    }
}

export function delay(interval: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        setTimeout(resolve, interval);
    });
}
