/**
 *  The web server of Swap Server
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import bodyParser from "body-parser";
import cors from "cors";
import { IScheduler } from "../modules/scheduler/Scheduler";
import { WebService } from "../modules/service/WebService";
import { Config } from "./common/Config";
import { BOABridgeContractManager } from "./contract/BOABridgeContractManager";
import { TokenBridgeContractManager } from "./contract/TokenBridgeContractManager";
import { cors_options } from "./option/cors";
import { BridgeRouter } from "./routers/BridgeRouter";
import { SwapStorage } from "./storage/SwapStorage";

export class SwapServer extends WebService {
    /**
     * The collection of schedulers
     * @protected
     */
    protected schedules: IScheduler[] = [];

    /**
     * The configuration of the database
     * @private
     */
    private readonly _config: Config;

    /**
     * The router of the BOA Bridge
     * @public
     */
    public readonly bridge_router: BridgeRouter;

    /**
     * The Storage of the swap using MYSQL
     * @public
     */
    public readonly swap_storage: SwapStorage;

    /**
     * The contracts manager of the BOA Bridge
     * @public
     */
    public readonly bridge_contract_manager: BOABridgeContractManager;

    /**
     * The contracts manager of the Token Bridge
     * @public
     */
    public readonly token_bridge_contract_manager: TokenBridgeContractManager;

    /**
     * Constructor
     * @param config Configuration
     * @param swap_storage
     * @param schedules Array of IScheduler
     */
    constructor(config: Config, swap_storage: SwapStorage, schedules?: IScheduler[]) {
        super(config.server.port, config.server.address);

        this._config = config;
        this.swap_storage = swap_storage;
        this.bridge_contract_manager = new BOABridgeContractManager(this._config);
        this.token_bridge_contract_manager = new TokenBridgeContractManager(this._config);
        this.bridge_router = new BridgeRouter(
            this,
            swap_storage,
            this.bridge_contract_manager,
            this.token_bridge_contract_manager,
            this._config
        );

        if (schedules) {
            schedules.forEach((m) => this.schedules.push(m));
            this.schedules.forEach((m) =>
                m.setOption({
                    config: this._config,
                    bridge_contract_manager: this.bridge_contract_manager,
                    token_bridge_contract_manager: this.token_bridge_contract_manager,
                    bridge_router: this.bridge_router,
                    storage: this.swap_storage,
                })
            );
        }
    }

    /**
     * Setup and start the server
     */
    public async start(): Promise<void> {
        await this.token_bridge_contract_manager.buildTokenInfo();
        // parse application/x-www-form-urlencoded
        this.app.use(bodyParser.urlencoded({ extended: false, limit: "1mb" }));
        // parse application/json
        this.app.use(bodyParser.json({ limit: "1mb" }));
        this.app.use(cors(cors_options));

        this.bridge_router.registerRoutes();

        this.schedules.forEach((m) => m.start());

        return super.start();
    }

    public stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            for (const m of this.schedules) m.stop();
            for (const m of this.schedules) await m.waitForStop();
            if (this.server != null) {
                this.server.close((err?) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else resolve();
        });
    }
}
