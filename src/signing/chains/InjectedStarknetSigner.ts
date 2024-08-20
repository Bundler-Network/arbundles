import { Account, RpcProvider, Signature, WeierstrassSignatureType, ec, encode, typedData, Signer as StarknetSigner } from "starknet";
import type { Signer } from "../index";
import { SignatureConfig, SIG_CONFIG } from "../../constants";
import { get_domain } from "./StarknetSigner";

export default class InjectedStarknetSigner implements Signer {
  protected signer: Account;
  public  publicKey: Buffer;
  public static address: string;
  private static privateKey: string;
  public static provider: RpcProvider;
  public static chainId: string;
  readonly ownerLength: number = SIG_CONFIG[SignatureConfig.STARKNET].pubLength;
  readonly signatureLength: number = SIG_CONFIG[SignatureConfig.STARKNET].sigLength;
  readonly signatureType: number = SignatureConfig.STARKNET;

  // Constructor to set static properties
  constructor(provider: RpcProvider, address: string, pKey: string) {
    InjectedStarknetSigner.provider = provider;
    InjectedStarknetSigner.address = address;
    InjectedStarknetSigner.privateKey = pKey;
    this.signer = new Account(provider, address, pKey);
  }

  public  async init() {
    try {
      const signer = new StarknetSigner(InjectedStarknetSigner.privateKey);
      const pub_key = await signer.getPubKey();
      console.log({pub_key: pub_key, sliced_pub: pub_key.slice(2), priv_key: InjectedStarknetSigner.privateKey})
      let hexKey = pub_key.startsWith("0x") ? pub_key.slice(2) : pub_key;
      this.publicKey = Buffer.from(0+hexKey, "hex");
      InjectedStarknetSigner.chainId = await InjectedStarknetSigner.provider.getChainId();
    } catch (error) {
      console.error("Error setting public key or chain ID:", error);
    }
  }

 

  async sign(message: Uint8Array, _opts?: any): Promise<Uint8Array> {
    if (!this.signer.signMessage) throw new Error("Selected signer does not support message signing");

    let message_to_string = convertToFelt252(message);
    let TypedDataMessage = get_domain({ chainId: InjectedStarknetSigner.chainId, message: message_to_string });
    let signature: Signature = (await this.signer.signMessage(TypedDataMessage.typemessage)) as WeierstrassSignatureType;
    
    const r = BigInt(signature.r).toString(16).padStart(64, "0");
    const s = BigInt(signature.s).toString(16).padStart(64, "0");
    // @ts-ignore
    const recovery = signature.recovery.toString(16).padStart(2, "0");

    const rArray = Uint8Array.from(Buffer.from(r, "hex"));
    const sArray = Uint8Array.from(Buffer.from(s, "hex"));
    const recoveryArray = Uint8Array.from(Buffer.from(recovery, "hex"));

    const result = new Uint8Array(rArray.length + sArray.length + recoveryArray.length);
    result.set(rArray);
    result.set(sArray, rArray.length);
    result.set(recoveryArray, rArray.length + sArray.length);

    return result;
  }

  static async verify(_pk: Buffer, message: Uint8Array, _signature: Uint8Array, _opts?: any): Promise<boolean> {
    let message_to_string = convertToFelt252(message);
    let TypedDataMessage = get_domain({ chainId: InjectedStarknetSigner.chainId, message: message_to_string });

    const fullPubKey = encode.addHexPrefix(encode.buf2hex(ec.starkCurve.getPublicKey(InjectedStarknetSigner.privateKey, true)));

    const msgHash = typedData.getMessageHash(TypedDataMessage.typemessage, InjectedStarknetSigner.address);

    return ec.starkCurve.verify(_signature.slice(0,-1), msgHash, fullPubKey);
  }
}

// Utility function to convert Uint8Array to felt252
function convertToFelt252(data: Uint8Array): bigint[] {
  const felt252Array: bigint[] = [];
  const felt252Size = 31;

  for (let i = 0; i < data.length; i += felt252Size) {
    let value = BigInt(0);
    for (let j = 0; j < felt252Size && i + j < data.length; j++) {
      value = (value << BigInt(8)) | BigInt(data[i + j]);
    }
    felt252Array.push(value);
  }

  return felt252Array;
}

