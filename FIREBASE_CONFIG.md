# Firebase Hosting Configuration

## Environment Variables

Create a `.env.production` file for production-specific configurations:

```bash
# Production environment
NODE_ENV=production
```

## Firebase Hosting Configuration

The hosting is configured for:
- **Public Directory:** `dist` (Vite build output)
- **Single Page Application:** All routes redirect to `/index.html`
- **Automatic Builds:** GitHub Actions deployment on push to main

## Security Features

1. **HTTPS Only**: Firebase Hosting provides automatic SSL
2. **GitHub Integration**: Secure deployment pipeline with GitHub Actions
3. **Preview Deployments**: Safe testing with auto-expiring preview URLs

## Monitoring

Monitor your deployments:
- **Firebase Console**: https://console.firebase.google.com/project/shabadsynck
- **GitHub Actions**: Check the Actions tab for deployment status
- **Hosting Logs**: Monitor traffic and errors in Firebase Console

## Cost Optimization

- Static hosting with global CDN
- Preview deployments auto-expire in 7 days
- No server costs - client-side only application using browser Speech API
- No external API costs - uses Web Speech API built into browsers
