# BAGSLOTTO 🎰

Diamond hands lottery for Solana token holders.

## Rules

- Every **10,000 tokens** = 1 ticket
- Maximum **20,000,000 tokens** = 2,000 tickets (cap)
- **Must NEVER have sold** any tokens to be eligible
- LP wallets and programs are excluded

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your API keys
4. Run dev server: `npm run dev`

## Environment Variables

- `BIRDEYE_API_KEY` - Get from https://birdeye.so
- `HELIUS_API_KEY` - Get from https://helius.dev

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Birdeye API (token holders)
- Helius API (transaction history)
