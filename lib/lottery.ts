/**
 * BAGSLOTTERY Core Logic
 *
 * Rules:
 * - Every 10,000 tokens = 1 ticket
 * - Maximum 20,000,000 tokens = 2,000 tickets max
 * - Only wallets that have NEVER sold are eligible
 * - LP addresses are excluded
 */

export interface LotteryEntry {
  wallet: string
  balance: number
  tickets: number
  eligible: boolean
  reason?: string
}

export interface LotteryResult {
  winner: LotteryEntry
  totalTickets: number
  totalEligible: number
  winningTicket: number
  timestamp: number
  blockHash?: string
  blockSlot?: number
}

export interface LotterySnapshot {
  entries: LotteryEntry[]
  totalTickets: number
  totalEligible: number
  snapshotTime: number
  tokenMint: string
}

const TOKENS_PER_TICKET = 10_000
const MAX_TOKENS = 20_000_000
const MAX_TICKETS = 2_000

/**
 * Calculate number of tickets for a balance
 */
export function calculateTickets(balance: number): number {
  // Cap at max tokens
  const cappedBalance = Math.min(balance, MAX_TOKENS)
  // Floor to whole tickets only
  const tickets = Math.floor(cappedBalance / TOKENS_PER_TICKET)
  // Cap at max tickets (should be same as max tokens calc but being explicit)
  return Math.min(tickets, MAX_TICKETS)
}

/**
 * Build lottery entries from holder data and eligibility
 */
export function buildLotteryEntries(
  holders: Array<{ owner: string; balance: number }>,
  eligibilityMap: Map<string, { eligible: boolean; reason?: string }>
): LotteryEntry[] {
  const entries: LotteryEntry[] = []

  for (const holder of holders) {
    const eligibility = eligibilityMap.get(holder.owner)
    const tickets = calculateTickets(holder.balance)

    // Must have at least 1 ticket (10k tokens)
    if (tickets < 1) continue

    entries.push({
      wallet: holder.owner,
      balance: holder.balance,
      tickets,
      eligible: eligibility?.eligible ?? false,
      reason: eligibility?.reason,
    })
  }

  return entries
}

/**
 * Pick a random winner using weighted random selection
 * Uses cryptographically random number via Web Crypto API
 *
 * NOTE: This is for testing only. For the actual lottery,
 * use pickWinnerVerifiable() with a Solana block hash.
 */
export function pickWinner(entries: LotteryEntry[]): LotteryResult | null {
  // Filter to only eligible entries
  const eligible = entries.filter(e => e.eligible && e.tickets > 0)

  if (eligible.length === 0) {
    console.error('[lottery] No eligible entries!')
    return null
  }

  // Calculate total tickets
  const totalTickets = eligible.reduce((sum, e) => sum + e.tickets, 0)

  // Generate random number between 1 and totalTickets
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  const winningTicket = (randomBytes[0] % totalTickets) + 1

  // Find the winner
  let ticketCount = 0
  for (const entry of eligible) {
    ticketCount += entry.tickets
    if (ticketCount >= winningTicket) {
      return {
        winner: entry,
        totalTickets,
        totalEligible: eligible.length,
        winningTicket,
        timestamp: Date.now(),
      }
    }
  }

  // Should never reach here
  return null
}

/**
 * VERIFIABLE RANDOM WINNER SELECTION
 *
 * Uses a Solana block hash as the random seed.
 * This is provably fair because:
 * 1. The block hash is determined by the Solana network, not us
 * 2. We announce the target block BEFORE it's mined
 * 3. Anyone can verify the result using the same inputs
 *
 * Algorithm:
 * winningTicket = (BigInt('0x' + blockHash) % BigInt(totalTickets)) + 1n
 */
export function pickWinnerVerifiable(
  entries: LotteryEntry[],
  blockHash: string,
  blockSlot: number
): LotteryResult | null {
  // Filter to only eligible entries
  const eligible = entries.filter(e => e.eligible && e.tickets > 0)

  if (eligible.length === 0) {
    console.error('[lottery] No eligible entries!')
    return null
  }

  // Sort entries deterministically by wallet address for reproducibility
  eligible.sort((a, b) => a.wallet.localeCompare(b.wallet))

  // Calculate total tickets
  const totalTickets = eligible.reduce((sum, e) => sum + e.tickets, 0)

  // Convert block hash to winning ticket number
  // Remove '0x' prefix if present
  const cleanHash = blockHash.startsWith('0x') ? blockHash.slice(2) : blockHash
  const hashBigInt = BigInt('0x' + cleanHash)
  const winningTicketBigInt = (hashBigInt % BigInt(totalTickets)) + 1n
  const winningTicket = Number(winningTicketBigInt)

  // Find the winner by iterating through sorted entries
  let ticketCount = 0
  for (const entry of eligible) {
    ticketCount += entry.tickets
    if (ticketCount >= winningTicket) {
      return {
        winner: entry,
        totalTickets,
        totalEligible: eligible.length,
        winningTicket,
        timestamp: Date.now(),
        blockHash: cleanHash,
        blockSlot,
      }
    }
  }

  // Should never reach here
  return null
}

/**
 * Create a snapshot of current eligible entries
 * This should be saved and published before announcing the target block
 */
export function createSnapshot(
  entries: LotteryEntry[],
  tokenMint: string
): LotterySnapshot {
  const eligible = entries.filter(e => e.eligible && e.tickets > 0)
  // Sort deterministically
  eligible.sort((a, b) => a.wallet.localeCompare(b.wallet))

  return {
    entries: eligible,
    totalTickets: eligible.reduce((sum, e) => sum + e.tickets, 0),
    totalEligible: eligible.length,
    snapshotTime: Date.now(),
    tokenMint,
  }
}

/**
 * Verify a lottery result given a snapshot and block hash
 * Anyone can run this to confirm the winner was selected fairly
 */
export function verifyResult(
  snapshot: LotterySnapshot,
  blockHash: string,
  claimedWinner: string
): { valid: boolean; calculatedWinner: string; winningTicket: number } {
  const cleanHash = blockHash.startsWith('0x') ? blockHash.slice(2) : blockHash
  const hashBigInt = BigInt('0x' + cleanHash)
  const winningTicketBigInt = (hashBigInt % BigInt(snapshot.totalTickets)) + 1n
  const winningTicket = Number(winningTicketBigInt)

  // Find winner from snapshot
  let ticketCount = 0
  for (const entry of snapshot.entries) {
    ticketCount += entry.tickets
    if (ticketCount >= winningTicket) {
      return {
        valid: entry.wallet === claimedWinner,
        calculatedWinner: entry.wallet,
        winningTicket,
      }
    }
  }

  return { valid: false, calculatedWinner: '', winningTicket }
}

/**
 * Format wallet address for display
 */
export function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Export eligible wallets as CSV
 */
export function exportToCSV(entries: LotteryEntry[]): string {
  const eligible = entries.filter(e => e.eligible)
  const lines = ['wallet,balance,tickets']

  for (const entry of eligible) {
    lines.push(`${entry.wallet},${entry.balance},${entry.tickets}`)
  }

  return lines.join('\n')
}

/**
 * Export eligible wallets as JSON
 */
export function exportToJSON(entries: LotteryEntry[]): string {
  const eligible = entries.filter(e => e.eligible)
  return JSON.stringify(eligible, null, 2)
}
