import {
  Base64String,
  BroadcastFailure,
  BroadcastResponse,
  LookupAnswer,
  LookupResolver,
  PubKeyHex,
  PushDrop,
  Random,
  TopicBroadcaster,
  Transaction,
  Utils,
  WalletClient,
  WalletInterface,
  WalletProtocol
} from '@bsv/sdk'
import { DIDRecord, DIDQuery } from './types/index.js'

/* ────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */
const PROTOCOL_ID: WalletProtocol = [2, 'did token'] // TODO: Change to: [1, 'metanet did']
const DEFAULT_KEY_ID = '1' // TODO: Update to take into account derivation prefix / suffix
const DEFAULT_OVERLAY_TOPIC = 'tm_did'
const DEFAULT_LOOKUP_SERVICE = 'ls_did'

export interface DIDClientOptions {
  overlayTopic?: string
  overlayService?: string
  wallet?: WalletInterface
  networkPreset?: 'mainnet' | 'testnet' | 'local'
  acceptDelayedBroadcast?: boolean
}

/* ────────────────────────────────────────────────────────────
 * DIDClient
 * ────────────────────────────────────────────────────────── */
export class DIDClient {
  private readonly overlayTopic: string
  private readonly overlayService: string
  private readonly wallet: WalletInterface
  private readonly networkPreset: 'mainnet' | 'testnet' | 'local' | undefined
  private readonly acceptDelayedBroadcast: boolean

  constructor(opts: DIDClientOptions = {}) {
    this.overlayTopic = opts.overlayTopic ?? DEFAULT_OVERLAY_TOPIC
    this.overlayService = opts.overlayService ?? DEFAULT_LOOKUP_SERVICE
    this.wallet = opts.wallet ?? new WalletClient()
    this.networkPreset = opts.networkPreset
    this.acceptDelayedBroadcast = opts.acceptDelayedBroadcast ?? false
  }

  /* ──────────────────────────────  Create  ───────────────────────────── */
  /**
   * Creates (mints) a new DID token that carries the provided `serialNumber`.
   * The token is formed as a PushDrop output and broadcast to the DID overlay.
   * @param serialNumber The serial number to be stored in the DID token.
   * @param subject The public key of the subject of the Identity Certificate.
   * @param opts Optional parameters.
   * @returns The overlay broadcast response or failure.
   */
  async createDID(
    serialNumber: string,
    subject: PubKeyHex,
    opts: { wallet?: WalletInterface, derivationPrefix?: Base64String, derivationSuffix?: Base64String } = {}
  ): Promise<BroadcastResponse | BroadcastFailure> {
    const wallet = opts.wallet ?? this.wallet

    let derivationPrefix: Base64String
    let derivationSuffix: Base64String
    if (!opts.derivationPrefix || !opts.derivationSuffix) {
      derivationPrefix = Utils.toBase64(Random(10))
      derivationSuffix = Utils.toBase64(Random(10))
    } else {
      derivationPrefix = opts.derivationPrefix
      derivationSuffix = opts.derivationSuffix
    }

    // 2. Build a PushDrop locking script
    const lockingScript = await new PushDrop(wallet).lock(
      Utils.toArray(serialNumber, 'base64'),
      PROTOCOL_ID,
      `${derivationPrefix} ${derivationSuffix}`,
      subject
    )

    // 3. Craft the transaction
    const { tx } = await wallet.createAction({
      description: 'Create new DID token',
      outputs: [{
        lockingScript: lockingScript.toHex(),
        satoshis: 1,
        outputDescription: 'DID token',
        basket: 'did',
        tags: [`did-token-${subject}`],
        customInstructions: JSON.stringify({
          derivationPrefix,
          derivationSuffix
        })
      }],
      options: { acceptDelayedBroadcast: this.acceptDelayedBroadcast, randomizeOutputs: false }
    })
    if (!tx) throw new Error('Failed to create DID transaction')

    const transaction = Transaction.fromAtomicBEEF(tx)

    // 4. Broadcast via overlay
    const broadcaster = new TopicBroadcaster([this.overlayTopic], {
      networkPreset: this.networkPreset ?? (await wallet.getNetwork({})).network
    })
    return broadcaster.broadcast(transaction)
  }

