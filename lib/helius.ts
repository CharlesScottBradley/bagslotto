/**
 * Helius API client for checking wallet transaction history
 * Used to detect if a wallet has sold any tokens
 */

export interface TokenTransfer {
  mint: string
  fromUserAccount: string
  toUserAccount: string
  tokenAmount: number
}

export interface ParsedTransaction {
  signature: string
  timestamp: number
  type: string
  tokenTransfers?: TokenTransfer[]
}

/**
 * Check if a wallet has sold or transferred out any of the specified token
 * Returns true if the wallet has NEVER sold (eligible for lottery)
 */
export async function hasNeverSold(
  walletAddress: string,
  tokenMint: string,
  heliusApiKey: string
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${heliusApiKey}&type=TRANSFER`

    const response = await fetch(url)

    if (!response.ok) {
      // If we can't verify, mark as ineligible to be safe
      return { eligible: false, reason: `API error: ${response.status}` }
    }

    const transactions: ParsedTransaction[] = await response.json()

    // Check each transaction for outgoing token transfers
    for (const tx of transactions) {
      if (!tx.tokenTransfers) continue

      for (const transfer of tx.tokenTransfers) {
        // Check if this is an outgoing transfer of our token
        if (
          transfer.mint === tokenMint &&
          transfer.fromUserAccount === walletAddress &&
          transfer.tokenAmount > 0
        ) {
          return {
            eligible: false,
            reason: `Sold/transferred ${transfer.tokenAmount} tokens (tx: ${tx.signature.slice(0, 8)}...)`
          }
        }
      }
    }

    return { eligible: true }

  } catch (error) {
    console.error(`[helius] Error checking ${walletAddress}:`, error)
    return { eligible: false, reason: 'Error checking transaction history' }
  }
}

/**
 * Batch check multiple wallets for sells
 * Returns map of wallet -> eligibility
 */
export async function batchCheckSells(
  wallets: string[],
  tokenMint: string,
  heliusApiKey: string,
  onProgress?: (checked: number, total: number) => void
): Promise<Map<string, { eligible: boolean; reason?: string }>> {
  const results = new Map<string, { eligible: boolean; reason?: string }>()

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i]
    const result = await hasNeverSold(wallet, tokenMint, heliusApiKey)
    results.set(wallet, result)

    if (onProgress) {
      onProgress(i + 1, wallets.length)
    }

    // Rate limit: 100ms between requests (10 rps)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

/**
 * Known LP and program addresses to filter out
 */
export const EXCLUDED_ADDRESSES = new Set([
  // Raydium AMM
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  // Raydium CLMM
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  // Orca Whirlpool
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  // Pump.fun
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  // Pump.fun fee
  'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM',
  // Jupiter Aggregator
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  // Token Program
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  // Associated Token Program
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
])

/**
 * Check if an address is a known LP or program
 */
export function isExcludedAddress(address: string): boolean {
  return EXCLUDED_ADDRESSES.has(address)
}

// =============================================================================
// TOKEN HOLDER FETCHING (Fallback for when Birdeye premium not available)
// =============================================================================

export interface TokenHolder {
  owner: string
  balance: number
}

/**
 * Fetch all token holders using Helius RPC
 * Uses getTokenAccounts with pagination
 *
 * Note: This can be slow for tokens with many holders
 */
export async function fetchAllHoldersHelius(
  tokenMint: string,
  heliusApiKey: string,
  maxHolders: number = 10000
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = []
  let cursor: string | undefined

  console.log(`[helius] Fetching holders for ${tokenMint}...`)

  const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`

  while (holders.length < maxHolders) {
    try {
      const body: Record<string, unknown> = {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccounts',
        params: {
          mint: tokenMint,
          limit: 1000,
          ...(cursor ? { cursor } : {}),
        },
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        console.error(`[helius] Failed: ${response.status}`)
        break
      }

      const data = await response.json()

      if (data.error) {
        console.error(`[helius] API error:`, data.error)
        break
      }

      const accounts = data.result?.token_accounts || []

      if (accounts.length === 0) {
        console.log(`[helius] No more accounts`)
        break
      }

      for (const acc of accounts) {
        // Skip zero balances
        if (!acc.amount || acc.amount === '0') continue

        holders.push({
          owner: acc.owner,
          balance: Number(acc.amount) / Math.pow(10, acc.decimals || 9),
        })
      }

      console.log(`[helius] Fetched ${holders.length} holders...`)

      cursor = data.result?.cursor
      if (!cursor) break

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`[helius] Error:`, error)
      break
    }
  }

  // Sort by balance descending
  holders.sort((a, b) => b.balance - a.balance)

  console.log(`[helius] Total holders fetched: ${holders.length}`)
  return holders
}

/**
 * Get token metadata using Helius DAS
 */
export async function getTokenMetadataHelius(
  tokenMint: string,
  heliusApiKey: string
): Promise<{ symbol: string; name: string; decimals: number } | null> {
  try {
    const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: tokenMint },
      }),
    })

    if (!response.ok) return null

    const data = await response.json()

    if (data.error || !data.result) return null

    return {
      symbol: data.result.content?.metadata?.symbol || 'UNKNOWN',
      name: data.result.content?.metadata?.name || 'Unknown Token',
      decimals: data.result.token_info?.decimals || 9,
    }
  } catch {
    return null
  }
}
