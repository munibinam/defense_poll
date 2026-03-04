# Defense Poll - Dissertation Defense Scheduling

A web app for scheduling dissertation defense times with timezone support and centralized data storage.

## Features

- 📅 Schedule availability across April 1-23, 2026 (9 AM - 6 PM ET)
- 🌍 Automatic timezone conversion for users worldwide
- 👥 See everyone's availability in real-time
- 🔐 Admin panel for data management (password: `admin2026`)
- 📊 Export/import data as JSON
- ☁️ Centralized storage with Vercel KV

## Setup

### Local Development

```bash
npm install
npm run dev
```

### Production Deployment (Vercel)

1. Deploy to Vercel: `vercel`

2. Set up Upstash Redis Integration:
   - Go to [Vercel Marketplace](https://vercel.com/marketplace)
   - Search for "Upstash Redis"  
   - Click "Add Integration"
   - Select your project and connect the integration
   - The environment variables will be automatically added

3. **IMPORTANT**: Without Redis setup, the app will show a setup error message

## Admin Access

1. Click "Admin" button
2. Enter password: `admin2026` (change this in `src/App.jsx` line 201)
3. Features:
   - Export all data as JSON
   - Import data from JSON file
   - Delete individual responses
   - Reset all submissions

## Data Storage

- **With Upstash Redis**: All users see the same shared data
- **Without Redis**: App shows setup error and won't function

## Technologies

- React + Vite
- Vercel Serverless Functions  
- Upstash Redis for storage
- Automatic timezone detection
