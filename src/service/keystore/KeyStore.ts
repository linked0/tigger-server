/**
 *
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import * as hre from "hardhat";

import fs from "fs";
import path from "path";
import { Utils } from "../../modules/utils/Utils";

// tslint:disable-next-line:no-var-requires
const prompt = require("prompt");

export class KeyStore {
    private name: string;
    private key: string;
    private isValid: boolean;

    constructor(name: string, key: string) {
        this.name = name;
        this.key = key;
        const reg_bytes64: RegExp = /^(0x)[0-9a-f]{64}$/i;
        if (reg_bytes64.test(key)) {
            this.isValid = true;
        } else {
            this.isValid = false;
        }
    }

    public async getPrivateKey(): Promise<string> {
        if (this.isValid) return this.key;
        else {
            const filename = path.resolve(Utils.getInitCWD(), this.key);
            if (!fs.existsSync(filename)) {
                throw new Error("Not found key file");
            }
            try {
                const data = JSON.parse(fs.readFileSync(path.resolve(Utils.getInitCWD(), this.key), "utf-8"));
                // @ts-ignore
                const account = hre.web3.eth.accounts.decrypt(data, await this.ip());
                this.key = account.privateKey;
                this.isValid = true;
                return this.key;
            } catch (err) {
                throw new Error("");
            }
        }
    }

    private ip(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const properties = [
                {
                    name: "Password of " + this.name,
                    hidden: true,
                },
            ];
            prompt.start();
            prompt.get(properties, (err: any, result: any) => {
                if (err) reject();
                resolve(result[properties[0].name]);
            });
        });
    }

    public get valid(): boolean {
        return this.isValid;
    }
}
