# Live Transcription Tool

A real-time speech-to-text application using React, Firebase, and AssemblyAI API. Supports multiple languages with high accuracy.

## 🚀 Features

- **Real-time Speech Recognition** - Live transcription via AssemblyAI streaming API
- **Multi-language Support** - Multiple languages supported by AssemblyAI
- **Firebase Hosting** - Static hosting with global CDN
- **Client-side Processing** - Direct API integration, no server required
- **Responsive Design** - Works on desktop and mobile devices
- **Enhanced Permissions** - Smart microphone permission handling

## 🛠️ Development Setup

### Prerequisites

- Node.js 22+
- Firebase CLI
- AssemblyAI API key

### 1. Clone and Install

```bash
git clone https://github.com/BlackBlossom/ShabadSynck.git
cd ShabadSynck
npm install
```

### 2. Configuration

The application uses AssemblyAI's streaming API with the API key configured in the speech client. For production, you should:

1. Get your AssemblyAI API key from [AssemblyAI Dashboard](https://app.assemblyai.com/)
2. Replace the API key in `src/api/speechClient.js`
3. Consider using environment variables for production deployment

### 3. Start Development

```bash
npm run dev
```

This starts the React app on `http://localhost:5173`

## 🔐 Security

**⚠️ API Key Security:**

- For development, the API key is included in the client code
- For production, consider implementing a backend proxy to hide the API key
- Monitor API usage in AssemblyAI dashboard

## 🚢 Deployment

### Automatic Deployment (Recommended)

1. Add GitHub secrets for Firebase (see `GITHUB_ACTIONS_SETUP.md`)
2. Push to main branch
3. GitHub Actions automatically deploys to Firebase Hosting

### Manual Deployment

```bash
npm run build
firebase deploy --only hosting
```

## 📁 Project Structure

```
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── api/               # AssemblyAI client
│   └── pages/             # Application pages
└── .github/workflows/    # GitHub Actions for hosting
```

## 🌐 Live Demo

Visit: [https://shabadsynck.web.app](https://shabadsynck.web.app)

## 📖 Documentation

- `FIREBASE_CONFIG.md` - Firebase hosting details
- `GITHUB_ACTIONS_SETUP.md` - CI/CD configuration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
