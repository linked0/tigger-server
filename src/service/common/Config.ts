/**
 *  Define the configuration objects that are used through the application
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { ArgumentParser } from "argparse";
import extend from "extend";
import fs from "fs";
import ip from "ip";
import path from "path";
import { readYamlEnvSync } from "yaml-env-defaults";
import { Utils } from "../../modules/utils/Utils";
import { KeyStore } from "../keystore/KeyStore";

/**
 * Main config
 */
export class Config implements IConfig {
    /**
     * Server config
     */
    public server: ServerConfig;

    /**
     * Database config
     */
    public database: DatabaseConfig;

    /**
     * Logging config
     */
    public logging: LoggingConfig;

    /**
     * BOA Bridge config
     */
    public bridge: BridgeConfig;

    /**
     * BOA Bridge config
     */
    public token_bridge: TokenBridgeConfig;

    /**
     * Scheduler
     */
    public scheduler: SchedulerConfig;

    /**
     * CoinGecko Coin Price Config
     */
    public cgc_coin_price: CoinsPriceConfig;

    /**
     * CoinMarketCap Coin Price Config
     */
    public cmc_coin_price: CoinsPriceConfig;

    public key_store: KeyStoreConfig;

    /**
     * Constructor
     */
    constructor() {
        this.server = new ServerConfig();
        this.database = new DatabaseConfig();
        this.logging = new LoggingConfig();
        this.key_store = new KeyStoreConfig();
        this.bridge = new BridgeConfig();
        this.token_bridge = new TokenBridgeConfig();
        this.scheduler = new SchedulerConfig();
        this.cgc_coin_price = new CoinsPriceConfig();
        this.cmc_coin_price = new CoinsPriceConfig();
    }

    /**
     * Parses the command line arguments, Reads from the configuration file
     */
    public static createWithArgument(): Config {
        // Parse the arguments
        const parser = new ArgumentParser();
        parser.add_argument("-c", "--config", {
            default: "config.yaml",
            help: "Path to the config file to use",
        });
        const args = parser.parse_args();

        let configPath = path.resolve(Utils.getInitCWD(), args.config);
        if (!fs.existsSync(configPath)) configPath = path.resolve(Utils.getInitCWD(), "config/config.yaml");
        if (!fs.existsSync(configPath)) {
            console.error(`Config file '${configPath}' does not exists`);
            process.exit(1);
        }

        const cfg = new Config();
        try {
            cfg.readFromFile(configPath);
        } catch (error: any) {
            // Logging setup has not been completed and is output to the console.
            console.error(error.message);

            // If the process fails to read the configuration file, the process exits.
            process.exit(1);
        }
        return cfg;
    }

    /**
     * Reads from file
     * @param config_file The file name of configuration
     */
    public readFromFile(config_file: string) {
        const cfg = readYamlEnvSync([path.resolve(Utils.getInitCWD(), config_file)], (key) => {
            return (process.env || {})[key];
        }) as IConfig;
        this.server.readFromObject(cfg.server);
        this.database.readFromObject(cfg.database);
        this.logging.readFromObject(cfg.logging);
        this.bridge.readFromObject(cfg.bridge);
        this.token_bridge.readFromObject(cfg.token_bridge);
        this.scheduler.readFromObject(cfg.scheduler);
        this.cgc_coin_price.readFromObject(cfg.cgc_coin_price);
        this.cmc_coin_price.readFromObject(cfg.cmc_coin_price);
        this.key_store.readFromObject(cfg.key_store);
    }

    public async decrypt() {
        await this.key_store.decrypt();
        this.bridge.manager_key = await this.key_store.getPrivateKey(this.bridge.manager_key);
        this.token_bridge.manager_key = await this.key_store.getPrivateKey(this.token_bridge.manager_key);
    }
}

/**
 * Server config
 */
export class ServerConfig implements IServerConfig {
    /**
     * THe address to which we bind
     */
    public address: string;

