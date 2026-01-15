# 7991 AI Pro - Bring Your Own API Key (BYOK)

## Security Architecture
This application follows a strict **Client-Side Only** architecture to ensure maximum privacy for educators.

1. **Zero Server Persistence**: Your Gemini API Key is never sent to our servers. We do not have a backend database or request logging system that sees your key.
2. **Local Storage**: The key is stored solely in your browser's `localStorage`. Clearing your browser data or clicking "Clear Key" in the app permanently removes it from your device.
3. **Direct Communication**: All AI requests are made directly from your browser to Google's Gemini API endpoints.

## Risks & Mitigations
- **Browser Security**: If someone else has physical access to your unlocked computer, they could potentially retrieve the key from your browser's developer tools.
- **Mitigation**: Always lock your computer when away and use the "Clear Key" feature if using a shared workstation.

## Vercel Deployment
This app is ready to be deployed to Vercel as a static site.
- No environment variables are required on the server side.
- Users configure their own keys upon first use.
