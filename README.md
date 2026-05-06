<p align="center">
  <img src="assets/logo/repahub-logo.png" alt="RepaHub Logo" width="180">
</p>

# RepaHub dApp

RepaHub is a static multi-page dApp frontend for Cuban Reparto music, NFT showcase, and RepaCoin ($RC) purchase flow on Hedera Mainnet.

## Project Structure

- `index.html` - Main entry point and page markup
- `css/styles.css` - Global styles and responsive layout
- `js/config.js` - Centralized app/network/contract constants
- `js/hedera.js` - Hedera contract and Mirror Node integration helpers
- `js/app.js` - Core UI logic, navigation, buy flow, on-chain status
- `js/wallet.js` - Wallet connection and Hedera network switching
- `js/music.js` - Audio preview/playback and unlock checks
- `assets/logo/` - Logo assets
- `assets/covers/` - Music cover images
- `assets/audio/` - Audio files

## Run Locally

1. Install dependencies:
   - `npm install`
2. Create a `.env` file in the project root with:
   - `VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here`
3. Start the Vite dev server:
   - `npm run dev`
4. Build production assets:
   - `npm run build`

## Contract Details

- Network: Hedera Mainnet
- Chain ID: `295`
- RPC URL: `https://mainnet.hashio.io/api`
- Contract Address: `0xcc66E4bD19C616a72DE06B5B71aC2a226D51B9cD`
- Token ID: `0.0.10430441`
- Fixed UI conversion: `2000 RC = 1 HBAR`
- Mirror Node base: `https://mainnet-public.mirrornode.hedera.com/api/v1`

## Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new).
2. Set **Framework Preset** to `Vite`.
3. Add all environment variables from `.env.example` in the Vercel dashboard.
4. Click **Deploy** — Vercel builds and publishes automatically on every push to `main`.