  /* ──────────────────────────────  Update  ───────────────────────────── */
  /**
   * Updates an existing DID token with a new `serialNumber` by spending the old
   * output and creating a new one.
   * @param prev The previous DID record.
   * @param newSerialNumber The new serial number to be stored in the DID token.
   */
  // async updateDID(
  //   prev: DIDRecord & { beef: number[] },
  //   newSerialNumber: string
  // ): Promise<BroadcastResponse | BroadcastFailure> {
  //   const prevOutpoint = `${prev.txid}.${prev.outputIndex}` as const

  //   // 1. Encode the new serial
  //   const serialBytes = Utils.toArray(newSerialNumber, 'utf8')

  //   // 2. Build new PushDrop script
  //   // TODO: Update to use correct args
  //   const newLockingScript = await new PushDrop(this.wallet).lock(
  //     [serialBytes],
  //     PROTOCOL_ID,
  //     DEFAULT_KEY_ID,
  //     'anyone',
  //     true
  //   )

  //   // 3. Prepare a spending action
  //   const { signableTransaction } = await this.wallet.createAction({
  //     description: 'Update DID',
  //     inputBEEF: prev.beef,
  //     inputs: [{
  //       outpoint: prevOutpoint,
  //       unlockingScriptLength: 74,
  //       inputDescription: 'Spend previous DID token'
  //     }],
  //     outputs: [{
  //       satoshis: 1,
  //       lockingScript: newLockingScript.toHex(),
  //       outputDescription: 'Updated DID token'
  //     }],
  //     options: { acceptDelayedBroadcast: this.acceptDelayedBroadcast, randomizeOutputs: false }
  //   })
  //   if (!signableTransaction) throw new Error('Unable to create DID update transaction')

  //   // 4. Unlock previous output
  //   const unlocker = new PushDrop(this.wallet).unlock(PROTOCOL_ID, DEFAULT_KEY_ID, 'anyone')
  //   const unlockingScript = await unlocker.sign(Transaction.fromBEEF(signableTransaction.tx), 0)

  //   // 5. Finalize
  //   const { tx } = await this.wallet.signAction({
  //     reference: signableTransaction.reference,
  //     spends: { 0: { unlockingScript: unlockingScript.toHex() } }
  //   })
  //   if (!tx) throw new Error('Unable to finalize DID update')

  //   const transaction = Transaction.fromAtomicBEEF(tx)

  //   // 6. Broadcast
  //   const broadcaster = new TopicBroadcaster([this.overlayTopic], {
  //     networkPreset: this.networkPreset ?? (await this.wallet.getNetwork({})).network
  //   })
  //   return broadcaster.broadcast(transaction)
  // }

