import {Signer as StarknetSigner, ec} from "starknet"
import type {Signer} from "../index"
import {SignatureConfig, SIG_CONFIG} from "../../constants"

export default class InjectedStarknetSigner implements Signer{
    protected signer: StarknetSigner;
    public publicKey: Buffer;
    public address:string;
    readonly ownerLength: number = SIG_CONFIG[SignatureConfig.STARKNET].pubLength;
    readonly signatureLength: number = SIG_CONFIG[SignatureConfig.STARKNET].sigLength;
    readonly signatureType: number =  SignatureConfig.STARKNET


 sign(message: Uint8Array, _opts?: any): Uint8Array | Promise<Uint8Array> {
    
}

  
}