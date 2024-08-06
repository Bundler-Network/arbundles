import { Account, Signature, WeierstrassSignatureType, ec,encode, typedData } from "starknet";
import type { Signer } from "../index";
import { SignatureConfig, SIG_CONFIG } from "../../constants";
import { getDomain } from "./StarknetSigner";


export default class InjectedStarknetSigner implements Signer {
    protected signer: Account;
    public publicKey: Buffer;
    public address: string;
    private privateKey:string;
    readonly ownerLength: number = SIG_CONFIG[SignatureConfig.STARKNET].pubLength;
    readonly signatureLength: number = SIG_CONFIG[SignatureConfig.STARKNET].sigLength;
    readonly signatureType: number = SignatureConfig.STARKNET;
    // set up account
    async sign(message: Uint8Array, _opts?: any): Promise<Uint8Array> {
        if (!this.signer.signMessage) throw new Error("Selected  does not support message signing");

        let chainId = await this.signer.getChainId();
        let TypedDataMessage = getDomain({ chainId, message });
        let signature: Signature = await this.signer.signMessage(TypedDataMessage.TypeMessage) as WeierstrassSignatureType;
        const r = BigInt(signature.r).toString(16).padStart(64, '0'); // Convert BigInt to hex string
        const s = BigInt(signature.s).toString(16).padStart(64, '0'); // Convert BigInt to hex string

        //    @ts-ignore
        const recovery = signature.recovery.toString(16).padStart(2, '0'); // Convert recovery to hex string

        const rArray = Uint8Array.from(Buffer.from(r, 'hex'));
        const sArray = Uint8Array.from(Buffer.from(s, 'hex'));
        const recoveryArray = Uint8Array.from(Buffer.from(recovery, 'hex'));

        // Concatenate the arrays
        const result = new Uint8Array(rArray.length + sArray.length + recoveryArray.length);
        result.set(rArray);
        result.set(sArray, rArray.length);
        result.set(recoveryArray, rArray.length + sArray.length);

        return result;
    }

     async verify(_pk: string | Buffer, message: Uint8Array, _signature: Uint8Array, _opts?: any): Promise<boolean> {
        if (!this.signer) throw new Error("Selected does not support message verification");
        let chainId = await this.signer.getChainId();
        let TypedDataMessage = getDomain({ chainId, message });
        const fullPubKey = encode.addHexPrefix( encode.buf2hex( ec.starkCurve.getPublicKey(this.privateKey, false)));
        const msgHash = typedData.getMessageHash(TypedDataMessage.TypeMessage, this.address);
        return ec.starkCurve.verify(_signature.slice(0, -1),msgHash, fullPubKey)

    }
}