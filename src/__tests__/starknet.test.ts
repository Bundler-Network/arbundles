// import InjectedStarknetSigner from "signing/chains/InjectedStarknetSigner";
// import { getDomain } from "signing/chains/StarknetSigner";
// import { Account, RpcProvider, encode, typedData } from "starknet";

import { createData } from "../../index";
import { createData as createFileData } from "../file";
import InjectedStarknet from "../../src/signing/chains/InjectedStarknetSigner"
import { Account, encode, RpcProvider } from "starknet";



const provider = new RpcProvider({nodeUrl:""})

const PrivateKey = '0x525bc68475c0955fae83869beec0996114d4bb27b28b781ed2a20ef23121b8de';
const myAddressInStarknet =
  '0x65a822fbee1ae79e898688b5a4282dc79e0042cbed12f6169937fddb4c26641';
const account = new Account(provider,myAddressInStarknet,PrivateKey)



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