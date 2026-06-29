import { encodeGeohash } from "@/lib/geohash";

describe("encodeGeohash", () => {
  it("encodes known geohash reference points", () => {
    expect(encodeGeohash(42.6, -5.6, 5)).toBe("ezs42");
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
  });

  it("rejects invalid coordinates", () => {
    expect(() => encodeGeohash(91, 98.9853)).toThrow(RangeError);
    expect(() => encodeGeohash(18.7883, 181)).toThrow(RangeError);
  });
});
