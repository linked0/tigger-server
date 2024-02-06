import { Amount, BOACoin, BOAToken } from "../../src/service/common/Amount";
import { BOA } from "../../src/service/contract/ContractUtils";

import { BigNumber } from "ethers";

import assert from "assert";

describe("BOA", () => {
    it("Test of BOA()", () => {
        assert.deepStrictEqual(BOA("1").toString(), "10000000");
        assert.deepStrictEqual(BOA("100000000.1234567").toString(), "1000000001234567");
        assert.deepStrictEqual(BOA("100000000").toString(), "1000000000000000");
        assert.deepStrictEqual(BOA("100,000,000.1234567").toString(), "1000000001234567");
        assert.deepStrictEqual(BOA("100,000,000").toString(), "1000000000000000");
        assert.deepStrictEqual(BOA("100_000_000.1234567").toString(), "1000000001234567");
        assert.deepStrictEqual(BOA("100_000_000").toString(), "1000000000000000");
    });

    it("Test of Amount", () => {
        assert.deepStrictEqual(Amount.make("1", 0).toString(), "1");
        assert.deepStrictEqual(Amount.make("1", 1).toString(), "10");
        assert.deepStrictEqual(new Amount(BigNumber.from(1), 0).toString(), "1");
        assert.deepStrictEqual(new Amount(BigNumber.from(1), 1).toString(), "1");
    });

    it("Test of BOAToken", () => {
        assert.deepStrictEqual(BOAToken.make("1").toString(), "10000000");
        assert.deepStrictEqual(new BOAToken(BigNumber.from(1)).toString(), "1");
    });

    it("Test of BOACoin", () => {
        assert.deepStrictEqual(BOACoin.make("1").toString(), "1000000000000000000");
        assert.deepStrictEqual(new BOACoin(BigNumber.from(1)).toString(), "1");
        assert.deepStrictEqual(BOACoin.make("1").toBOAString(), "1.000000000000000000");
        assert.deepStrictEqual(BOACoin.make("10").toBOAString(), "10.000000000000000000");
        assert.deepStrictEqual(BOAToken.make("1").toBOAString(), "1.0000000");
        assert.deepStrictEqual(BOAToken.make("10").toBOAString(), "10.0000000");
    });

    it("Test of convert()", () => {
        assert.deepStrictEqual(BOAToken.make("1").convert(BOACoin.DECIMAL).toString(), BOACoin.make("1").toString());
        assert.deepStrictEqual(BOACoin.make("1").convert(BOAToken.DECIMAL).toString(), BOAToken.make("1").toString());
    });
});
