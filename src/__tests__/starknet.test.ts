jest.setTimeout(20000);
import StarknetSigner from "../signing/chains/StarknetSigner";
import { RpcProvider } from "starknet";
import Crypto from "crypto";
import { createData } from "../../index";

const tagsTestVariations = [
  { description: "no tags", tags: undefined },
  { description: "empty tags", tags: [] },
  { description: "single tag", tags: [{ name: "Content-Type", value: "image/png" }] },
  {
    description: "multiple tags",
    tags: [
      { name: "Content-Type", value: "image/png" },
      { name: "hello", value: "world" },
      { name: "lorem", value: "ipsum" },
    ],
  },
];

const dataTestVariations = [
  { description: "empty string", data: "" },
  { description: "small string", data: "hello world" },
  { description: "large string", data: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{};':\",./<>?`~" },
  { description: "empty buffer", data: Buffer.from([]) },
  { description: "small buffer", data: Buffer.from("hello world") },
  { description: "large buffer", data: Buffer.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{};':\",./<>?`~") },
];

describe("Typed Starknet Signer", () => {
  let signer: StarknetSigner;
  const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.public.blastapi.io" });

  const PrivateKey = "0x0570d0ab0e4bd9735277e8db6c8e19918c64ed50423aa5860235635d2487c7bb";
  const myAddressInStarknet = "0x078e47BBEB4Dc687741825d7bEAD044e229960D3362C0C21F45Bb920db08B0c4";

  beforeAll(async () => {
    signer = new StarknetSigner(provider, myAddressInStarknet, PrivateKey);
  });

  it("should sign a known value", async () => {
    const data = Buffer.from("Hello-world!");
    const expectedSignature = Buffer.from([
      1, 114, 235,  23,  11, 129, 235,  41, 193,  99,  37, 195,
      7,  92, 120, 196, 216,  86, 170, 132,  45,  38, 234, 192,
     92, 108,  83, 180, 250,  64,  95,   2,   0, 119, 220,  61,
    212, 202, 154, 141, 140, 112,  99, 169, 204,   5, 232,   4,
    203, 246,   9,  70, 254,  36, 150, 193,  72,   0,  15,  25,
    127,  59, 138, 239,   1
  ])

    const signature = await signer.sign(data);
    const signatureBuffer = Buffer.from(signature);
    expect(signatureBuffer).toEqual(expectedSignature);
  });

  it("should verify a known values", async () => {
    const data = Buffer.from("Hello-world!");
    const signature = await signer.sign(data);
    const isValid = await StarknetSigner.verify(signer.publicKey, data, signature);
    expect(isValid).toEqual(true);
  });
  it("should sign & verify an unknown value", async () => {
    const randData = Crypto.randomBytes(256);
    const signature = await signer.sign(randData);
    const isValid = await StarknetSigner.verify(signer.publicKey, randData, signature);
    expect(isValid).toEqual(true);
  });
  describe("Create & Validate DataItem", () => {
    it("should create a valid dataItem", async () => {
      const data = "Hello, Bundlr!";
      const tags = [{ name: "Hello", value: "Bundlr" }];
      const item = createData(data, signer, { tags });
      await item.sign(signer);
      expect(await item.isValid()).toBe(true);
    });

    describe("With an unknown wallet", () => {
      it("should sign & verify an unknown value", async () => {
        const randSigner = new StarknetSigner(provider, myAddressInStarknet, PrivateKey);
        const randData = Crypto.randomBytes(256);
        const signature = await randSigner.sign(randData);
        const isValid = await StarknetSigner.verify(signer.publicKey, randData, signature);
        expect(isValid).toEqual(true);
      });
    });

    describe("and given we want to create a dataItem", () => {
      describe.each(tagsTestVariations)("with $description tags", ({ tags }) => {
        describe.each(dataTestVariations)("and with $description data", ({ data }) => {
          it("should create a valid dataItem", async () => {
            const item = createData(data, signer, { tags });
            await item.sign(signer);
            expect(await item.isValid()).toBe(true);
          });
          it("should set the correct tags", async () => {
            const item = createData(data, signer, { tags });
            await item.sign(signer);
            expect(item.tags).toEqual(tags ?? []);
          });
          it("should set the correct data", async () => {
            const item = createData(data, signer, { tags });
            await item.sign(signer);
            expect(item.rawData).toEqual(Buffer.from(data));
          });
        });
      });
    });
  });
});
