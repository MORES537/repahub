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

## Deploy to GitHub Pages

Because this is a static site, deploy directly from the repository root:

1. Commit and push all files to GitHub.
2. In GitHub repo settings, open **Pages**.
3. Set source to:
   - Branch: `main` (or your default branch)
   - Folder: `/ (root)`
4. Save and wait for Pages to publish.
5. Open the provided Pages URL.

If you deploy under a subpath, keep all asset/script links relative (already configured this way).
