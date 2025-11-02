import { describe, expect, it } from "@jest/globals";
import { listSupportedChainsForProvider, resolveToken } from "./registry";

describe("token registry sanity", () => {
  it("does not advertise BNB Chain for Uniswap", () => {
    const chains = listSupportedChainsForProvider("uniswap");
    expect(chains).not.toContain(56);
  });

  it("fails to resolve BNB assets for Uniswap provider", () => {
    expect(() =>
      resolveToken("uniswap", 56, "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")
    ).toThrow();
  });

  it("still resolves BNB assets for Thirdweb", () => {
    expect(() =>
      resolveToken("thirdweb", 56, "0xBB4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c")
    ).not.toThrow();
  });
});
