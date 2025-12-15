'use client'

import { useState } from 'react'

interface LotteryEntry {
  wallet: string
  balance: number
  tickets: number
  eligible: boolean
  reason?: string
}

interface LotteryResult {
  winner: LotteryEntry
  totalTickets: number
  totalEligible: number
  winningTicket: number
  timestamp: number
}

interface LotteryResponse {
  token: {
    mint: string
    symbol: string
    name: string
  }
  stats: {
    totalHolders: number
    holdersWithMinBalance: number
    eligibleHolders: number
    disqualified: number
    totalTickets: number
  }
  entries: LotteryEntry[]
  result: LotteryResult | null
}

export default function Home() {
  const [tokenMint, setTokenMint] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LotteryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = async () => {
    if (!tokenMint.trim()) {
      setError('Please enter a token mint address')
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch('/api/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenMint: tokenMint.trim(), action: 'analyze' }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to analyze')
      }

      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const pickWinner = async () => {
    if (!tokenMint.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/lottery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenMint: tokenMint.trim(), action: 'pick' }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Failed to pick winner')
      }

      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (n: number) => n.toLocaleString()
  const formatWallet = (w: string) => `${w.slice(0, 6)}...${w.slice(-4)}`

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">
            🎰 BAGS<span className="text-yellow-400">LOTTO</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Diamond hands lottery for token holders
          </p>
        </div>

        {/* Rules */}
        <div className="bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">📜 Rules</h2>
          <ul className="space-y-2 text-zinc-300">
            <li>• Every <span className="text-white font-semibold">10,000 tokens</span> = 1 ticket</li>
            <li>• Maximum <span className="text-white font-semibold">20,000,000 tokens</span> = 2,000 tickets (cap)</li>
            <li>• <span className="text-red-400">Must NEVER have sold</span> any tokens to be eligible</li>
            <li>• LP wallets and programs are excluded</li>
          </ul>
        </div>

        {/* Input */}
        <div className="mb-8">
          <label className="block text-sm text-zinc-400 mb-2">Token Mint Address</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              placeholder="Enter Solana token mint address..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-yellow-400 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="bg-yellow-400 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8 text-red-200">
            {error}
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">
            {/* Token Info */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h2 className="text-xl font-semibold mb-4">
                {data.token.name} ({data.token.symbol})
              </h2>
              <p className="text-zinc-500 text-sm break-all">{data.token.mint}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                <div className="text-2xl font-bold text-white">{formatNumber(data.stats.totalHolders)}</div>
                <div className="text-sm text-zinc-400">Total Holders</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                <div className="text-2xl font-bold text-green-400">{formatNumber(data.stats.eligibleHolders)}</div>
                <div className="text-sm text-zinc-400">Eligible</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                <div className="text-2xl font-bold text-red-400">{formatNumber(data.stats.disqualified)}</div>
                <div className="text-sm text-zinc-400">Disqualified</div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                <div className="text-2xl font-bold text-yellow-400">{formatNumber(data.stats.totalTickets)}</div>
                <div className="text-sm text-zinc-400">Total Tickets</div>
              </div>
            </div>

            {/* Winner */}
            {data.result && (
              <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-xl p-8 border border-yellow-400/50 text-center">
                <div className="text-4xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">WINNER!</h2>
                <div className="bg-black/50 rounded-lg p-4 inline-block">
                  <code className="text-white text-lg">{data.result.winner.wallet}</code>
                </div>
                <div className="mt-4 text-zinc-300">
                  <span className="text-yellow-400 font-semibold">{formatNumber(data.result.winner.balance)}</span> tokens
                  ({formatNumber(data.result.winner.tickets)} tickets)
                </div>
                <div className="text-sm text-zinc-500 mt-2">
                  Ticket #{formatNumber(data.result.winningTicket)} of {formatNumber(data.result.totalTickets)}
                </div>
              </div>
            )}

            {/* Pick Winner Button */}
            {!data.result && data.stats.eligibleHolders > 0 && (
              <div className="text-center">
                <button
                  onClick={pickWinner}
                  disabled={loading}
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 text-black font-bold px-12 py-4 rounded-xl text-xl hover:from-yellow-300 hover:to-orange-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                >
                  🎲 PICK WINNER 🎲
                </button>
              </div>
            )}

            {/* Eligible Holders Table */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="font-semibold">Eligible Holders (Top 100)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm text-zinc-400">Wallet</th>
                      <th className="text-right px-4 py-3 text-sm text-zinc-400">Balance</th>
                      <th className="text-right px-4 py-3 text-sm text-zinc-400">Tickets</th>
                      <th className="text-center px-4 py-3 text-sm text-zinc-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {data.entries.map((entry, i) => (
                      <tr key={entry.wallet} className="hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <code className="text-sm">{formatWallet(entry.wallet)}</code>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatNumber(Math.floor(entry.balance))}
                        </td>
                        <td className="px-4 py-3 text-right text-yellow-400 font-semibold">
                          {formatNumber(entry.tickets)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {entry.eligible ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-red-400" title={entry.reason}>✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-600 text-sm">
          BAGSLOTTO • Diamond hands only 💎🙌
        </div>
      </main>
    </div>
  )
}
