import { Config } from "../../src/service/common/Config";
import { GasPriceScheduler } from "../../src/service/scheduler/GasPriceScheduler";
import { SwapStorage } from "../../src/service/storage/SwapStorage";
import { delay, TestSwapServer } from "../Utility";

import assert from "assert";
import path from "path";
import { URL } from "url";
import { HardhatUtils } from "../../src/service/utils";

describe("Test of Gas Price Scheduler", function () {
    this.timeout(60 * 1000);
    let swap_storage: SwapStorage;
    let swap_server: TestSwapServer;
    let serverURL: URL;
    const config = new Config();

    before("Create TestSwapServer", async () => {
        config.readFromFile(path.resolve(process.cwd(), "config/config_test.yaml"));
        await HardhatUtils.deployBOABridgeForTest(config);
        await HardhatUtils.deployTokenBridgeForTest(config);
        serverURL = new URL(`http://${config.server.address}:${config.server.port}`);
        swap_storage = await SwapStorage.make(config.database);
        swap_server = new TestSwapServer(config, swap_storage, [new GasPriceScheduler(1)]);
        await swap_server.start();
    });

    after("Stop TestSwapServer", async () => {
        await swap_server.stop();
        await swap_storage.dropTestDB(config.database.database);
    });

    it("Wait", async () => {
        await delay(3000);
    });

    it("Check value", async () => {
        const price = await swap_storage.getGasPrice();
        assert.strictEqual(price.symbol, "GAS");
        assert.ok(price.fast !== undefined);
        assert.ok(price.low !== undefined);
        assert.ok(price.average !== undefined);
        assert.ok(price.last_updated_at !== undefined);
    });
});
