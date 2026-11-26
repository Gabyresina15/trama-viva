import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDK6FDRZK5TQ544VDDXFPWXC3OEPXI2RQFA2MMASYIDVFKHG3YLSYIDR",
  }
} as const

export const Errors = {
  1: {message:"InvalidBps"},
  2: {message:"InvalidAmount"},
  3: {message:"PieceNotFound"},
  4: {message:"PieceAlreadyRegistered"},
  5: {message:"DuplicateSupport"},
  6: {message:"NothingToClaim"},
  7: {message:"Overflow"},
  8: {message:"PendingEscrowNotEmpty"}
}


export interface Piece {
  artisan: string;
  artisan_bps: u32;
  passport_hash: Buffer;
  sala: string;
  total_supported: i128;
}


export interface Config {
  admin: string;
  token: string;
  total_pending: i128;
}





export interface Client {
  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * La artesana retira el 100 % de su saldo custodiado.
   */
  claim: ({artisan}: {artisan: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_piece transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_piece: ({piece_id}: {piece_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Piece>>>

  /**
   * Construct and simulate a set_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cambia el token SAC (ej. USDC de Circle ↔ XLM nativo de respaldo).
   * Solo el admin, y solo si no hay saldo custodiado en el token actual.
   */
  set_token: ({new_token}: {new_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a support_piece transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Apoyo atómico: parte de la Sala directo a su cuenta y parte de la Artesana
   * directo o custodiada en el contrato. Devuelve `(artisan_amount, sala_amount)`.
   */
  support_piece: ({supporter, piece_id, amount, hold_in_escrow}: {supporter: string, piece_id: string, amount: i128, hold_in_escrow: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

  /**
   * Construct and simulate a register_piece transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Registra (o actualiza, si es la misma Sala) una pieza certificada.
   */
  register_piece: ({sala, piece_id, artisan, passport_hash, artisan_bps}: {sala: string, piece_id: string, artisan: string, passport_hash: Buffer, artisan_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_balance: ({artisan}: {artisan: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token}: {admin: string, token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAAKSW52YWxpZEJwcwAAAAAAAQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAIAAAAAAAAADVBpZWNlTm90Rm91bmQAAAAAAAADAAAAAAAAABZQaWVjZUFscmVhZHlSZWdpc3RlcmVkAAAAAAAEAAAAAAAAABBEdXBsaWNhdGVTdXBwb3J0AAAABQAAAAAAAAAOTm90aGluZ1RvQ2xhaW0AAAAAAAYAAAAAAAAACE92ZXJmbG93AAAABwAAAAAAAAAVUGVuZGluZ0VzY3Jvd05vdEVtcHR5AAAAAAAACA==",
        "AAAAAQAAAAAAAAAAAAAABVBpZWNlAAAAAAAABQAAAAAAAAAHYXJ0aXNhbgAAAAATAAAAAAAAAAthcnRpc2FuX2JwcwAAAAAEAAAAAAAAAA1wYXNzcG9ydF9oYXNoAAAAAAAD7gAAACAAAAAAAAAABHNhbGEAAAATAAAAAAAAAA90b3RhbF9zdXBwb3J0ZWQAAAAACw==",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAADXRvdGFsX3BlbmRpbmcAAAAAAAAL",
        "AAAABQAAAAAAAAAAAAAADFRva2VuVXBkYXRlZAAAAAEAAAANdG9rZW5fdXBkYXRlZAAAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAAAAAAACW9sZF90b2tlbgAAAAAAABMAAAAAAAAAAAAAAAluZXdfdG9rZW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADlBpZWNlU3VwcG9ydGVkAAAAAAABAAAAD3BpZWNlX3N1cHBvcnRlZAAAAAAKAAAAAAAAAAhwaWVjZV9pZAAAABEAAAABAAAAAAAAAAlzdXBwb3J0ZXIAAAAAAAATAAAAAQAAAAAAAAAEc2FsYQAAABMAAAAAAAAAAAAAAAdhcnRpc2FuAAAAABMAAAAAAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAA5hcnRpc2FuX2Ftb3VudAAAAAAACwAAAAAAAAAAAAAAC3NhbGFfYW1vdW50AAAAAAsAAAAAAAAAAAAAAA5ob2xkX2luX2VzY3JvdwAAAAAAAQAAAAAAAAAAAAAADXBhc3Nwb3J0X2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAD0Vhcm5pbmdzQ2xhaW1lZAAAAAABAAAAEGVhcm5pbmdzX2NsYWltZWQAAAADAAAAAAAAAAdhcnRpc2FuAAAAABMAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAD1BpZWNlUmVnaXN0ZXJlZAAAAAABAAAAEHBpZWNlX3JlZ2lzdGVyZWQAAAAGAAAAAAAAAAhwaWVjZV9pZAAAABEAAAABAAAAAAAAAARzYWxhAAAAEwAAAAEAAAAAAAAAB2FydGlzYW4AAAAAEwAAAAAAAAAAAAAADXBhc3Nwb3J0X2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAAAAAAC2FydGlzYW5fYnBzAAAAAAQAAAAAAAAAAAAAAAd1cGRhdGVkAAAAAAEAAAAAAAAAAg==",
        "AAAAAAAAADNMYSBhcnRlc2FuYSByZXRpcmEgZWwgMTAwICUgZGUgc3Ugc2FsZG8gY3VzdG9kaWFkby4AAAAABWNsYWltAAAAAAAAAQAAAAAAAAAHYXJ0aXNhbgAAAAATAAAAAQAAA+kAAAALAAAH0AAAAAVFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAJZ2V0X3BpZWNlAAAAAAAAAQAAAAAAAAAIcGllY2VfaWQAAAARAAAAAQAAA+gAAAfQAAAABVBpZWNlAAAA",
        "AAAAAAAAAIlDYW1iaWEgZWwgdG9rZW4gU0FDIChlai4gVVNEQyBkZSBDaXJjbGUg4oaUIFhMTSBuYXRpdm8gZGUgcmVzcGFsZG8pLgpTb2xvIGVsIGFkbWluLCB5IHNvbG8gc2kgbm8gaGF5IHNhbGRvIGN1c3RvZGlhZG8gZW4gZWwgdG9rZW4gYWN0dWFsLgAAAAAAAAlzZXRfdG9rZW4AAAAAAAABAAAAAAAAAAluZXdfdG9rZW4AAAAAAAATAAAAAQAAA+kAAAACAAAH0AAAAAVFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAJpBcG95byBhdMOzbWljbzogcGFydGUgZGUgbGEgU2FsYSBkaXJlY3RvIGEgc3UgY3VlbnRhIHkgcGFydGUgZGUgbGEgQXJ0ZXNhbmEKZGlyZWN0byBvIGN1c3RvZGlhZGEgZW4gZWwgY29udHJhdG8uIERldnVlbHZlIGAoYXJ0aXNhbl9hbW91bnQsIHNhbGFfYW1vdW50KWAuAAAAAAANc3VwcG9ydF9waWVjZQAAAAAAAAQAAAAAAAAACXN1cHBvcnRlcgAAAAAAABMAAAAAAAAACHBpZWNlX2lkAAAAEQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAA5ob2xkX2luX2VzY3JvdwAAAAAAAQAAAAEAAAPpAAAD7QAAAAIAAAALAAAACwAAB9AAAAAFRXJyb3IAAAA=",
        "AAAAAAAAAEJSZWdpc3RyYSAobyBhY3R1YWxpemEsIHNpIGVzIGxhIG1pc21hIFNhbGEpIHVuYSBwaWV6YSBjZXJ0aWZpY2FkYS4AAAAAAA5yZWdpc3Rlcl9waWVjZQAAAAAABQAAAAAAAAAEc2FsYQAAABMAAAAAAAAACHBpZWNlX2lkAAAAEQAAAAAAAAAHYXJ0aXNhbgAAAAATAAAAAAAAAA1wYXNzcG9ydF9oYXNoAAAAAAAD7gAAACAAAAAAAAAAC2FydGlzYW5fYnBzAAAAAAQAAAABAAAD6QAAAAIAAAfQAAAABUVycm9yAAAA",
        "AAAAAAAAAAAAAAATZ2V0X3BlbmRpbmdfYmFsYW5jZQAAAAABAAAAAAAAAAdhcnRpc2FuAAAAABMAAAABAAAACw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    claim: this.txFromJSON<Result<i128>>,
        get_piece: this.txFromJSON<Option<Piece>>,
        set_token: this.txFromJSON<Result<void>>,
        get_config: this.txFromJSON<Config>,
        support_piece: this.txFromJSON<Result<readonly [i128, i128]>>,
        register_piece: this.txFromJSON<Result<void>>,
        get_pending_balance: this.txFromJSON<i128>
  }
}