  /* ──────────────────────────────  Revoke  ───────────────────────────── */
  /**
   * Revokes a DID token by spending it to fees (effectively burning it).
   */
  async revokeDID(
    prev: DIDRecord & { beef: number[] },
    subject: PubKeyHex,
    opts: { wallet?: WalletInterface, derivationPrefix?: Base64String, derivationSuffix?: Base64String } = {}
  ): Promise<BroadcastResponse | BroadcastFailure> {
    const wallet = opts.wallet ?? this.wallet
    const prevOutpoint = `${prev.txid}.${prev.outputIndex}` as const

    const { signableTransaction } = await wallet.createAction({
      description: 'Revoke DID',
      inputBEEF: prev.beef,
      inputs: [{
        outpoint: prevOutpoint,
        unlockingScriptLength: 74,
        inputDescription: 'Redeem DID token'
      }],
      options: { acceptDelayedBroadcast: this.acceptDelayedBroadcast, randomizeOutputs: false }
    })
    if (!signableTransaction) throw new Error('Unable to build DID revoke transaction')

    const unlocker = new PushDrop(wallet).unlock(
      PROTOCOL_ID,
      `${opts.derivationPrefix} ${opts.derivationSuffix}`,
      subject
    )
    const unlockingScript = await unlocker.sign(Transaction.fromBEEF(signableTransaction.tx), 0)

    const { tx } = await wallet.signAction({
      reference: signableTransaction.reference,
      spends: { 0: { unlockingScript: unlockingScript.toHex() } }
    })
    if (!tx) throw new Error('Unable to finalize DID revoke')

    const transaction = Transaction.fromAtomicBEEF(tx)

    // Broadcast
    const broadcaster = new TopicBroadcaster([this.overlayTopic], {
      networkPreset: this.networkPreset ?? (await this.wallet.getNetwork({})).network
    })
    return broadcaster.broadcast(transaction)
  }

  /* ──────────────────────────────  Find  ───────────────────────────── */
  /**
   * Finds DID tokens published to the overlay. You can search by:
   *
   *  - `serialNumber`  (exact Base‑64 match)
   *  - `outpoint`      ("txid.vout")
   *
   * Supports pagination and sorting via `limit`, `skip`, `sortOrder`.
   */
  async findDID(
    query: DIDQuery & { limit?: number; skip?: number; sortOrder?: 'asc' | 'desc'; startDate?: string; endDate?: string } = {},
    opts: { resolver?: LookupResolver; wallet?: WalletInterface; includeBeef?: boolean } = { includeBeef: true }
  ): Promise<Array<DIDRecord & { beef?: number[] }>> {
    const wallet = opts.wallet ?? this.wallet

    // 1. Build the lookup query
    const lookupQuery: Record<string, unknown> = {}
    if (query.serialNumber) lookupQuery.serialNumber = query.serialNumber
    if (query.outpoint) lookupQuery.outpoint = query.outpoint
    if (query.limit !== undefined) lookupQuery.limit = query.limit
    if (query.skip !== undefined) lookupQuery.skip = query.skip
    if (query.sortOrder) lookupQuery.sortOrder = query.sortOrder
    if (query.startDate) lookupQuery.startDate = `${query.startDate}T00:00:00.000Z`
    if (query.endDate) lookupQuery.endDate = `${query.endDate}T23:59:59.999Z`

    // 2. Resolve via lookup service
    const resolver =
      opts.resolver ??
      new LookupResolver({ networkPreset: this.networkPreset ?? (await wallet.getNetwork({})).network })

    const answer = await resolver.query({ service: this.overlayService, query: lookupQuery })

    // 3. Parse the answer
    return this.parseLookupAnswer(answer, opts.includeBeef!)
  }

  /* ───────────────────── Helper: parse lookup answer ─────────────────── */
  private parseLookupAnswer(
    ans: LookupAnswer,
    includeBeef: boolean
  ): Array<DIDRecord & { beef?: number[] }> {
    if (ans.type !== 'output-list' || ans.outputs.length === 0) return []

    return ans.outputs.map(output => {
      const tx = Transaction.fromBEEF(output.beef)
      const out = tx.outputs[output.outputIndex]

      const decoded = PushDrop.decode(out.lockingScript)
      if (decoded.fields.length < 1) throw new Error('Invalid DID token: missing serial number')

      // Convert serial bytes → Base64 string
      const serialBytes = decoded.fields[0] as number[]
      const serialNumber = Utils.toBase64
        ? (Utils.toBase64(serialBytes) as string)
        : Buffer.from(serialBytes).toString('base64')

      return {
        txid: tx.id('hex'),
        outputIndex: output.outputIndex,
        serialNumber,
        ...(includeBeef ? { beef: output.beef } : {})
      }
    })
  }
}
