import { Amount, BOACoin, BOAToken } from "../../src/service/common/Amount";
import { Config } from "../../src/service/common/Config";
import { BOABridgeContractManager } from "../../src/service/contract/BOABridgeContractManager";
import { CGCCoinPriceScheduler } from "../../src/service/scheduler/CGCCoinPriceScheduler";
import { GasPriceScheduler } from "../../src/service/scheduler/GasPriceScheduler";
import { SwapStorage } from "../../src/service/storage/SwapStorage";
import { BridgeType } from "../../src/service/types";
import { HardhatUtils } from "../../src/service/utils";
import { delay, TestClient, TestSwapServer } from "../Utility";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";
import { waffle } from "hardhat";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Bridge Server", function () {
    this.timeout(1000 * 60 * 5);
    const provider = waffle.provider;
    const user = new Wallet(process.env.USER_KEY || "");

    const client = new TestClient();
    let swap_storage: SwapStorage;
    let swap_server: TestSwapServer;
    let serverURL: URL;
    const config = new Config();
    let contract_manager: BOABridgeContractManager;

    before("Create TestSwapServer", async () => {
        config.readFromFile(path.resolve(process.cwd(), "config/config_test.yaml"));
        await HardhatUtils.deployBOABridgeForTest(config);
        await HardhatUtils.deployTokenBridgeForTest(config);
        serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
        swap_storage = await SwapStorage.make(config.database);
        swap_server = new TestSwapServer(config, swap_storage, [
            new CGCCoinPriceScheduler(1),
            new GasPriceScheduler(1),
        ]);
    });

    before("Start TestSwapServer", async () => {
        await swap_server.start();
    });

    after("Stop TestSwapServer", async () => {
        await swap_server.stop();
        await swap_storage.dropTestDB(config.database.database);
    });

    before("Load contracts for test", () => {
        contract_manager = swap_server.bridge_contract_manager;
    });

    context("Test of endpoint", () => {
        it("Save the sample data", async () => {
            await swap_server.pushBridgeSampleData();
        });

        it("Test of the path /bridge/swaps", async () => {
            const uri = URI(serverURL)
                .directory("bridge/swaps")
                .filename("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")
                .addQuery("page", 1)
                .addQuery("page_size", 5);
            const url = uri.toString();
            const response = await client.get(url);

            assert.ok(response.data);
            assert.ok(response.data.data);

            const header = response.data.data.header;
            assert.strictEqual(header.address, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
            assert.strictEqual(header.page, 1);
            assert.strictEqual(header.page_size, 5);
            assert.strictEqual(header.total_page, 4);

            const items = response.data.data.items;
            assert.strictEqual(items.length, 5);
        });

        it("Wait", async () => {
            await delay(5000);
        });

        it("Test of the path /bridge/prices", async () => {
            const uri = URI(serverURL).directory("bridge/prices");
            const url = uri.toString();
            const response = await client.get(url);

            assert.ok(response.data);
            assert.ok(response.data.data);
            assert.ok(response.data.data.gas_price);
            assert.ok(response.data.data.eth_boa_rate);
            assert.ok(response.data.data.coin_prices);
            assert.ok(response.data.data.coin_prices.eth.krw);
            assert.ok(response.data.data.coin_prices.eth.usd);
            assert.ok(response.data.data.coin_prices.boa.krw);
            assert.ok(response.data.data.coin_prices.boa.usd);
        });

        it("Test of the path /bridge/contracts", async () => {
            const uri = URI(serverURL).directory("bridge/contracts");
            const response = await client.get(uri.toString());

            assert.strictEqual(response.data.data.boa_bridge.boa_ethnet_address, config.bridge.boa_ethnet_address);
            assert.strictEqual(
                response.data.data.boa_bridge.bridge_ethnet_address,
                config.bridge.bridge_ethnet_address
            );
            assert.strictEqual(
                response.data.data.boa_bridge.bridge_biznet_address,
                config.bridge.bridge_biznet_address
            );

            assert.strictEqual(
                response.data.data.boa_bridge.gas_usage.open_deposit,
                config.bridge.gas_usage_open_deposit
            );
            assert.strictEqual(
                response.data.data.boa_bridge.gas_usage.close_deposit,
                config.bridge.gas_usage_close_deposit
            );
            assert.strictEqual(
                response.data.data.boa_bridge.gas_usage.open_withdraw,
                config.bridge.gas_usage_open_withdraw
            );
            assert.strictEqual(
                response.data.data.boa_bridge.gas_usage.close_withdraw,
                config.bridge.gas_usage_close_withdraw
            );
            assert.strictEqual(response.data.data.boa_bridge.fee, config.bridge.fee);

            assert.strictEqual(
                response.data.data.token_bridge.bridge_ethnet_address,
                config.token_bridge.bridge_ethnet_address
            );
            assert.strictEqual(
                response.data.data.token_bridge.bridge_biznet_address,
                config.token_bridge.bridge_biznet_address
            );
        });

        it("Test of the path /bridge/fees", async () => {
            const uri = URI(serverURL)
                .directory("bridge/fees")
                .addQuery("type", BridgeType.BOA)
                .addQuery("amount", BOAToken.make("100").toString())
                .addQuery("direction", "0");
            const response = await client.get(uri.toString());

            assert.strictEqual(response.data.data.swap_fee, "300000000");
            const tx_fee = BigNumber.from(response.data.data.tx_fee);
            assert.ok(tx_fee.gt(BigNumber.from("200000000")));
            assert.ok(tx_fee.lt(BigNumber.from("1500000000")));
        });

        it("Test of the path /bridge/fees", async () => {
            const uri = URI(serverURL)
                .directory("bridge/fees")
                .addQuery("type", BridgeType.BOA)
                .addQuery("amount", BOACoin.make("100").toString())
                .addQuery("direction", "1");
            const response = await client.get(uri.toString());

            assert.strictEqual(response.data.data.swap_fee, "30000000000000000000");
            const tx_fee = BigNumber.from(response.data.data.tx_fee);
            assert.ok(tx_fee.gt(BigNumber.from("100000000000000000000")));
            assert.ok(tx_fee.lt(BigNumber.from("800000000000000000000")));
        });

        it("Test of the path /bridge/fees", async () => {
            const uri = URI(serverURL)
                .directory("bridge/fees")
                .addQuery("type", BridgeType.TOKEN)
                .addQuery("amount", BOAToken.make("100").toString())
                .addQuery("direction", "0");
            const response = await client.get(uri.toString());

            assert.strictEqual(response.data.data.swap_fee, "0");
            const tx_fee = BigNumber.from(response.data.data.tx_fee);
            assert.ok(tx_fee.gt(BigNumber.from("500000000000000")));
            assert.ok(tx_fee.lt(BigNumber.from("5000000000000000")));
        });

        it("Test of the path /bridge/fees", async () => {
            const uri = URI(serverURL)
                .directory("bridge/fees")
                .addQuery("type", BridgeType.TOKEN)
                .addQuery("amount", BOACoin.make("100").toString())
                .addQuery("direction", "1");
            const response = await client.get(uri.toString());

            assert.strictEqual(response.data.data.swap_fee, "0");
            const tx_fee = BigNumber.from(response.data.data.tx_fee);
            assert.ok(tx_fee.gt(BigNumber.from("100000000000000000000")));
            assert.ok(tx_fee.lt(BigNumber.from("800000000000000000000")));
        });
    });
});
