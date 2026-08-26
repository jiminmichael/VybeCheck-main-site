# Deploying VybeCheckwithBama to Vercel

This repository is pre-configured with `vercel.json` and a serverless API handler (`/api/index.ts`) for zero-configuration deployment on **Vercel**.

---

## Method 1: Deploy with GitHub (Recommended)

### Step 1: Push your code to GitHub
1. In AI Studio, click the **Settings** menu at the top right and select **Export to GitHub** (or download the ZIP and push to a new GitHub repo):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for VybeCheckwithBama"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vybecheck.git
   git push -u origin main
   ```

### Step 2: Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and log in with your GitHub account.
2. Select your repository `vybecheck` and click **Import**.

### Step 3: Configure Project Settings
Vercel automatically detects the Vite framework with our `vercel.json` file. Ensure the following:
- **Framework Preset**: `Vite` (or `Other`)
- **Build Command**: `vite build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 4: Add Environment Variables
In the **Environment Variables** section on Vercel, add:
- `GEMINI_API_KEY`: Your Google Gemini API Key (for real-time AI audio recognition and song identification).
- `PAYSTACK_PUBLIC_KEY` (optional): For Paystack live / test payment keys.

### Step 5: Click Deploy 🚀
Vercel will build your frontend and deploy your serverless APIs in seconds. You will receive a live URL such as:
`https://vybecheck-bama.vercel.app`

---

## Method 2: Deploy using Vercel CLI

If you have the [Vercel CLI](https://vercel.com/docs/cli) installed locally:

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy directly to production
vercel --prod
```

During the prompt:
- Link to existing project? `N`
- Project name: `vybecheck-bama`
- In which directory is your code located? `./`
- Want to modify settings? `N` (settings are auto-configured in `vercel.json`)

---

## Architecture on Vercel

- **Client App**: High-performance React 19 + Vite SPA with Tailwind CSS served at the edge from `/dist`.
- **Serverless API**: Handled through `/api/index.ts` powering:
  - `/api/music/search` — Real-time song search & suggestions with album artwork and previews
  - `/api/music/trending` — Dynamic trending club hits
  - `/api/music/identify` — Shazam-style multimodal AI audio recognition
  - `/api/health` — API status health check
