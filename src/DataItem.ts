import { byteArrayToLong } from "./utils";
import base64url from "base64url";
import { Buffer } from "buffer";
import { sign } from "./ar-data-bundle";
import type { BundleItem } from "./BundleItem";
import type { Signer } from "./signing/index";
import { indexToType } from "./signing/index";
import getSignatureData from "./ar-data-base";
import { SIG_CONFIG, SignatureConfig } from "./constants";
import { getCryptoDriver } from "$/utils";
import { deserializeTags } from "./tags";
import { createHash } from "crypto";
import type { Base64URLString } from "./types";

export const MIN_BINARY_SIZE = 80;
export const MAX_TAG_BYTES = 4096;

export class DataItem implements BundleItem {
  private readonly binary: Buffer;
  private _id: Buffer;

  constructor(binary: Buffer) {
    this.binary = binary;
  }

  static isDataItem(obj: any): obj is DataItem {
    return obj.binary !== undefined;
  }

  get signatureType(): SignatureConfig {
    const signatureTypeVal: number = byteArrayToLong(this.binary.subarray(0, 2));
    if (SignatureConfig?.[signatureTypeVal] !== undefined) {
      return signatureTypeVal;
    }
    throw new Error("Unknown signature type: " + signatureTypeVal);
  }

  async isValid(): Promise<boolean> {
    return DataItem.verify(this.binary);
  }

  get id(): Base64URLString {
    return base64url.encode(this.rawId);
  }

  set id(id: string) {
    this._id = base64url.toBuffer(id);
  }

  get rawId(): Buffer {
    return createHash("sha256").update(this.rawSignature).digest();
  }

  set rawId(id: Buffer) {
    this._id = id;
  }

  get rawSignature(): Buffer {
    return this.binary.subarray(2, 2 + this.signatureLength);
  }

  get signature(): Base64URLString {
    return base64url.encode(this.rawSignature);
  }

  set rawOwner(pubkey: Buffer) {
    if (pubkey.byteLength != this.ownerLength)
      throw new Error(`Expected raw owner (pubkey) to be ${this.ownerLength} bytes, got ${pubkey.byteLength} bytes.`);
    this.binary.set(pubkey, 2 + this.signatureLength);
  }

  get rawOwner(): Buffer {
    return this.binary.subarray(2 + this.signatureLength, 2 + this.signatureLength + this.ownerLength);
  }

  get signatureLength(): number {
    return SIG_CONFIG[this.signatureType].sigLength;
  }

  get owner(): Base64URLString {
    return base64url.encode(this.rawOwner);
  }

  get ownerLength(): number {
    return SIG_CONFIG[this.signatureType].pubLength;
  }

  get rawTarget(): Buffer {
    const targetStart = this.getTargetStart();
    const isPresent = this.binary[targetStart] == 1;
    return isPresent ? this.binary.subarray(targetStart + 1, targetStart + 33) : Buffer.alloc(0);
  }

  get target(): Base64URLString {
    return base64url.encode(this.rawTarget);
  }

  get rawAnchor(): Buffer {
    const anchorStart = this.getAnchorStart();
    const isPresent = this.binary[anchorStart] == 1;

    return isPresent ? this.binary.subarray(anchorStart + 1, anchorStart + 33) : Buffer.alloc(0);
  }

  get anchor(): Base64URLString {
    return base64url.encode(this.rawAnchor); /* .toString(); */
  }

  get rawTags(): Buffer {
    const tagsStart = this.getTagsStart();
    const tagsSize = byteArrayToLong(this.binary.subarray(tagsStart + 8, tagsStart + 16));
    return this.binary.subarray(tagsStart + 16, tagsStart + 16 + tagsSize);
  }

  get tags(): { name: string; value: string }[] {
    const tagsStart = this.getTagsStart();
    const tagsCount = byteArrayToLong(this.binary.subarray(tagsStart, tagsStart + 8));
    if (tagsCount == 0) {
      return [];
    }

    const tagsSize = byteArrayToLong(this.binary.subarray(tagsStart + 8, tagsStart + 16));

    return deserializeTags(Buffer.from(this.binary.subarray(tagsStart + 16, tagsStart + 16 + tagsSize)));
  }

