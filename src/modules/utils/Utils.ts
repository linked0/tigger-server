/**
 *  Includes various useful functions
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import process from "process";

export class Utils {
    /**
     * Check whether the string is a integer.
     * @param value
     */
    public static isInteger(value: string): boolean {
        return /^[+-]?([0-9]+)$/.test(value);
    }

    /**
     * Check whether the string is a positive integer.
     * @param value
     */
    public static isPositiveInteger(value: string): boolean {
        return /^(\+)?([0-9]+)$/.test(value);
    }

    /**
     * Check whether the string is a negative integer.
     * @param value
     */
    public static isNegativeInteger(value: string): boolean {
        return /^-([0-9]+)$/.test(value);
    }

    /**
     * Check whether the string is a positive.
     * @param value
     */
    public static isPositive(value: string): boolean {
        return /^(\+)?[0-9]\d*(\.\d+)?$/.test(value);
    }

    /**
     * Check whether the string is a negative.
     * @param value
     */
    public static isNegative(value: string): boolean {
        return /^-?[0-9]\d*(\.\d+)?$/.test(value);
    }

    /**
     *  Gets the path to where the execution command was entered for this process.
     */
    public static getInitCWD(): string {
        // Get the working directory the user was in when the process was started,
        // as opposed to the `cwd` exposed by node which is the program's path.
        // Try to use `INIT_CWD` which is provided by npm, and fall back to
        // `PWD` otherwise.
        // See also: https://github.com/npm/cli/issues/2033
        if (process.env.INIT_CWD !== undefined) return process.env.INIT_CWD;
        if (process.env.PWD !== undefined) return process.env.PWD;
        return process.cwd();
    }

    /**
     * Attach "0x" to the hexadecimal string.
     * @param value The source hexadecimal string
     */
    public static attachPrefixHex(value: string): string {
        if (value.substring(0, 2).toLowerCase() === "0x") return value;
        else return "0x" + value;
    }

    /**
     * Detach "0x" from the hexadecimal string.
     * @param value The source hexadecimal string
     */
    public static detachPrefixHex(value: string): string {
        if (value.substring(0, 2).toLowerCase() === "0x") return value.substring(2);
        else return value;
    }
}

/**
 * A ArrayRange that goes through the numbers first, first + step, first + 2 * step, ..., up to and excluding end.
 */
export class ArrayRange {
    /**
     * The first value
     */
    private readonly first: number;

    /**
     * The last value
     */
    private readonly last: number;

    /**
     * The value to add to the current value at each iteration.
     */
    private readonly step: number;

    /**
     * Constructor
     * @param n The starting value.
     * @param p The value that serves as the stopping criterion.
     * This value is not included in the range.
     * @param q The value to add to the current value at each iteration.
     */
    constructor(n: number, p?: number, q?: number) {
        let begin = 0;
        let end = 0;
        let step = 1;
        if (p === undefined && q === undefined) {
            begin = 0;
            end = n;
            step = 1;
        } else if (p !== undefined && q === undefined) {
            begin = n;
            end = p;
            step = 1;
        } else if (p !== undefined && q !== undefined) {
            begin = n;
            end = p;
            step = q;
        }

        if (begin === end || step === 0) {
            this.first = begin;
            this.last = begin;
            this.step = 0;
            return;
        }

        if (begin < end && step > 0) {
            this.first = begin;
            this.last = end - 1;
            this.last -= (this.last - this.first) % step;
            this.step = step;
        } else if (begin > end && step < 0) {
            this.first = begin;
            this.last = end + 1;
            this.last += (this.first - this.last) % (0 - step);
            this.step = step;
        } else {
            this.first = begin;
            this.last = begin;
            this.step = 0;
        }
    }

    /**
     * Returns length
     */
    public get length(): number {
        if (this.step > 0) return 1 + (this.last - this.first) / this.step;
        if (this.step < 0) return 1 + (this.first - this.last) / (0 - this.step);
        return 0;
    }

    /**
     * Performs the specified action for each element in an array.
     * @param callback A function that accepts up to three arguments.
     * forEach calls the callback function one time for each element in the array.
     */
    public forEach(callback: (value: number, index: number) => void) {
        const length = this.length;
        for (let idx = 0, value = this.first; idx < length; idx++, value += this.step) callback(value, idx);
    }

    /**
     * Calls a defined callback function on each element of an array,
     * and returns an array that contains the results.
     * @param callback A function that accepts up to three arguments.
     * The map method calls the callback function one time for each element in the array.
     */
    public map<U>(callback: (value: number, index: number) => U): U[] {
        const array: U[] = [];
        const length = this.length;
        for (let idx = 0, value = this.first; idx < length; idx++, value += this.step) array.push(callback(value, idx));
        return array;
    }

    /**
     * Returns the elements of an array that meet the condition specified in a callback function.
     * @param callback A function that accepts up to three arguments.
     * The filter method calls the callback function one time for each element in the array.
     */
    public filter(callback: (value: number, index: number) => unknown): number[] {
        const array: number[] = [];
        const length = this.length;
        for (let idx = 0, value = this.first; idx < length; idx++, value += this.step)
            if (callback(value, idx)) array.push(value);
        return array;
    }

    /**
     * Calls the specified callback function for all the elements in an array.
     * The return value of the callback function is the accumulated result,
     * and is provided as an argument in the next call to the callback function.
     * @param callback A function that accepts up to four arguments.
     * The reduce method calls the callback function one time for each element in the array.
     * @param initialValue If initialValue is specified,
     * it is used as the initial value to start the accumulation.
     * The first call to the callback function provides this value as an argument instead of an array value.
     * @returns The accumulated value
     */
    public reduce<T>(
        callback: (previousValue: T, currentValue: number, currentIndex: number) => T,
        initialValue: T
    ): T {
        let accumulator = initialValue;
        const length = this.length;
        for (let idx = 0, value = this.first; idx < length; idx++, value += this.step)
            accumulator = callback(accumulator, value, idx);
        return accumulator;
    }
}

/**
 * Returns an ArrayRange of integers from 0 to n-1
 * @param begin The starting value.
 * @param end The value that serves as the stopping criterion.
 * This value is not included in the range.
 * @param step The value to add to the current value at each iteration.
 * @returns A ArrayRange that goes through the numbers begin, begin + step, begin + 2 * step, ..., up to and excluding end.
 */
export function iota(begin: number, end?: number, step?: number): ArrayRange {
    return new ArrayRange(begin, end, step);
}