    /**
     * The port on which we bind
     */
    public port: number;

    /**
     * Constructor
     * @param address The address to which we bind
     * @param port The port on which we bind
     */
    constructor(address?: string, port?: number) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, { address, port });

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }

        this.address = conf.address;
        this.port = conf.port;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IServerConfig {
        return {
            address: "127.0.0.1",
            port: 3000,
        };
    }

    /**
     * Reads from Object
     * @param config The object of IServerConfig
     */
    public readFromObject(config: IServerConfig) {
        const conf = extend(true, {}, ServerConfig.defaultValue());
        extend(true, conf, config);

        if (!ip.isV4Format(conf.address) && !ip.isV6Format(conf.address)) {
            console.error(`${conf.address}' is not appropriate to use as an IP address.`);
            process.exit(1);
        }
        this.address = conf.address;
        this.port = conf.port;
    }
}

/**
 * Database config
 */
export class DatabaseConfig implements IDatabaseConfig {
    /**
     * The host of mysql
     */
    host: string;

    /**
     * The user of mysql
     */
    user: string;

    /**
     * The password of mysql
     */
    password: string;

    /**
     * The database name
     */
    database?: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * multiple Statements exec config
     */
    multipleStatements: boolean;

    /**
     * Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     */
    waitForConnections: boolean;

    /**
     * The maximum number of connections to create at once.
     */
    connectionLimit: number;

    /**
     * The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    queueLimit: number;

    /**
     * Constructor
     * @param host Mysql database host
     * @param user Mysql database user
     * @param password Mysql database password
     * @param database Mysql database name
     * @param port Mysql database port
     * @param multipleStatements Mysql allow multiple statement to execute (true / false)
     * @param waitForConnections Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     * @param connectionLimit The maximum number of connections to create at once.
     * @param queueLimit The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    constructor(
        host?: string,
        user?: string,
        password?: string,
        database?: string,
        port?: number,
        multipleStatements?: boolean,
        waitForConnections?: boolean,
        connectionLimit?: number,
        queueLimit?: number
    ) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, {
            host,
            user,
            password,
            database,
            port,
            multipleStatements,
            waitForConnections,
            connectionLimit,
            queueLimit,
        });
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.port = conf.port;
        this.multipleStatements = conf.multipleStatements;
        this.waitForConnections = conf.waitForConnections;
        this.connectionLimit = conf.connectionLimit;
        this.queueLimit = conf.queueLimit;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IDatabaseConfig {
        return {
            host: "localhost",
            user: "root",
            password: "12345678",
            database: "boascan",
            port: 3306,
            multipleStatements: true,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
    }

    /**
     * Reads from Object
     * @param config The object of IDatabaseConfig
     */
    public readFromObject(config: IDatabaseConfig) {
        const conf = extend(true, {}, DatabaseConfig.defaultValue());
        extend(true, conf, config);
        this.host = conf.host;
        this.user = conf.user;
        this.password = conf.password;
        this.database = conf.database;
        this.port = conf.port;
        this.multipleStatements = conf.multipleStatements;
        this.waitForConnections = conf.waitForConnections;
        this.connectionLimit = conf.connectionLimit;
        this.queueLimit = conf.queueLimit;
    }
}

/**
 * BOA Bridge config
 */
export class BridgeConfig implements IBridgeConfig {
    /**
     * The address of BOA token's smart contract in EthNet
     */
    public boa_ethnet_address: string;

    /**
     * The address of BOA bridge's contract in EthNet
     */
    public bridge_ethnet_address: string;

    /**
     * The address of BOA bridge's smart contract in BizNet
     */
    public bridge_biznet_address: string;

    /**
     * Status check cycle of EthNet
     */
    public ethnet_interval: number;

    /**
     * Status check cycle of BizNet
     */
    public biznet_interval: number;

    /**
     * Network name set in hardhat.config.ts for EthNet
     */
    public ethnet_network: string;

