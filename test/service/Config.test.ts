import { Config } from "../../src/service/common/Config";

import * as assert from "assert";

describe("Test of Config", () => {
    it("Test parsing the settings of a string", async () => {
        const config: Config = new Config();
        config.readFromFile("./test/service/config.test.yaml");
        assert.strictEqual(config.server.address, "127.0.0.1");
        assert.strictEqual(config.server.port.toString(), "3000");
        assert.strictEqual(config.database.host, "127.0.0.1");
        assert.strictEqual(config.database.user, "root");
        assert.strictEqual(config.database.database, "devswap");
        assert.strictEqual(config.database.port.toString(), "3306");
        assert.strictEqual(config.database.password.toString(), "12345678");
        assert.strictEqual(config.logging.folder, "/swap/logs");
        assert.strictEqual(config.logging.level, "debug");
        assert.strictEqual(config.bridge.boa_ethnet_address, "0xeEdC2Ac65dF232AB6d229EBD4E3F564e194ffe7D");
        assert.strictEqual(config.bridge.bridge_ethnet_address, "0xab929174E887E5418C1E6dB1995CDCc23AE40c89");
        assert.strictEqual(config.bridge.bridge_biznet_address, "0x7f28F281d57AC7d99A8C2FAd2d37271c2c9c67D6");
        assert.strictEqual(config.bridge.ethnet_interval.toString(), "5");
        assert.strictEqual(config.bridge.biznet_interval.toString(), "1");
        assert.strictEqual(config.bridge.ethnet_network, "ethnet");
        assert.strictEqual(config.bridge.biznet_network, "biznet");

        assert.strictEqual(config.bridge.gas_usage_open_deposit, 200000);
        assert.strictEqual(config.bridge.gas_usage_close_deposit, 70000);
        assert.strictEqual(config.bridge.gas_usage_open_withdraw, 200000);
        assert.strictEqual(config.bridge.gas_usage_close_withdraw, 100000);
        assert.strictEqual(config.bridge.fee, 30);

        assert.strictEqual(
            config.bridge.manager_key,
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
        );
        assert.strictEqual(config.bridge.fee_address, "0x7F68D51ca06b7F31b563Cad621c801e9EA6Ec845");

        assert.strictEqual(config.token_bridge.bridge_ethnet_address, "0x4917760620Bd62aC9C6c3bfE474cBb5283ac786a");
        assert.strictEqual(config.token_bridge.bridge_biznet_address, "0x60Cd432370d6C6f1Ee953029320e0BC595686C26");
        assert.strictEqual(config.token_bridge.ethnet_interval.toString(), "14");
        assert.strictEqual(config.token_bridge.biznet_interval.toString(), "14");
        assert.strictEqual(config.token_bridge.ethnet_network, "ethnet");
        assert.strictEqual(config.token_bridge.biznet_network, "biznet");
        assert.deepStrictEqual(config.token_bridge.token_addresses, [
            {
                "ethnet": "0xa470F8F6c183960C1D9456bFcEA389ef94Ee971d", "biznet": "0xC6529c4492bb6667E13193ba0D3e3914321FA434",
            },
            {
                "ethnet": "0xCaC6398E6DAed9742A297aDD4376bE1bA5904f08", "biznet": "0xcfB9F47b86dE685D2E112B01Fd69B7b26d84b8cA",
            }]);

        assert.strictEqual(config.scheduler.enable, true);
        assert.strictEqual(config.scheduler.items.length, 1);
        assert.strictEqual(config.scheduler.items[0].name, "bridge");
        assert.strictEqual(config.scheduler.items[0].enable, true);
        assert.strictEqual(config.scheduler.items[0].interval, 1);
        assert.strictEqual(config.cgc_coin_price.items.length, 2);
        assert.strictEqual(config.cgc_coin_price.items[0].id, "bosagora");
        assert.strictEqual(config.cgc_coin_price.items[0].symbol, "BOA");
        assert.strictEqual(config.cgc_coin_price.items[1].id, "ethereum");
        assert.strictEqual(config.cgc_coin_price.items[1].symbol, "ETH");
        assert.strictEqual(config.cmc_coin_price.items[0].id, "bosagora");
        assert.strictEqual(config.cmc_coin_price.items[0].symbol, "BOA");
        assert.strictEqual(config.cmc_coin_price.items[1].id, "ethereum");
        assert.strictEqual(config.cmc_coin_price.items[1].symbol, "ETH");

        assert.strictEqual(config.key_store.items[0].name, "manager");
        assert.strictEqual(config.key_store.items[0].file, "test_manager.key");
        assert.strictEqual(config.key_store.items[0].key_store.valid, false);
    });
});
