# Satnam Amrit — Live Transcription & Karaoke

A real-time speech-to-text application with premium Soniox API support and Web Speech API fallback. Features multi-language support and karaoke-style word highlighting.

## Quick checklist (what I will cover below)
- Features  
- Quick start (dev + build)
- Soniox API setup (optional premium upgrade)
- Usage & UX notes (karaoke behavior)
- Troubleshooting & browser support
- Privacy, deployment & contribution notes

---

## Features

- **Dual Speech Recognition**: Premium Soniox WebSocket API with Web Speech API fallback
- **Real-time transcription**: Ultra-low latency live speech-to-text  
- **Karaoke mode**: Import lyrics (`.lrc`) and get karaoke-style word highlighting as you sing
- **Live-transcription mode**: Generate lyrics from spoken words in real time
- **Multi-language support**: English, Hindi, Punjabi with language switching
- **Copy/export**: Save live lyrics to clipboard
- **Smart fallback**: Automatically falls back to Web Speech API if Soniox is unavailable
- **Browser-based**: Works entirely in the browser, no server required

For detailed Soniox setup instructions, see [SONIOX_SETUP.md](./SONIOX_SETUP.md)

---

- **Dual Speech Recognition**: Premium Soniox WebSocket API with Web Speech API fallback
- **Real-time transcription**: Ultra-low latency live speech-to-text
- **Karaoke mode**: Import lyrics (`.lrc`) and get karaoke-style word highlighting as you sing
- **Live-transcription mode**: Generate lyrics from spoken words in real time
- **Multi-language support**: English, Hindi, Punjabi with language switching
- **Copy/export**: Save live lyrics to clipboard
- **Smart fallback**: Automatically falls back to Web Speech API if Soniox is unavailable
- **Browser-based**: Works entirely in the browser, no server required

---

## Quick start

### Development setup

```powershell
# Clone and install
git clone <your-repo-url>
cd live-transcription-tool
npm install

# Optional: Set up Soniox API (premium features)
cp .env.local.example .env.local
# Edit .env.local and add your Soniox API key

# Start development server
npm run dev
```

**🎯 Premium Upgrade**: For enhanced accuracy and features, see [SONIOX_SETUP.md](./SONIOX_SETUP.md) to configure the Soniox API.

### Production build

```powershell
npm run build
```

The built files will be in the `dist` folder, ready for static hosting.

---
# Clone and install
git clone <your-repo-url>
cd live-transcription-tool
npm install

# Optional: Set up Soniox API (premium features)
cp .env.local.example .env.local
# Edit .env.local and add your Soniox API key

# Start development server
npm run dev
```

### Production build

```powershell
npm run build
```

The built files will be in the `dist` folder, ready for static hosting.

---

## Soniox API Setup (Optional Premium Upgrade)

The app works great with the free Web Speech API, but for enhanced accuracy and features, you can upgrade to Soniox:

### 1. Get a Soniox API Key

1. Visit [Soniox Console](https://console.soniox.com/)
2. Create an account and get your API key
3. Copy your API key

### 2. Configure the Environment

```powershell
# Copy the environment template
cp .env.local.example .env.local

# Edit .env.local and add your API key:
# VITE_SONIOX_API_KEY=your_actual_api_key_here
```

### 3. Restart Development Server

```powershell
npm run dev
```

You'll now see "Using Soniox API (Premium)" in the status when recording!

### Soniox Benefits

- **Superior accuracy**: Especially for multi-language and noisy environments
- **Lower latency**: Real-time WebSocket connection
- **Advanced features**: Speaker diarization, language identification
- **Better handling**: Continuous speech and complex scenarios
- **Automatic fallback**: Still falls back to Web Speech API if needed

---

## Quick start (development)

Prerequisites

- Node.js 18+ (Node 22 recommended)
- A modern browser with Web Speech API support (Chrome/Edge recommended)

Clone, install, and run:

```powershell
git clone https://github.com/BlackBlossom/Satnam-Amrit.git
cd "d:\VS Code\live-transcription-tool"  # or your clone path
npm install
npm run dev
```

Open: `http://localhost:5173`

Build for production:

```powershell
npm run build
npm run preview   # optional local preview
```

---

## Usage (how karaoke & live transcription work)

1. Grant the browser microphone permission when prompted.
2. Choose your language via the settings button.
3. Click the green mic to start listening. Click again to stop.
4. Optional: Import an `.lrc` file via the **Import Lyrics** button to enable karaoke mode.

Karaoke behavior details

- When lyrics are imported, the app enters Karaoke Mode. It uses only the current spoken phrase (not the whole transcript) to match and highlight words, so highlighting is immediate and accurate.
- After a short pause (2s), the transcript resets automatically so the next phrase is matched fresh — this prevents concatenation errors and keeps highlighting in sync.
- The matching algorithm is fuzzy-aware (handles small mis-hearings) and prioritizes matches near the current highlight for continuous flow.
- If no imported lyrics are present, the app builds live lyric lines from speech in ~8-word groupings.

Tips for best results

- Use Chrome or Edge for the best Web Speech API experience.
- Pause briefly between lines/phrases in karaoke mode to allow the app to reset and re-sync.
- Speak clearly and avoid background noise for higher accuracy.

---

## Troubleshooting & Browser support

- Web Speech API has the best support in Chrome/Chromium and Edge.
- Safari supports speech recognition but behavior/formatting may differ across versions.
- Firefox has limited or no speech recognition in many versions.

If you see no transcript or the mic refuses to start:

- Check browser microphone permissions.
- Try a different browser (Chrome recommended).
- Reload the page and try again.

Known issue: Continuous listening behavior can vary by platform (Chrome on Android may restart the microphone frequently).

---

## Privacy & Security

- All speech recognition is performed by the user's browser (Web Speech API) or any polyfill you configure. No transcription is performed by external services by default.
- If you configure a polyfill/cloud provider (Azure, etc.), that provider may receive audio for transcription — see polyfill docs before enabling.

---

## Deployment

This project was designed to host on any static hosting (Firebase Hosting, Netlify, Vercel).

Example: build and deploy with Firebase

```powershell
npm run build
firebase deploy --only hosting
```

For automatic deploys, use GitHub Actions configured in `.github/workflows` (see `GITHUB_ACTIONS_SETUP.md`).

---

## Project layout (important files)

- `src/pages/LivePage.jsx` — main UI and speech logic (karaoke + live transcription)
- `src/store/lyricsStore.js` — zustand store; handles cues, imported lyrics, and the highlight logic
- `src/api/speechClient.js` — language mapping utilities
- `src/components/Lyrics/` — lyrics UI and `LyricsDisplay` component

---

## Contributing

1. Fork the repo
2. Create a branch (`feat/my-feature`)
3. Make small, testable commits
4. Open a pull request describing the change and motivation

Please include a brief local repro and any test steps for UI/behavior changes.

---

## License

MIT — see `LICENSE` (or add one) for details.

---

If you want, I can also add a short "How karaoke matching works" section with diagrams or examples, or generate a dedicated `CONTRIBUTING.md` and `CHANGELOG.md` next.
