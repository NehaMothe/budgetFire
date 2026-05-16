# 🔥 BudgetFIRE

Personal FIRE tracker with **AES-256-GCM encrypted** local storage.  
Built with React + Vite. Zero backend. Runs entirely in your browser.

## Features
- 🔒 Password-protected — all data encrypted before saving
- 📊 6 tabs: Dashboard · Portfolio · Budget · FIRE Plan · Net Worth · Analysis
- 📈 Cap allocation analysis (Large / Mid / Small)
- 💴 JPY → INR conversion built in
- 📸 Monthly snapshots for progress tracking
- ⬇ Export / ⬆ Import encrypted `.enc` backup file

## Quick start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/budgetfire.git
cd budgetfire

# 2. Install
npm install

# 3. Run locally
npm run dev
# → open http://localhost:5173
```

## Deploy to GitHub Pages

```bash
# 1. Build
npm run build

# 2. Install gh-pages (one time)
npm install --save-dev gh-pages

# 3. Add to package.json scripts:
#    "deploy": "gh-pages -d dist"

# 4. Deploy
npm run deploy
```

Then enable GitHub Pages in your repo settings → Pages → Branch: `gh-pages`.

## Security

- Password is **never stored** — used only to derive an AES-256 key via PBKDF2 (200,000 iterations, SHA-256)
- All data in `localStorage` is encrypted ciphertext — unreadable without your password
- Export `.enc` files are also encrypted — safe to store in cloud/email
- Uses the browser's built-in **Web Crypto API** — zero external crypto dependencies

## Update your portfolio data

Edit `src/data.js` — update `EQUITY_HOLDINGS`, `MF_HOLDINGS`, `ADVISOR_MF` with your latest values.

## Stack

- React 18
- Vite 5
- Web Crypto API (AES-256-GCM)
- Zero UI libraries — pure inline styles
