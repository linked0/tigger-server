import { Scheduler } from "../../src/modules/scheduler/Scheduler";
import { Config } from "../../src/service/common/Config";
import { SwapStorage } from "../../src/service/storage/SwapStorage";
import { HardhatUtils } from "../../src/service/utils";
import { TestSwapServer } from "../Utility";

import path from "path";
import { URL } from "url";

import * as assert from "assert";

class TestScheduler extends Scheduler {
    public init_value: number = 0;
    public value: number = 0;
    public events: string[] = [];

    public setOption(options: any) {
        if (options && options.value !== undefined) this.init_value = options.value;
    }

    protected override async work() {
        this.task?.emit("event1", { value: this.value });
        this.value = this.init_value + 1;
        this.task?.emit("event2", { value: this.value });
    }

    protected addEventHandlers() {
        this.task?.on("event1", this.onEvent1.bind(this));
        this.task?.on("event2", this.onEvent2.bind(this));
    }

    protected removeEventHandlers() {
        this.task?.off("event1", this.onEvent1.bind(this));
        this.task?.off("event2", this.onEvent2.bind(this));
    }

    private onEvent1(param: any) {
        this.events.push("event1");
    }

    private onEvent2(param: any) {
        this.events.push("event2");
    }
}

describe("Test of Scheduler", () => {
    let scheduler: TestScheduler;

    before("Create Scheduler", () => {
        scheduler = new TestScheduler(2);
        scheduler.setOption({ value: 10 });
    });

    it("Start Scheduler", () => {
        scheduler.start();
        assert.ok(scheduler.isRunning());
    });

    it("Check value", async () => {
        await assert.doesNotReject(
            new Promise<void>((resolve, reject) =>
                setTimeout(async () => {
                    try {
                        if (scheduler.value === 11) resolve();
                        else reject();
                    } catch (err) {
                        reject(err);
                    }
                }, 5 * 1000)
            )
        );
        assert.deepStrictEqual(scheduler.events[0], "event1");
        assert.deepStrictEqual(scheduler.events[1], "event2");
    });

    it("Stop Scheduler", async () => {
        scheduler.stop();
        await scheduler.waitForStop();
        assert.ok(!scheduler.isRunning());
    });

    it("Second Start Scheduler", () => {
        scheduler.start();
        assert.ok(scheduler.isRunning());
    });

    it("Second Stop Scheduler", async () => {
        scheduler.stop();
        await scheduler.waitForStop();
        assert.ok(!scheduler.isRunning());
    });
});

class TestScheduler1 extends Scheduler {
    public value: number = 0;

    protected override async work() {
        if (this.value !== 1) this.value = 1;
    }
}

class TestScheduler2 extends Scheduler {
    public value: number = 0;

    protected override async work() {
        if (this.value !== 2) this.value = 2;
    }
}

describe("Test of Using Scheduler", () => {
    let swap_server: TestSwapServer;
    let serverURL: URL;
    const config = new Config();

    let scheduler1: TestScheduler1;
    let scheduler2: TestScheduler2;

    before("Create Scheduler", () => {
        scheduler1 = new TestScheduler1(3);
        scheduler2 = new TestScheduler2(3);
    });

    before("Create TestSwapServer", async () => {
        config.readFromFile(path.resolve(process.cwd(), "config/config_test.yaml"));
        await HardhatUtils.deployBOABridgeForTest(config);
        await HardhatUtils.deployTokenBridgeForTest(config);
        serverURL = new URL(`http://${config.server.address}:${config.server.port}`);
        const swap_storage = await SwapStorage.make(config.database);
        swap_server = new TestSwapServer(config, swap_storage, [scheduler1, scheduler2]);
    });

    before("Start TestSwapServer", async () => {
        await swap_server.start();
    });

    after("Stop TestSwapServer", async () => {
        await swap_server.stop();
        await swap_server.swap_storage.dropTestDB(config.database.database);
    });

    it("Check value", async () => {
        await assert.doesNotReject(
            new Promise<void>((resolve, reject) =>
                setTimeout(() => {
                    if (scheduler1.value === 1 && scheduler2.value === 2) resolve();
                    else reject(new Error(`${scheduler1.value}:${scheduler2.value}`));
                }, 5000)
            )
        );
    });
});
