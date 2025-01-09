import { Amount, BOACoin, BOAToken } from "../../src/service/common/Amount";
import { Config } from "../../src/service/common/Config";
import { BOABridgeContractManager } from "../../src/service/contract/BOABridgeContractManager";
import { ContractUtils } from "../../src/service/contract/ContractUtils";
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
import { delay, TestClient, TestSwapServer } from "../Utility";

import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";

import * as path from "path";
import { URL } from "url";

import * as assert from "assert";

// tslint:disable-next-line:no-var-requires
const URI = require("urijs");

chai.use(solidity);

describe("Test of Bridge Server", function () {
    this.timeout(1000 * 60 * 5);
    const user = new Wallet(process.env.USER_KEY || "");

    const client = new TestClient();
    let swap_storage: SwapStorage;
    let swap_server: TestSwapServer;
    let serverURL: URL;
    const config = new Config();
    let contract_manager: BOABridgeContractManager;

    let swap_amount: Amount;
    let swap_fee: Amount;
    let tx_fee: Amount;
    let gas_price: number;
    let eth_boa_rate: number;

    before("Create TestSwapServer", async () => {
        config.readFromFile(path.resolve(process.cwd(), "config/config_test.yaml"));
        await HardhatUtils.deployBOABridgeForTest(config);
        await HardhatUtils.deployTokenBridgeForTest(config);
        serverURL = new URL(`http://127.0.0.1:${config.server.port}`);
        swap_storage = await SwapStorage.make(config.database);
        swap_server = new TestSwapServer(config, swap_storage, [
            new CGCCoinPriceScheduler(1),
            new GasPriceScheduler(1),
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
        contract_manager = swap_server.bridge_contract_manager;
    });

    function checker(box_id: string, expected: any, timeout: number = 600, interval: number = 1000): Promise<void> {
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

    context("Expire Withdraw box", () => {
        let secret_lock: string;
        let secret_key: string;
        let box_id: string;
        swap_amount = BOAToken.make(10000);

        it("Change Time Lock", async () => {
            await contract_manager.bridge_ethnet.connect(contract_manager.manager_signer_ethnet).changeTimeLock(5);
            await contract_manager.bridge_biznet.connect(contract_manager.manager_signer_biznet).changeTimeLock(5);
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
                                BOAToken.DECIMAL
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

            swap_fee = contract_manager.getSwapFee(swap_amount.value, BOAToken.DECIMAL);
        });

        let deposit_lock_box_res: IBridgeLockBoxInfo;

        it("Approve", async () => {
            const allowance_amount = await contract_manager.boa_ethnet.allowance(
                user.address,
                contract_manager.bridge_ethnet.address
            );
            if (allowance_amount.lt(swap_amount.value)) {
                const user_signer = contract_manager.provider_ethnet.getSigner(user.address);
                await contract_manager.boa_ethnet
                    .connect(user_signer)
                    .approve(contract_manager.bridge_ethnet.address, swap_amount.value);
                assert.ok(
                    await ContractUtils.waitingForAllowance(
                        contract_manager.boa_ethnet,
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

        let tx_hash = "";
        it("Create deposit lock box", async () => {
            const user_signer = contract_manager.provider_ethnet.getSigner(user.address);
            const tx = await contract_manager.bridge_ethnet
                .connect(user_signer)
                .openDeposit(box_id, swap_amount.value, swap_fee.value, tx_fee.value, user.address, secret_lock);
            tx_hash = tx.hash;
            deposit_lock_box_res = await ContractUtils.waitingForBridgeOpeningDeposit(
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
                type: BridgeType.BOA,
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
            const uri = URI(serverURL).directory("bridge/swap").filename(box_id);
            const url = uri.toString();
            const response = await client.get(url);
            assert.deepStrictEqual(response.data, {
                status: 200,
                data: {
                    id: box_id,
                    type: BridgeType.BOA,
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

        it("Wait", async () => {
            await delay(3000);
        });

        it("Get information of lock box [FINISHED_EXPIRE_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.FINISHED_EXPIRE_WITHDRAW })
            );
        });

        it("Get information of lock box [CONFIRMED_EXPIRE_WITHDRAW]", () => {
            return assert.doesNotReject(
                checker(box_id, { process_status: BridgeProcessStatus.CONFIRMED_EXPIRE_WITHDRAW })
            );
        });
    });
});
