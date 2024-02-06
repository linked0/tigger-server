/**
 *  These are the custom validation functions required to validate
 *  the data transmitted to the server.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { Utils } from "../../modules/utils/Utils";

import { BigNumber } from "ethers";

/**
 * These are the custom validation functions required to validate
 * the data transmitted to the server.
 */
export class Validation {
    /**
     * Check if it's an amount
     * @param value The string representing the amount.
     */
    public static isAmount(value: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (!Utils.isPositiveInteger(value)) {
                return reject(new Error("Invalid value"));
            }
            try {
                BigNumber.from(value);
            } catch (e) {
                return reject(new Error("Invalid value"));
            }
            return resolve(value);
        });
    }
}
