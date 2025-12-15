import { NextRequest, NextResponse } from 'next/server'
import { fetchAllHolders, getTokenOverview } from '@/lib/birdeye'
import { batchCheckSells, isExcludedAddress } from '@/lib/helius'
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

    if (!birdeyeKey || !heliusKey) {
      return NextResponse.json({ error: 'API keys not configured' }, { status: 500 })
    }

    // Get token info
    const tokenInfo = await getTokenOverview(tokenMint, birdeyeKey)
    if (!tokenInfo) {
      return NextResponse.json({ error: 'Could not fetch token info' }, { status: 400 })
    }

    // Fetch all holders
    console.log(`[lottery] Fetching holders for ${tokenInfo.symbol}...`)
    const allHolders = await fetchAllHolders(tokenMint, birdeyeKey)

    if (allHolders.length === 0) {
      return NextResponse.json({ error: 'No holders found' }, { status: 400 })
    }

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