  get tagsB64Url(): { name: Base64URLString; value: Base64URLString }[] {
    const _tags = this.tags;
    return _tags.map((t) => ({
      name: base64url.encode(t.name),
      value: base64url.encode(t.value),
    }));
  }

  getStartOfData(): number {
    const tagsStart = this.getTagsStart();

    const numberOfTagBytesArray = this.binary.subarray(tagsStart + 8, tagsStart + 16);
    const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);
    return tagsStart + 16 + numberOfTagBytes;
  }

  get rawData(): Buffer {
    const tagsStart = this.getTagsStart();

    const numberOfTagBytesArray = this.binary.subarray(tagsStart + 8, tagsStart + 16);
    const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);
    const dataStart = tagsStart + 16 + numberOfTagBytes;

    return this.binary.subarray(dataStart, this.binary.length);
  }

  get data(): Base64URLString {
    return base64url.encode(this.rawData);
  }

  /**
   * UNSAFE!!
   * DO NOT MUTATE THE BINARY ARRAY. THIS WILL CAUSE UNDEFINED BEHAVIOUR.
   */
  getRaw(): Buffer {
    return this.binary;
  }

  public async sign(signer: Signer): Promise<Buffer> {
    this._id = await sign(this, signer);
    return this.rawId;
  }

  public async setSignature(signature: Buffer): Promise<void> {
    this.binary.set(signature, 2);
    this._id = Buffer.from(await getCryptoDriver().hash(signature));
  }

  public isSigned(): boolean {
    return (this._id?.length ?? 0) > 0;
  }

  /**
   * Returns a JSON representation of a DataItem
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public toJSON(): {
    owner: string;
    data: string;
    signature: string;
    target: string;
    tags: { name: Base64URLString; value: Base64URLString }[];
  } {
    return {
      signature: this.signature,
      owner: this.owner,
      target: this.target,
      tags: this.tags.map((t) => ({
        name: base64url.encode(t.name),
        value: base64url.encode(t.value),
      })),
      data: this.data,
    };
  }

  /**
   * Verifies a `Buffer` and checks it fits the format of a DataItem
   *
   * A binary is valid iff:
   * - the tags are encoded correctly
   */
  static async verify(buffer: Buffer): Promise<boolean> {
    if (buffer.byteLength < MIN_BINARY_SIZE) {
      return false;
    }
    const item = new DataItem(buffer);
    const sigType = item.signatureType;
    const tagsStart = item.getTagsStart();

    const numberOfTags = byteArrayToLong(buffer.subarray(tagsStart, tagsStart + 8));
    const numberOfTagBytesArray = buffer.subarray(tagsStart + 8, tagsStart + 16);
    const numberOfTagBytes = byteArrayToLong(numberOfTagBytesArray);

    if (numberOfTagBytes > MAX_TAG_BYTES) return false;

    if (numberOfTags > 0) {
      try {
        const tags: { name: string; value: string }[] = deserializeTags(
          Buffer.from(buffer.subarray(tagsStart + 16, tagsStart + 16 + numberOfTagBytes)),
        );
        if (tags.length !== numberOfTags) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const Signer = indexToType[sigType];

    const signatureData = await getSignatureData(item);
    return await Signer.verify(item.rawOwner, signatureData, item.rawSignature);
  }

  public async getSignatureData(): Promise<Uint8Array> {
    return getSignatureData(this);
  }

  /**
   * Returns the start byte of the tags section (number of tags)
   *
   * @private
   */
  private getTagsStart(): number {
    const targetStart = this.getTargetStart();
    const targetPresent = this.binary[targetStart] == 1;
    let tagsStart = targetStart + (targetPresent ? 33 : 1);
    const anchorPresent = this.binary[tagsStart] == 1;
    tagsStart += anchorPresent ? 33 : 1;

    return tagsStart;
  }

  /**
   * Returns the start byte of the tags section (number of tags)
   *
   * @private
   */
  private getTargetStart(): number {
    return 2 + this.signatureLength + this.ownerLength;
  }

  /**
   * Returns the start byte of the tags section (number of tags)
   *
   * @private
   */
  private getAnchorStart(): number {
    let anchorStart = this.getTargetStart() + 1;
    const targetPresent = this.binary[this.getTargetStart()] == 1;
    anchorStart += targetPresent ? 32 : 0;

    return anchorStart;
  }
}
export default DataItem;
