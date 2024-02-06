import { Amount, BOACoin } from "../../src/service/common/Amount";
import { Config } from "../../src/service/common/Config";
import { ContractUtils } from "../../src/service/contract/ContractUtils";
import { GasPriceManager } from "../../src/service/contract/GasPriceManager";
import { Token, TokenBridgeContractManager } from "../../src/service/contract/TokenBridgeContractManager";
import { BridgeScheduler } from "../../src/service/scheduler/BridgeScheduler";
import { CGCCoinPriceScheduler } from "../../src/service/scheduler/CGCCoinPriceScheduler";
import { GasPriceScheduler } from "../../src/service/scheduler/GasPriceScheduler";
import { SwapStorage } from "../../src/service/storage/SwapStorage";
import {
    BridgeDirection,
    BridgeLockBoxStates,
    BridgeProcessStatus,
    BridgeType,
    IBridgeLockBoxInfo,
} from "../../src/service/types";
import { HardhatUtils } from "../../src/service/utils";
import { TestClient, TestSwapServer } from "../Utility";

// tslint:disable-next-line:no-implicit-dependencies
import { Signer } from "@ethersproject/abstract-signer";
import { NonceManager } from "@ethersproject/experimental";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Token Bridge Server", function () {
    this.timeout(1000 * 60 * 5);
    const user = new Wallet(process.env.USER_KEY || "");
    let user_signer: Signer;

    const client = new TestClient();

    let swap_storage: SwapStorage;
    let swap_server: TestSwapServer;
    let serverURL: URL;
    const config = new Config();
    let contract_manager: TokenBridgeContractManager;
    let ethnet_token: Token;
    let biznet_token: Token;
    const decimal = 10;

    before("Create TestSwapServer", async () => {
        config.readFromFile(path.resolve(process.cwd(), "config/config_test.yaml"));
        await config.decrypt();
        await HardhatUtils.deployBOABridgeForTest(config);
        await HardhatUtils.deployTokenBridgeForTest(config);
        serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
        swap_storage = await SwapStorage.make(config.database);
        swap_server = new TestSwapServer(config, swap_storage, [
            new CGCCoinPriceScheduler(10),
            new GasPriceScheduler(10),
            new BridgeScheduler(1),
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
        contract_manager = swap_server.token_bridge_contract_manager;
    });

    it("Test of TokenBridgeContractManager", async () => {
        assert.strictEqual(contract_manager.tokens.length, 2);
        assert.deepStrictEqual(contract_manager.getSourceToken(BridgeDirection.ETHNET_BIZNET, "non_exit"), null);
        assert.deepStrictEqual(contract_manager.getTargetToken(BridgeDirection.ETHNET_BIZNET, "non_exit"), null);
        assert.deepStrictEqual(
            contract_manager.getSourceToken(BridgeDirection.ETHNET_BIZNET, contract_manager.tokens[0].ethnet.token_id),
            contract_manager.tokens[0].ethnet
        );
        assert.deepStrictEqual(
            contract_manager.getTargetToken(BridgeDirection.ETHNET_BIZNET, contract_manager.tokens[0].biznet.token_id),
            contract_manager.tokens[0].biznet
        );
        assert.deepStrictEqual(
            contract_manager.getSourceTokenPair(
                BridgeDirection.ETHNET_BIZNET,
                contract_manager.tokens[1].ethnet.token_id
            ),
            contract_manager.tokens[1]
        );
        assert.deepStrictEqual(
            contract_manager.getTargetTokenPair(
                BridgeDirection.ETHNET_BIZNET,
                contract_manager.tokens[1].biznet.token_id
            ),
            contract_manager.tokens[1]
        );
    });

    function checker(box_id: string, expected: any, timeout: number = 600, interval: number = 200): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const start = ContractUtils.getTimeStamp();
            const check = () => {
                client.get(URI(serverURL).directory("bridge/swap").filename(box_id).toString()).then((response) => {
                    let matched = true;
                    if (response.data && response.data.data) {
                        for (const key in expected) {
                            if (expected.hasOwnProperty(key)) {
                                if (expected[key] !== response.data.data[key]) {
                                    matched = false;
                                    break;
                                }
                            }
                        }
                    } else {
                        matched = false;
                    }

                    if (matched) return resolve();
                    else {
                        const now = ContractUtils.getTimeStamp();
                        if (now - start < timeout) setTimeout(check, interval);
                        else reject(new Error("A timeout occurred."));
                    }
                });
            };
            check();
        });
    }

    context("Swap from Ethnet to Biznet", () => {
        let secret_lock: string;
        let secret_key: string;
        let box_id: string;

        let balance_ethnet: BigNumber;
        let balance_biznet: BigNumber;

        const swap_amount = Amount.make(1000, decimal);
        let swap_fee: Amount;
        let tx_fee: Amount;
        let gas_price: number;
        let eth_boa_rate: number;

        before("Create Signer of User", () => {
            user_signer = new NonceManager(
                new GasPriceManager(contract_manager.provider_ethnet.getSigner(user.address))
            );
            ethnet_token = contract_manager.tokens[0].ethnet;
            biznet_token = contract_manager.tokens[0].biznet;
        });

        it("Check balance", async () => {
            balance_ethnet = await ethnet_token.token.balanceOf(user.address);
            balance_biznet = await biznet_token.token.balanceOf(user.address);
        });

        it("Create secret key", () => {
            const key_buffer = ContractUtils.createKey();
            const lock_buffer = ContractUtils.sha256(key_buffer);
            secret_key = ContractUtils.BufferToString(key_buffer);
            secret_lock = ContractUtils.BufferToString(lock_buffer);
            box_id = ContractUtils.BufferToString(ContractUtils.createLockBoxID());
        });

        it("Get GasPrice & ETH/BOA Rate", async () => {
            let gp: number | null = null;
            let rate: number | null = null;
            let tf: Amount | null = null;

            await (() => {
                return new Promise<void>((resolve, reject) => {
                    const doWork = async () => {
                        gp = await swap_storage.getStandardGasPrice();
                        rate = await swap_storage.getEthBoaRate();
                        if (gp && rate)
                            tf = contract_manager.getEstimatedTxFee(
                                gp,
                                rate,
                                BridgeDirection.ETHNET_BIZNET,
                                BOACoin.DECIMAL
                            );

                        if (gp && rate && tf) {
                            gas_price = gp;
                            eth_boa_rate = rate;
                            tx_fee = tf;
                            return resolve();
                        } else {
                            setTimeout(doWork, 1000);
                        }
                    };
                    doWork();
                });
            })();

            swap_fee = contract_manager.getSwapFee(swap_amount.value, BOACoin.DECIMAL);
        });

        it("Approve", async () => {
            const allowance_amount = await ethnet_token.token.allowance(
                user.address,
                contract_manager.bridge_ethnet.address
            );
            if (allowance_amount.lt(swap_amount.value)) {
                await ethnet_token.token
                    .connect(user_signer)
                    .approve(contract_manager.bridge_ethnet.address, swap_amount.value);
                assert.ok(
                    await ContractUtils.waitingForAllowance(
                        ethnet_token.token,
                        user.address,
                        contract_manager.bridge_ethnet.address,
                        swap_amount.value
                    ),
                    "Error of boa_ethnet's approve"
                );
            } else {
                console.log("Already approved : " + allowance_amount.toString());
            }
        });

        let deposit_lock_box_res: IBridgeLockBoxInfo;
        let tx_hash = "";
        it("Create deposit lock box", async () => {
            const tx = await contract_manager.bridge_ethnet
                .connect(user_signer)
                .openDeposit(ethnet_token.token_id, box_id, swap_amount.value, user.address, secret_lock, {
                    from: user.address,
                    value: tx_fee.value,
                });
            tx_hash = tx.hash;
            deposit_lock_box_res = await ContractUtils.waitingForTokenBridgeOpeningDeposit(
                contract_manager.bridge_ethnet.connect(user_signer),
                box_id
            );
            assert.strictEqual(deposit_lock_box_res.id, box_id);
            assert.strictEqual(deposit_lock_box_res.state, 1);
            assert.strictEqual(deposit_lock_box_res.secret_lock, secret_lock);
            assert.strictEqual(deposit_lock_box_res.amount.toString(), swap_amount.toString());
        });

        it("Send information of deposit lock box to server", async () => {
            const uri = URI(serverURL).directory("bridge/").filename("deposit");
            const url = uri.toString();
            const response = await client.post(url, {
                id: box_id,
                type: BridgeType.TOKEN,
                state: 1,
                trader_address: user.address.toString(),
                withdraw_address: user.address.toString(),
                amount: swap_amount.toString(),
                swap_fee: swap_fee.toString(),
                tx_fee: tx_fee.toString(),
                tx_hash,
                direction: BridgeDirection.ETHNET_BIZNET,
                secret_lock: deposit_lock_box_res.secret_lock,
                time_lock: deposit_lock_box_res.time_lock,
                create_time: deposit_lock_box_res.create_time,
            });
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                },
            });
        });

        it("Get information of lock box", async () => {
            let uri = URI(serverURL)
                .directory("bridge/swap")
                .filename(ContractUtils.BufferToString(ContractUtils.createLockBoxID()));
            let url = uri.toString();
            let response = await client.get(url);
            assert.deepStrictEqual(response.data, {
                status: 204,
                error: {
                    message: "Record does not exist.",
                },
            });

            uri = URI(serverURL).directory("bridge/swap").filename(box_id);
            url = uri.toString();
            response = await client.get(url);
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                    type: BridgeType.TOKEN,
                    trader_address: user.address.toString(),
                    withdraw_address: user.address.toString(),
                    amount: swap_amount.toString(),
                    swap_fee: swap_fee.toString(),
                    tx_fee: tx_fee.toString(),
                    direction: BridgeDirection.ETHNET_BIZNET,
                    secret_lock: deposit_lock_box_res.secret_lock,
                    deposit_state: 0,
                    deposit_token_id: "",
                    deposit_time_lock: 0,
                    deposit_create_time: 0,
                    deposit_tx_hash: tx_hash,
                    withdraw_state: 0,
                    withdraw_token_id: "",
                    withdraw_time_lock: 0,
                    withdraw_create_time: 0,
                    withdraw_tx_hash: "",
                    withdraw_time_diff: 0,
                    process_status: 0,
                },
            });
        });

        it("Get information of lock box [CONFIRMED_OPENING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, {
                    process_status: BridgeProcessStatus.CONFIRMED_OPENING_DEPOSIT,
                    deposit_state: BridgeLockBoxStates.OPEN,
                    deposit_time_lock: 86400 * 2,
                })
            );
        });

        it("Get information of lock box [FINISHED_OPENING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_OPENING_WITHDRAW })
            );
        });

        it("Get information of lock box [CONFIRMED_OPENING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_OPENING_WITHDRAW })
            );
        });

        it("Close withdraw box", async () => {
            const uri = URI(serverURL).directory("bridge/").filename("close");
            const url = uri.toString();
            const response = await client.post(url, {
                id: box_id,
                key: secret_key,
            });
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                },
            });
        });

        it("Get information of lock box [FINISHED_CLOSING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_CLOSING_WITHDRAW })
            );
        });

        it("Get information of lock box [CONFIRMED_CLOSING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW })
            );
        });

        it("Get information of lock box [FINISHED_CLOSING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_CLOSING_DEPOSIT })
            );
        });

        it("Get information of lock box [CONFIRMED_CLOSING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_CLOSING_DEPOSIT })
            );
        });

        it("Check balance", async () => {
            const new_balance_ethnet = await ethnet_token.token.balanceOf(user.address);
            const new_balance_biznet = await biznet_token.token.balanceOf(user.address);

            assert.strictEqual(new_balance_ethnet.toString(), balance_ethnet.sub(swap_amount.value).toString());
            assert.strictEqual(new_balance_biznet.toString(), balance_biznet.add(swap_amount.value).toString());
        });
    });

    context("Swap from Biznet to Ethnet", () => {
        let secret_lock: string;
        let secret_key: string;
        let box_id: string;

        let balance_ethnet: BigNumber;
        let balance_biznet: BigNumber;

        const swap_amount = Amount.make(1000, decimal);
        let swap_fee: Amount;
        let tx_fee: Amount;
        let gas_price: number;
        let eth_boa_rate: number;

        before("Create Signer of User", () => {
            user_signer = new NonceManager(
                new GasPriceManager(contract_manager.provider_biznet.getSigner(user.address))
            );
            ethnet_token = contract_manager.tokens[0].ethnet;
            biznet_token = contract_manager.tokens[0].biznet;
        });

        it("Check balance", async () => {
            balance_ethnet = await ethnet_token.token.balanceOf(user.address);
            balance_biznet = await biznet_token.token.balanceOf(user.address);
        });

        it("Create secret key", () => {
            const key_buffer = ContractUtils.createKey();
            const lock_buffer = ContractUtils.sha256(key_buffer);
            secret_key = ContractUtils.BufferToString(key_buffer);
            secret_lock = ContractUtils.BufferToString(lock_buffer);
            box_id = ContractUtils.BufferToString(ContractUtils.createLockBoxID());
        });

        it("Get GasPrice & ETH/BOA Rate", async () => {
            let gp: number | null = null;
            let rate: number | null = null;
            let tf: Amount | null = null;

            await (() => {
                return new Promise<void>((resolve, reject) => {
                    const doWork = async () => {
                        gp = await swap_storage.getStandardGasPrice();
                        rate = await swap_storage.getEthBoaRate();
                        if (gp && rate)
                            tf = contract_manager.getEstimatedTxFee(
                                gp,
                                rate,
                                BridgeDirection.BIZNET_ETHNET,
                                BOACoin.DECIMAL
                            );

                        if (gp && rate && tf) {
                            gas_price = gp;
                            eth_boa_rate = rate;
                            tx_fee = tf;
                            return resolve();
                        } else {
                            setTimeout(doWork, 1000);
                        }
                    };
                    doWork();
                });
            })();

            swap_fee = contract_manager.getSwapFee(swap_amount.value, BOACoin.DECIMAL);
        });

        it("Approve", async () => {
            const allowance_amount = await biznet_token.token.allowance(
                user.address,
                contract_manager.bridge_biznet.address
            );
            if (allowance_amount.lt(swap_amount.value)) {
                await biznet_token.token
                    .connect(user_signer)
                    .approve(contract_manager.bridge_biznet.address, swap_amount.value);
                assert.ok(
                    await ContractUtils.waitingForAllowance(
                        biznet_token.token,
                        user.address,
                        contract_manager.bridge_biznet.address,
                        swap_amount.value
                    ),
                    "Error of boa_ethnet's approve"
                );
            } else {
                console.log("Already approved : " + allowance_amount.toString());
            }
        });

        let deposit_lock_box_res: IBridgeLockBoxInfo;
        let tx_hash = "";
        it("Create deposit lock box", async () => {
            const tx = await contract_manager.bridge_biznet
                .connect(user_signer)
                .openDeposit(biznet_token.token_id, box_id, swap_amount.value, user.address, secret_lock, {
                    from: user.address,
                    value: tx_fee.value,
                });
            tx_hash = tx.hash;
            deposit_lock_box_res = await ContractUtils.waitingForTokenBridgeOpeningDeposit(
                contract_manager.bridge_biznet.connect(user_signer),
                box_id
            );
            assert.strictEqual(deposit_lock_box_res.id, box_id);
            assert.strictEqual(deposit_lock_box_res.state, 1);
            assert.strictEqual(deposit_lock_box_res.secret_lock, secret_lock);
            assert.strictEqual(deposit_lock_box_res.amount.toString(), swap_amount.toString());
        });

        it("Send information of deposit lock box to server", async () => {
            const uri = URI(serverURL).directory("bridge/").filename("deposit");
            const url = uri.toString();
            const response = await client.post(url, {
                id: box_id,
                type: BridgeType.TOKEN,
                state: 1,
                trader_address: user.address.toString(),
                withdraw_address: user.address.toString(),
                amount: swap_amount.toString(),
                swap_fee: swap_fee.toString(),
                tx_fee: tx_fee.toString(),
                tx_hash,
                direction: BridgeDirection.BIZNET_ETHNET,
                secret_lock: deposit_lock_box_res.secret_lock,
                time_lock: deposit_lock_box_res.time_lock,
                create_time: deposit_lock_box_res.create_time,
            });
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                },
            });
        });

        it("Get information of lock box", async () => {
            const uri = URI(serverURL).directory("/bridge/swap").filename(box_id);
            const url = uri.toString();
            const response = await client.get(url);
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                    type: BridgeType.TOKEN,
                    trader_address: user.address.toString(),
                    withdraw_address: user.address.toString(),
                    amount: swap_amount.toString(),
                    swap_fee: swap_fee.toString(),
                    tx_fee: tx_fee.toString(),
                    direction: BridgeDirection.BIZNET_ETHNET,
                    secret_lock: deposit_lock_box_res.secret_lock,
                    deposit_state: 0,
                    deposit_token_id: "",
                    deposit_time_lock: 0,
                    deposit_create_time: 0,
                    deposit_tx_hash: tx_hash,
                    withdraw_state: 0,
                    withdraw_token_id: "",
                    withdraw_time_lock: 0,
                    withdraw_create_time: 0,
                    withdraw_tx_hash: "",
                    withdraw_time_diff: 0,
                    process_status: 0,
                },
            });
        });

        it("Get information of lock box [CONFIRMED_OPENING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, {
                    process_status: BridgeProcessStatus.CONFIRMED_OPENING_DEPOSIT,
                    deposit_state: BridgeLockBoxStates.OPEN,
                    deposit_time_lock: 86400 * 2,
                })
            );
        });

        it("Get information of lock box [FINISHED_OPENING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_OPENING_WITHDRAW })
            );
        });

        it("Get information of lock box [CONFIRMED_OPENING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_OPENING_WITHDRAW })
            );
        });

        it("Close withdraw box", async () => {
            const uri = URI(serverURL).directory("bridge/").filename("close");
            const url = uri.toString();
            const response = await client.post(url, {
                id: box_id,
                key: secret_key,
            });
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                },
            });
        });

        it("Get information of lock box [CONFIRMED_CLOSING_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_CLOSING_WITHDRAW })
            );
        });

        it("Get information of lock box [FINISHED_CLOSING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_CLOSING_DEPOSIT })
            );
        });

        it("Get information of lock box [CONFIRMED_CLOSING_DEPOSIT]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_CLOSING_DEPOSIT })
            );
        });

        it("Check balance", async () => {
            const new_balance_ethnet = await ethnet_token.token.balanceOf(user.address);
            const new_balance_biznet = await biznet_token.token.balanceOf(user.address);

            assert.strictEqual(new_balance_ethnet.toString(), balance_ethnet.add(swap_amount.value).toString());
            assert.strictEqual(new_balance_biznet.toString(), balance_biznet.sub(swap_amount.value).toString());
        });
    });
});
