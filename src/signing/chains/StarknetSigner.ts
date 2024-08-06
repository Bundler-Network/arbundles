import { TypedData, WeierstrassSignatureType} from "starknet"

interface Itype  {
    chainId: string | number,
    message:Uint8Array
    
    }
    
     export const getDomain = ({chainId, message}:Itype): { TypeMessage: TypedData } => {
      const TypeMessage = {
        domain: {name: "Arbundle",
          chainId: chainId ,
          version: "0.0.3"},
        types: {StarkNetDomain: [
            { name: "name", type: "string" },
            { name: "chainId", type: "felt" },
            { name: "version", type: "string" }],
          Message: [{ name: "message", type: "felt" }]},
        primaryType: "Message", message: {message: message}};
        return {
          TypeMessage
        }
    }

    // convert Uint8Array => WeierstrassSignatureType
    function parseSignature(data: Uint8Array): WeierstrassSignatureType {
        // Define the length of each component in bytes
        const rLength = 32; // Length of r in bytes
        const sLength = 32; // Length of s in bytes
        const recoveryLength = 1; // Length of recovery in bytes
    
        // Extract each component
        const rArray = data.slice(0, rLength);
        const sArray = data.slice(rLength, rLength + sLength);
        const recoveryArray = data.slice(rLength + sLength);
    
        // Convert Uint8Array back to hex strings
        const rHex = Buffer.from(rArray).toString('hex');
        const sHex = Buffer.from(sArray).toString('hex');
        const recoveryHex = Buffer.from(recoveryArray).toString('hex');
    
        // Convert hex strings to BigInt and number
        const r = BigInt('0x' + rHex);
        const s = BigInt('0x' + sHex);
        const recovery = parseInt(recoveryHex, 16);
    
        return { r, s, recovery } as WeierstrassSignatureType;
    }