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

  const PrivateKey = "0x005d5c250b5c181684ae6d8ebfa0faeac3ad0c6f31a6c2f102a2fffddba00a05";
  const myAddressInStarknet = "0x02F659cf8CCE41168B8c0A8BedCE468E33BE1B7bd26E920266C025Dc0F8FBD1b";

  beforeAll(async () => {
    signer = new StarknetSigner(provider, myAddressInStarknet, PrivateKey);
    await signer.init();
  });

  it("should sign a known value", async () => {
    const data = Buffer.from("Hello-world!");
    const expectedSignature = Buffer.from([
      2, 154, 223, 194, 248, 201, 115, 24, 151, 209, 169, 144, 101, 125, 81, 118, 127, 193, 75, 181, 252, 203, 34, 209, 32, 188, 0, 51, 207, 153, 230,
      253, 2, 158, 118, 14, 24, 86, 192, 14, 32, 126, 155, 125, 147, 175, 89, 174, 56, 100, 178, 79, 171, 232, 78, 215, 3, 216, 2, 18, 30, 90, 14, 32,
      1,
    ]);

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
