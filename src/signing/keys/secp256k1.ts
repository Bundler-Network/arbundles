import { Signer } from '../Signer';
import base64url from 'base64url';
import secp256k1 from 'secp256k1';
import { SIG_CONFIG } from '../../constants';

export default class Secp256k1 implements Signer {
  readonly ownerLength: number = SIG_CONFIG[3].pubLength;
  readonly signatureLength: number = SIG_CONFIG[3].sigLength;
  readonly signatureType: number = 3;
  public readonly pk: string;

  constructor(protected _key: string, pk: Buffer) {
    this.pk = pk.toString("hex");
  }

  public get publicKey(): Buffer {
    return Buffer.alloc(0);
  }

  public get key(): Uint8Array {
    return Buffer.from(this._key, 'hex');
  }

  static async verify(
    pk: string | Buffer,
    message: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    let p = pk;
    if (typeof pk === 'string') p = base64url.toBuffer(pk);
    let verified = false;
    try {
      verified = secp256k1.ecdsaVerify(signature, message.subarray(0, 32), p as Buffer);
      // eslint-disable-next-line no-empty
    } catch (e) {}
    return verified;
  }

  sign(message: Uint8Array): Uint8Array {
    return secp256k1.ecdsaSign(Buffer.from(message.subarray(0, 32)), Buffer.from(this.key)).signature;
  }
}

