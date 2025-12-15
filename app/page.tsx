'use client'

import { useState, useEffect } from 'react'

interface LotteryEntry {
  wallet: string
  balance: number
  tickets: number
  eligible: boolean
  reason?: string
}

interface LotteryData {
  entries: LotteryEntry[]
  stats: {
    totalHolders: number
    eligibleHolders: number
    totalTickets: number
  }
}

// Hardcoded token mint - will be set after launch
const TOKEN_MINT = '' // Add your token mint here after launch

export default function Home() {
  const [searchWallet, setSearchWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LotteryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<LotteryEntry | null>(null)
  const [searched, setSearched] = useState(false)

  // Load eligible holders on mount (once token is set)
  useEffect(() => {
    if (TOKEN_MINT) {
      loadHolders()
    }
  }, [])

  const loadHolders = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenMint: TOKEN_MINT, action: 'analyze' }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to load holders')
      }

      setData({
        entries: json.entries.filter((e: LotteryEntry) => e.eligible),
        stats: json.stats,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const searchForWallet = () => {
    if (!searchWallet.trim()) {
      setSearchResult(null)
      setSearched(false)
      return
    }

    setSearched(true)

    if (!data) {
      setSearchResult(null)
      return
    }

    const found = data.entries.find(
      e => e.wallet.toLowerCase() === searchWallet.trim().toLowerCase()
    )
    setSearchResult(found || null)
  }

  const formatNumber = (n: number) => n.toLocaleString()
  const formatWallet = (w: string) => `${w.slice(0, 6)}...${w.slice(-4)}`

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            BAGS<span className="text-yellow-400">LOTTO</span>
          </h1>
          <div className="text-5xl md:text-7xl font-black text-yellow-400 mb-4">
            $100,000 LOTTERY
          </div>
        </div>

        {/* Rules */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">Rules</h2>
          <ul className="space-y-2 text-zinc-300">
            <li>Every <span className="text-white font-semibold">10,000 tokens</span> = 1 ticket</li>
            <li>Maximum <span className="text-white font-semibold">20,000,000 tokens</span> = 2,000 tickets (cap)</li>
            <li><span className="text-red-400">Must NEVER have sold</span> any tokens to be eligible</li>
            <li>LP wallets and programs are excluded</li>
          </ul>
        </div>

        {/* Verifiable Randomness */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">Verifiable Randomness</h2>
          <p className="text-zinc-300 mb-4">
            The winner selection is provably fair and verifiable by anyone. Here&apos;s how it works:
          </p>
          <ol className="space-y-3 text-zinc-300 list-decimal list-inside">
            <li>
              <span className="text-white font-semibold">Snapshot:</span> At selection time, we take a snapshot of all eligible holders and their ticket counts
            </li>
            <li>
              <span className="text-white font-semibold">Future Block:</span> We announce a future Solana block number (e.g., current block + 100)
            </li>
            <li>
              <span className="text-white font-semibold">Block Hash as Seed:</span> Once that block is mined, its hash becomes our random seed - this cannot be predicted or manipulated
            </li>
            <li>
              <span className="text-white font-semibold">Deterministic Selection:</span> The block hash is converted to a number, then modulo total tickets gives us the winning ticket number
            </li>
            <li>
              <span className="text-white font-semibold">Verify Yourself:</span> Anyone can verify the result using the published snapshot, block hash, and our open-source algorithm
            </li>
          </ol>
          <div className="mt-4 p-4 bg-zinc-800 rounded-lg">
            <div className="text-sm text-zinc-400 font-mono">
              winningTicket = BigInt(&apos;0x&apos; + blockHash) % totalTickets + 1
            </div>
          </div>
        </div>

        {/* Wallet Search */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Check Your Eligibility</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={searchWallet}
              onChange={(e) => setSearchWallet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchForWallet()}
              placeholder="Enter your wallet address..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
            />
            <button
              onClick={searchForWallet}
              className="bg-yellow-400 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-300 transition-colors"
            >
              Search
            </button>
          </div>

          {/* Search Result */}
          {searched && (
            <div className="mt-4">
              {searchResult ? (
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
                  <div className="text-green-400 font-semibold mb-2">ELIGIBLE</div>
                  <div className="text-zinc-300">
                    Balance: <span className="text-white font-semibold">{formatNumber(Math.floor(searchResult.balance))}</span> tokens
                  </div>
                  <div className="text-zinc-300">
                    Tickets: <span className="text-yellow-400 font-bold text-xl">{formatNumber(searchResult.tickets)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                  <div className="text-red-400 font-semibold">NOT ELIGIBLE</div>
                  <div className="text-zinc-400 text-sm mt-1">
                    Wallet not found in eligible holders list. You may have sold tokens or don&apos;t hold enough.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8 text-red-200">
            {error}
          </div>
        )}

        {/* Token not set message */}
        {!TOKEN_MINT && (
          <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-2">Coming Soon</div>
            <div className="text-zinc-400">
              Eligible holders list will be available after token launch
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-zinc-400">Loading eligible holders...</div>
          </div>
        )}

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(data.stats.totalHolders)}</div>
              <div className="text-sm text-zinc-400">Total Holders</div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-green-400">{formatNumber(data.stats.eligibleHolders)}</div>
              <div className="text-sm text-zinc-400">Eligible</div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
              <div className="text-2xl font-bold text-yellow-400">{formatNumber(data.stats.totalTickets)}</div>
              <div className="text-sm text-zinc-400">Total Tickets</div>
            </div>
          </div>
        )}

        {/* Eligible Holders Table */}
        {data && data.entries.length > 0 && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="font-semibold">Eligible Holders ({formatNumber(data.entries.length)})</h3>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-zinc-800 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm text-zinc-400">#</th>
                    <th className="text-left px-4 py-3 text-sm text-zinc-400">Wallet</th>
                    <th className="text-right px-4 py-3 text-sm text-zinc-400">Balance</th>
                    <th className="text-right px-4 py-3 text-sm text-zinc-400">Tickets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.entries.map((entry, i) => (
                    <tr key={entry.wallet} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <code className="text-sm">{formatWallet(entry.wallet)}</code>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {formatNumber(Math.floor(entry.balance))}
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-400 font-semibold">
                        {formatNumber(entry.tickets)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-600 text-sm">
          BAGSLOTTO
        </div>
      </main>
    </div>
  )
}
