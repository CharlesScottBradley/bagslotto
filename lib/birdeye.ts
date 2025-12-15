/**
 * Birdeye API client for fetching token holders
 * Docs: https://docs.birdeye.so
 */

const BIRDEYE_BASE = 'https://public-api.birdeye.so'

export interface TokenHolder {
  owner: string        // Wallet address
  balance: number      // Token balance (UI amount)
  percentage: number   // % of total supply
}

export interface HolderListResponse {
  success: boolean
  data: {
    total: number
    items: Array<{
      owner: string
      ui_amount: number
      amount: string
    }>
  }
}

/**
 * Fetch all token holders with pagination
 * Returns up to 10,000 holders (Birdeye limit)
 */
export async function fetchAllHolders(
  tokenAddress: string,
  apiKey: string,
  maxHolders: number = 10000
): Promise<TokenHolder[]> {
  const holders: TokenHolder[] = []
  let offset = 0
  const limit = 100 // Birdeye page size

  console.log(`[birdeye] Fetching holders for ${tokenAddress}...`)

  while (offset < maxHolders) {
    try {
      const url = `${BIRDEYE_BASE}/defi/v3/token/holder?address=${tokenAddress}&offset=${offset}&limit=${limit}`

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
          'x-chain': 'solana',
        },
      })

      if (!response.ok) {
        console.error(`[birdeye] Failed at offset ${offset}: ${response.status}`)
        break
      }

      const data: HolderListResponse = await response.json()

      if (!data.success || !data.data?.items?.length) {
        console.log(`[birdeye] No more holders at offset ${offset}`)
        break
      }

      for (const item of data.data.items) {
        holders.push({
          owner: item.owner,
          balance: item.ui_amount,
          percentage: 0, // Will calculate later
        })
      }

      console.log(`[birdeye] Fetched ${holders.length} holders...`)

      if (data.data.items.length < limit) {
        // Last page
        break
      }

      offset += limit

      // Rate limit: 50ms between requests
      await new Promise(resolve => setTimeout(resolve, 50))

    } catch (error) {
      console.error(`[birdeye] Error at offset ${offset}:`, error)
      break
    }
  }

  console.log(`[birdeye] Total holders fetched: ${holders.length}`)
  return holders
}

/**
 * Get token metadata (for filtering LP, etc.)
 */
export async function getTokenOverview(
  tokenAddress: string,
  apiKey: string
): Promise<{
  symbol: string
  name: string
  supply: number
  decimals: number
} | null> {
  try {
    const url = `${BIRDEYE_BASE}/defi/token_overview?address=${tokenAddress}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    })

    if (!response.ok) return null

    const data = await response.json()

    if (!data.success) return null

    return {
      symbol: data.data?.symbol || 'UNKNOWN',
      name: data.data?.name || 'Unknown Token',
      supply: data.data?.supply || 0,
      decimals: data.data?.decimals || 9,
    }
  } catch {
    return null
  }
}