    /**
     * Network name set in hardhat.config.ts for BizNet
     */
    public biznet_network: string;

    /**
     * 함수 openDeposit 평균 가스사용량
     */
    public gas_usage_open_deposit: number;

    /**
     * 함수 closeDeposit 평균 가스사용량
     */
    public gas_usage_close_deposit: number;

    /**
     * 함수 openWithdraw 평균 가스사용량
     */
    public gas_usage_open_withdraw: number;

    /**
     * 함수 closeWithdraw 평균 가스사용량
     */
    public gas_usage_close_withdraw: number;

    /**
     * 교환 수수료
     */
    public fee: number;

    /**
     * 교환에 사용되는 계정의 비밀키 또는 키파일
     */
    public manager_key: string;

    /**
     * 교환시 수수료를 저장하는 계정의 비밀키 또는 키파일
     */
    public fee_address: string;

    /**
     * Constructor
     */
    constructor() {
        const defaults = BridgeConfig.defaultValue();
        this.boa_ethnet_address = defaults.boa_ethnet_address;
        this.bridge_ethnet_address = defaults.bridge_ethnet_address;
        this.bridge_biznet_address = defaults.bridge_biznet_address;
        this.ethnet_interval = defaults.ethnet_interval;
        this.biznet_interval = defaults.biznet_interval;
        this.ethnet_network = defaults.ethnet_network;
        this.biznet_network = defaults.biznet_network;

        this.gas_usage_open_deposit = defaults.gas_usage_open_deposit;
        this.gas_usage_close_deposit = defaults.gas_usage_close_deposit;
        this.gas_usage_open_withdraw = defaults.gas_usage_open_withdraw;
        this.gas_usage_close_withdraw = defaults.gas_usage_close_withdraw;
        this.fee = defaults.fee;

        this.manager_key = defaults.manager_key;
        this.fee_address = defaults.fee_address;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IBridgeConfig {
        return {
            boa_ethnet_address: process.env.BOA_ETHNET_CONTRACT_ADDRESS || "",
            bridge_ethnet_address: process.env.BRIDGE_ETHNET_CONTRACT_ADDRESS || "",
            bridge_biznet_address: process.env.BRIDGE_BIZNET_CONTRACT_ADDRESS || "",
            ethnet_interval: 5,
            biznet_interval: 5,
            ethnet_network: "hardhat",
            biznet_network: "hardhat",

            gas_usage_open_deposit: 213968,
            gas_usage_close_deposit: 79238,
            gas_usage_open_withdraw: 197145,
            gas_usage_close_withdraw: 111016,
            fee: 30,
            manager_key: process.env.MANAGER_KEY || "",
            fee_address: process.env.FEE_MANAGER_ADDRESS || "",
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: IBridgeConfig) {
        if (config.boa_ethnet_address !== undefined) this.boa_ethnet_address = config.boa_ethnet_address;
        if (config.bridge_ethnet_address !== undefined) this.bridge_ethnet_address = config.bridge_ethnet_address;
        if (config.bridge_biznet_address !== undefined) this.bridge_biznet_address = config.bridge_biznet_address;
        if (config.ethnet_interval !== undefined) this.ethnet_interval = config.ethnet_interval;
        if (config.biznet_interval !== undefined) this.biznet_interval = config.biznet_interval;
        if (config.ethnet_network !== undefined) this.ethnet_network = config.ethnet_network;
        if (config.biznet_network !== undefined) this.biznet_network = config.biznet_network;

        if (config.gas_usage_open_deposit !== undefined) this.gas_usage_open_deposit = config.gas_usage_open_deposit;
        if (config.gas_usage_close_deposit !== undefined) this.gas_usage_close_deposit = config.gas_usage_close_deposit;
        if (config.gas_usage_open_withdraw !== undefined) this.gas_usage_open_withdraw = config.gas_usage_open_withdraw;
        if (config.gas_usage_close_withdraw !== undefined)
            this.gas_usage_close_withdraw = config.gas_usage_close_withdraw;

        if (config.fee !== undefined) this.fee = config.fee;
        if (config.manager_key !== undefined) this.manager_key = config.manager_key;
        if (config.fee_address !== undefined) this.fee_address = config.fee_address;
    }
}

/**
 * Token Bridge config
 */
export class TokenBridgeConfig implements ITokenBridgeConfig {
    /**
     * The address of BOA bridge's contract in EthNet
     */
    public bridge_ethnet_address: string;

    /**
     * The address of BOA bridge's smart contract in BizNet
     */
    public bridge_biznet_address: string;

    /**
     * Status check cycle of EthNet
     */
    public ethnet_interval: number;

    /**
     * Status check cycle of BizNet
     */
    public biznet_interval: number;

    /**
     * Network name set in hardhat.config.ts for EthNet
     */
    public ethnet_network: string;

    /**
     * Network name set in hardhat.config.ts for BizNet
     */
    public biznet_network: string;

    /**
     * 함수 openDeposit 평균 가스사용량
     */
    public gas_usage_open_deposit: number;

    /**
     * 함수 closeDeposit 평균 가스사용량
     */
    public gas_usage_close_deposit: number;

    /**
     * 함수 openWithdraw 평균 가스사용량
     */
    public gas_usage_open_withdraw: number;

    /**
     * 함수 closeWithdraw 평균 가스사용량
     */
    public gas_usage_close_withdraw: number;

    /**
     * 교환에 사용되는 계정의 비밀키 또는 키파일
     */
    public manager_key: string;

    public token_addresses: ITokenBridgeTokenType[];

    /**
     * Constructor
     */
    constructor() {
        const defaults = TokenBridgeConfig.defaultValue();
        this.bridge_ethnet_address = defaults.bridge_ethnet_address;
        this.bridge_biznet_address = defaults.bridge_biznet_address;
        this.token_addresses = defaults.token_addresses;
        this.ethnet_interval = defaults.ethnet_interval;
        this.biznet_interval = defaults.biznet_interval;
        this.ethnet_network = defaults.ethnet_network;
        this.biznet_network = defaults.biznet_network;

        this.gas_usage_open_deposit = defaults.gas_usage_open_deposit;
        this.gas_usage_close_deposit = defaults.gas_usage_close_deposit;
        this.gas_usage_open_withdraw = defaults.gas_usage_open_withdraw;
        this.gas_usage_close_withdraw = defaults.gas_usage_close_withdraw;

        this.manager_key = defaults.manager_key;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ITokenBridgeConfig {
        return {
            bridge_ethnet_address: process.env.TOKEN_BRIDGE_ETHNET_CONTRACT_ADDRESS || "",
            bridge_biznet_address: process.env.TOKEN_BRIDGE_BIZNET_CONTRACT_ADDRESS || "",
            ethnet_interval: 5,
            biznet_interval: 5,
            ethnet_network: "hardhat",
            biznet_network: "hardhat",

            gas_usage_open_deposit: 213968,
            gas_usage_close_deposit: 79238,
            gas_usage_open_withdraw: 197145,
            gas_usage_close_withdraw: 111016,
            manager_key: process.env.MANAGER_KEY || "",
            token_addresses: [
                {
                    ethnet: process.env.TOKEN_BRIDGE_ETHNET_TOKEN_ADDRESS1 || "",
                    biznet: process.env.TOKEN_BRIDGE_BIZNET_TOKEN_ADDRESS1 || "",
                },
            ],
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: ITokenBridgeConfig) {
        if (config.bridge_ethnet_address !== undefined) this.bridge_ethnet_address = config.bridge_ethnet_address;
        if (config.bridge_biznet_address !== undefined) this.bridge_biznet_address = config.bridge_biznet_address;
        if (config.ethnet_interval !== undefined) this.ethnet_interval = config.ethnet_interval;
        if (config.biznet_interval !== undefined) this.biznet_interval = config.biznet_interval;
        if (config.ethnet_network !== undefined) this.ethnet_network = config.ethnet_network;
        if (config.biznet_network !== undefined) this.biznet_network = config.biznet_network;
        if (config.token_addresses !== undefined && config.token_addresses !== null)
            this.token_addresses = config.token_addresses;
        else this.token_addresses = [];

        if (config.gas_usage_open_deposit !== undefined) this.gas_usage_open_deposit = config.gas_usage_open_deposit;
        if (config.gas_usage_close_deposit !== undefined) this.gas_usage_close_deposit = config.gas_usage_close_deposit;
        if (config.gas_usage_open_withdraw !== undefined) this.gas_usage_open_withdraw = config.gas_usage_open_withdraw;
        if (config.gas_usage_close_withdraw !== undefined)
            this.gas_usage_close_withdraw = config.gas_usage_close_withdraw;

        if (config.manager_key !== undefined) this.manager_key = config.manager_key;
    }
}

/**
 * Logging config
 */
export class LoggingConfig implements ILoggingConfig {
    /**
     * The path of logging files
     */
    public folder: string;

    /**
     * The level of logging
     */
    public level: string;

    /**
     * Whether the console is enabled as well
     */
    public console: boolean;

    /**
     * Constructor
     */
    constructor() {
        const defaults = LoggingConfig.defaultValue();
        this.folder = path.resolve(Utils.getInitCWD(), defaults.folder);
        this.level = defaults.level;
        this.console = defaults.console;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ILoggingConfig {
        return {
            folder: path.resolve(Utils.getInitCWD(), "logs/"),
            level: "info",
            console: false,
        };
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: ILoggingConfig) {
        if (config.folder) this.folder = path.resolve(Utils.getInitCWD(), config.folder);
        if (config.level) this.level = config.level;
        if (config.console !== undefined) this.console = config.console;
    }
}

/**
 * Information on the scheduler.
 */
export class SchedulerConfig implements ISchedulerConfig {
    /**
     * Whether the scheduler is used or not
     */
    public enable: boolean;

    /**
     * Container for scheduler items
     */
    public items: ISchedulerItemConfig[];

    /**
     * Constructor
     */
    constructor() {
        const defaults = SchedulerConfig.defaultValue();
        this.enable = defaults.enable;
        this.items = defaults.items;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ISchedulerConfig {
        return {
            enable: false,
            items: [
                {
                    name: "bridge",
                    enable: false,
                    interval: 1,
                },
            ],
        } as unknown as ISchedulerConfig;
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: ISchedulerConfig) {
        this.enable = false;
        this.items = [];
        if (config === undefined) return;
        if (config.enable !== undefined) this.enable = config.enable;
        if (config.items !== undefined) this.items = config.items;
    }

    public getScheduler(name: string): ISchedulerItemConfig | undefined {
        return this.items.find((m) => m.name === name);
    }
}

export class KeyStoreConfig implements IKeyStoreConfig {
    public items: IKeyStoreItemConfig[];
    /**
     * Constructor
     */
    constructor() {
        const defaults = KeyStoreConfig.defaultValue();
        this.items = defaults.items;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): IKeyStoreConfig {
        return {
            items: [],
        } as unknown as IKeyStoreConfig;
    }

    /**
     * Reads from Object
     * @param config The object of ILoggingConfig
     */
    public readFromObject(config: IKeyStoreConfig) {
        this.items = [];
        if (config === undefined) return;
        if (config.items !== undefined) {
            for (const elem of config.items) {
                this.items.push({
                    name: elem.name,
                    file: elem.file,
                    key_store: new KeyStore(elem.name, path.resolve("keystore/" + elem.file)),
                });
            }
        }
    }

    public getItemByID(name: string): IKeyStoreItemConfig | undefined {
        const find = name.toLowerCase();
        return this.items.find((m) => m.name.toLowerCase() === find);
    }

    public async decrypt() {
        for (const elem of this.items) {
            await elem.key_store.getPrivateKey();
        }
    }

    public async getPrivateKey(value: string) {
        const values = value.split(":");
        if (values.length >= 2 && values[0] === "key_store") {
            const item = this.getItemByID(values[1]);
            if (item !== undefined) {
                return item.key_store.getPrivateKey();
            } else {
                return "";
            }
        } else {
            return value;
        }
    }
}

/**
 * The coins that need a price.
 */
export class CoinsPriceConfig implements ICoinsPriceConfig {
    public items: ICoinsPriceItemConfig[];

    /**
     * Constructor
     */
    constructor() {
        const defaults = CoinsPriceConfig.defaultValue();
        this.items = defaults.items;
    }

    /**
     * Returns default value
     */
    public static defaultValue(): ICoinsPriceConfig {
        return {
            items: [
                {
                    id: "bosagora",
                    symbol: "BOA",
                },
            ],
        } as unknown as ICoinsPriceConfig;
    }

    /**
     * Reads from Object
     * @param config The object of ICoinsPriceConfig
     */
    public readFromObject(config: ICoinsPriceConfig) {
        this.items = [];
        if (config === undefined) return;
        if (config.items !== undefined) this.items = config.items;
    }

    public getItemByID(id: string): ICoinsPriceItemConfig | undefined {
        const find = id.toLowerCase();
        return this.items.find((m) => m.id.toLowerCase() === find);
    }

    public getItemBySymbol(symbol: string): ICoinsPriceItemConfig | undefined {
        const find = symbol.toLowerCase();
        return this.items.find((m) => m.symbol.toLowerCase() === find);
    }
}

/**
 * The interface of server config
 */
export interface IServerConfig {
    /**
     * The address to which we bind
     */
    address: string;

    /**
     * The port on which we bind
     */
    port: number;
}

/**
 * The interface of database config
 */
export interface IDatabaseConfig {
    /**
     * The host of mysql
     */
    host: string;

    /**
     * The user of mysql
     */
    user: string;

    /**
     * The password of mysql
     */
    password: string;

    /**
     * The database name
     */
    database?: string;

    /**
     * The host database port
     */
    port: number;

    /**
     * Multiple Statements execution statement Option
     */
    multipleStatements: boolean;

    /**
     * Determines the pool's action when no connections are available
     * and the limit has been reached.
     * If true, the pool will queue the connection request and call
     * it when one becomes available.
     * If false, the pool will immediately call back with an error.
     */
    waitForConnections: boolean;

    /**
     * The maximum number of connections to create at once.
     */
    connectionLimit: number;

    /**
     * The maximum number of connection requests the pool
     * will queue before returning an error from getConnection.
     * If set to 0, there is no limit to the number of queued connection requests.
     */
    queueLimit: number;
}

/**
 * The interface of logging config
 */
export interface ILoggingConfig {
    /**
     * The path of logging files
     */
    folder: string;

    /**
     * The level of logging
     */
    level: string;

    /**
     * Whether the console is enabled as well
     */
    console: boolean;
}

/**
 * The interface of BOA Bridge Config
 */
export interface IBridgeConfig {
    /**
     * The address of BOA token's smart contract in EthNet
     */
    boa_ethnet_address: string;

    /**
     * The address of BOA bridge's contract in EthNet
     */
    bridge_ethnet_address: string;

    /**
     * The address of BOA bridge's smart contract in BizNet
     */
    bridge_biznet_address: string;

    /**
     * Status check cycle of EthNet
     */
    ethnet_interval: number;

    /**
     * Status check cycle of BizNet
     */
    biznet_interval: number;

    /**
     * Network name set in hardhat.config.ts for EthNet
     */
    ethnet_network: string;

    /**
     * Network name set in hardhat.config.ts for BizNet
     */
    biznet_network: string;

    gas_usage_open_deposit: number;
    gas_usage_close_deposit: number;
    gas_usage_open_withdraw: number;
    gas_usage_close_withdraw: number;

    fee: number;

    manager_key: string;
    fee_address: string;
}

export interface ITokenBridgeTokenType {
    ethnet: string;
    biznet: string;
}

/**
 * The interface of Token Bridge Config
 */
export interface ITokenBridgeConfig {
    /**
     * The address of BOA bridge's contract in EthNet
     */
    bridge_ethnet_address: string;

    /**
     * The address of BOA bridge's smart contract in BizNet
     */
    bridge_biznet_address: string;

    /**
     * Status check cycle of EthNet
     */
    ethnet_interval: number;

    /**
     * Status check cycle of BizNet
     */
    biznet_interval: number;

    /**
     * Network name set in hardhat.config.ts for EthNet
     */
    ethnet_network: string;

    /**
     * Network name set in hardhat.config.ts for BizNet
     */
    biznet_network: string;

    gas_usage_open_deposit: number;
    gas_usage_close_deposit: number;
    gas_usage_open_withdraw: number;
    gas_usage_close_withdraw: number;

    manager_key: string;

    token_addresses: ITokenBridgeTokenType[];
}

/**
 * The interface of Scheduler Item Config
 */
export interface ISchedulerItemConfig {
    /**
     * Name
     */
    name: string;

    /**
     * Whether it's used or not
     */
    enable: boolean;

    /**
     * Execution cycle (seconds)
     */
    interval: number;
}

/**
 * The interface of Scheduler Config
 */
export interface ISchedulerConfig {
    /**
     * Whether the scheduler is used or not
     */
    enable: boolean;

    /**
     * Container for scheduler items
     */
    items: ISchedulerItemConfig[];

    /**
     * Find the scheduler item with your name
     * @param name The name of the scheduler item
     */
    getScheduler(name: string): ISchedulerItemConfig | undefined;
}

/**
 * The interface of Coin Price Item Config
 */
export interface ICoinsPriceItemConfig {
    /**
     * Coin ID of Coin Gecko
     */
    id: string;

    /**
     * Coin Symbol ("BOA", "ETH")
     */
    symbol: string;
}

/**
 * The interface of Coin Price Config
 */
export interface ICoinsPriceConfig {
    items: ICoinsPriceItemConfig[];
    getItemByID(id: string): ICoinsPriceItemConfig | undefined;
    getItemBySymbol(symbol: string): ICoinsPriceItemConfig | undefined;
}

/**
 *  The gas usage fee
 */
export interface IGasUsage {
    open_deposit: number;
    close_deposit: number;
    open_withdraw: number;
    close_withdraw: number;
}

export interface IKeyStoreItemConfig {
    name: string;
    file: string;
    key_store: KeyStore;
}

/**
 *  The gas usage fee
 */
export interface IKeyStoreConfig {
    items: IKeyStoreItemConfig[];
    getItemByID(name: string): IKeyStoreItemConfig | undefined;
}

/**
 * The interface of main config
 */
export interface IConfig {
    /**
     * Server config
     */
    server: IServerConfig;

    /**
     * Database config
     */
    database: IDatabaseConfig;

    /**
     * Logging config
     */
    logging: ILoggingConfig;

    /**
     * BOA Bridge config
     */
    bridge: IBridgeConfig;

    /**
     * Token Bridge config
     */
    token_bridge: ITokenBridgeConfig;

    /**
     * Scheduler
     */
    scheduler: ISchedulerConfig;

    /**
     * Coin Gecko Coin Price Config
     */
    cgc_coin_price: ICoinsPriceConfig;

    /**
     * Coin Market Cap Coin Price Config
     */
    cmc_coin_price: ICoinsPriceConfig;

    key_store: IKeyStoreConfig;
}
