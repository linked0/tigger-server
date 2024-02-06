/**
 *  Main of Swap Server
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { IScheduler } from "./modules/scheduler/Scheduler";
import { Storage } from "./modules/storage/Storage";
import { Config } from "./service/common/Config";
import { logger, Logger } from "./service/common/Logger";
import { BridgeScheduler } from "./service/scheduler/BridgeScheduler";
import { CGCCoinPriceScheduler } from "./service/scheduler/CGCCoinPriceScheduler";
import { CMCCoinPriceScheduler } from "./service/scheduler/CMCCoinPriceScheduler";
import { GasPriceScheduler } from "./service/scheduler/GasPriceScheduler";
import { SwapStorage } from "./service/storage/SwapStorage";
import { SwapServer } from "./service/SwapServer";
import { HardhatUtils } from "./service/utils";

// Create with the arguments and read from file
const config = Config.createWithArgument();

// Now configure the logger with the expected transports
switch (process.env.NODE_ENV) {
    case "test":
        // Logger is silent, do nothing
        break;

    case "development":
        // Only use the console log
        logger.add(Logger.defaultConsoleTransport());
        break;

    case "production":
    default:
        // Read the config file and potentially use both
        logger.add(Logger.defaultFileTransport(config.logging.folder));
        if (config.logging.console) logger.add(Logger.defaultConsoleTransport());
}
logger.transports.forEach((tp) => {
    tp.level = config.logging.level;
});

logger.info(`address: ${config.server.address}`);
logger.info(`port: ${config.server.port}`);

let server: SwapServer;
Storage.waiteForConnection(config.database)
    .then(() => {
        return SwapStorage.make(config.database);
    })
    .then(async (storage) => {
        await config.decrypt();
        if (process.env.NODE_ENV !== "production") {
            await HardhatUtils.deployBOABridgeForTest(config);
            await HardhatUtils.deployTokenBridgeForTest(config);
        }
        const schedulers: IScheduler[] = [];
        if (config.scheduler.enable) {
            let scheduler = config.scheduler.getScheduler("bridge");
            if (scheduler && scheduler.enable) {
                schedulers.push(new BridgeScheduler(scheduler.interval));
            }
            scheduler = config.scheduler.getScheduler("cgc_coin_price");
            if (scheduler && scheduler.enable) {
                schedulers.push(new CGCCoinPriceScheduler(scheduler.interval));
            }
            scheduler = config.scheduler.getScheduler("cmc_coin_price");
            if (scheduler && scheduler.enable) {
                schedulers.push(new CMCCoinPriceScheduler(scheduler.interval));
            }
            scheduler = config.scheduler.getScheduler("eth_gas_price");
            if (scheduler && scheduler.enable) {
                schedulers.push(new GasPriceScheduler(scheduler.interval));
            }
        }
        server = new SwapServer(config, storage, schedulers);
        return server.start().catch((error: any) => {
            // handle specific listen errors with friendly messages
            switch (error.code) {
                case "EACCES":
                    logger.error(`${config.server.port} requires elevated privileges`);
                    break;
                case "EADDRINUSE":
                    logger.error(`Port ${config.server.port} is already in use`);
                    break;
                default:
                    logger.error(`An error occurred while starting the server: ${error.stack}`);
            }
            process.exit(1);
        });
    })
    .catch((error: any) => {
        logger.error(`Failed to start bridge server: ${error}`);
        process.exit(1);
    });

process.on("SIGINT", () => {
    server.stop().then(() => {
        process.exit(0);
    });
});
