import { NextRequest, NextResponse } from 'next/server'
import { fetchAllHolders, getTokenOverview } from '@/lib/birdeye'
import {
  batchCheckSells,
  isExcludedAddress,
  fetchAllHoldersHelius,
  getTokenMetadataHelius,
} from '@/lib/helius'
import { buildLotteryEntries, pickWinner, calculateTickets } from '@/lib/lottery'

export const maxDuration = 300 // 5 minutes for processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenMint, action } = body

    if (!tokenMint) {
      return NextResponse.json({ error: 'Token mint address required' }, { status: 400 })
    }

    const birdeyeKey = process.env.BIRDEYE_API_KEY
    const heliusKey = process.env.HELIUS_API_KEY

    if (!heliusKey) {
      return NextResponse.json({ error: 'HELIUS_API_KEY not configured' }, { status: 500 })
    }

    // Get token info - try Birdeye first, then Helius
    let tokenInfo: { symbol: string; name: string } | null = null

    if (birdeyeKey) {
      const birdeyeInfo = await getTokenOverview(tokenMint, birdeyeKey)
      if (birdeyeInfo) {
        tokenInfo = { symbol: birdeyeInfo.symbol, name: birdeyeInfo.name }
      }
    }

    if (!tokenInfo) {
      const heliusInfo = await getTokenMetadataHelius(tokenMint, heliusKey)
      if (heliusInfo) {
        tokenInfo = { symbol: heliusInfo.symbol, name: heliusInfo.name }
      }
    }

    if (!tokenInfo) {
      return NextResponse.json({ error: 'Could not fetch token info' }, { status: 400 })
    }

    // Fetch all holders - try Birdeye first, then fall back to Helius
    console.log(`[lottery] Fetching holders for ${tokenInfo.symbol}...`)

    let allHolders: Array<{ owner: string; balance: number }> = []
    let usedSource = 'birdeye'

    if (birdeyeKey) {
      try {
        const birdeyeHolders = await fetchAllHolders(tokenMint, birdeyeKey)
        allHolders = birdeyeHolders.map(h => ({ owner: h.owner, balance: h.balance }))
      } catch (error) {
        console.log(`[lottery] Birdeye failed, falling back to Helius...`)
        // Birdeye failed (likely 404 due to tier), fall back to Helius
      }
    }

    if (allHolders.length === 0) {
      console.log(`[lottery] Using Helius to fetch holders...`)
      usedSource = 'helius'
      const heliusHolders = await fetchAllHoldersHelius(tokenMint, heliusKey)
      allHolders = heliusHolders
    }

    if (allHolders.length === 0) {
      return NextResponse.json({ error: 'No holders found' }, { status: 400 })
    }

    console.log(`[lottery] Fetched ${allHolders.length} holders via ${usedSource}`)

    // Filter out LP addresses and wallets with < 10k tokens
    const eligibleHolders = allHolders.filter(h => {
      if (isExcludedAddress(h.owner)) return false
      if (calculateTickets(h.balance) < 1) return false
      return true
    })

    console.log(`[lottery] ${eligibleHolders.length} holders with 10k+ tokens (excluding LPs)`)

    // Check sell history for each holder
    console.log(`[lottery] Checking sell history...`)
    const eligibilityMap = await batchCheckSells(
      eligibleHolders.map(h => h.owner),
      tokenMint,
      heliusKey
    )

    // Build lottery entries
    const entries = buildLotteryEntries(eligibleHolders, eligibilityMap)

    // If action is 'pick', pick a winner
    let result = null
    if (action === 'pick') {
      result = pickWinner(entries)
    }

    // Stats
    const eligibleEntries = entries.filter(e => e.eligible)
    const totalTickets = eligibleEntries.reduce((sum, e) => sum + e.tickets, 0)

    return NextResponse.json({
      token: {
        mint: tokenMint,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
      },
      stats: {
        totalHolders: allHolders.length,
        holdersWithMinBalance: eligibleHolders.length,
        eligibleHolders: eligibleEntries.length,
        disqualified: entries.filter(e => !e.eligible).length,
        totalTickets,
        source: usedSource,
      },
      entries: entries.slice(0, 100), // Return top 100 for preview
      result,
    })

  } catch (error) {
    console.error('[lottery] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
