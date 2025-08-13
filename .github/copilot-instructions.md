# n8n Markdown to Google Docs Converter

A Firebase function that converts Markdown content to Google Docs format, specifically designed for n8n workflows. This TypeScript/Node.js project uses Bun as the package manager and Firebase Functions for serverless deployment.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Install Node.js 22.18.0 (REQUIRED - package.json specifies Node.js 22):
  - `wget https://nodejs.org/dist/v22.18.0/node-v22.18.0-linux-x64.tar.xz`
  - `tar -xf node-v22.18.0-linux-x64.tar.xz`
  - `sudo mv node-v22.18.0-linux-x64 /opt/node22`
  - `sudo ln -sf /opt/node22/bin/node /usr/local/bin/node`
  - `sudo ln -sf /opt/node22/bin/npm /usr/local/bin/npm`
  - `sudo ln -sf /opt/node22/bin/npx /usr/local/bin/npx`
- Install Bun runtime (REQUIRED - project uses bun.lock):
  - `curl -fsSL https://bun.sh/install | bash`
  - `source ~/.bashrc`

### Bootstrap, Build, and Test
- Install dependencies: `bun install` -- takes 15-30 seconds. NEVER CANCEL. Set timeout to 2+ minutes.
- Build the project: `bun run build` -- takes under 1 second. NEVER CANCEL. Set timeout to 2+ minutes.
- Run development server: `bun run dev` -- starts watch mode. NEVER CANCEL.
- Build for production: `bun run build` -- creates lib/index.js (28MB bundled file)

### Development Commands
- Watch mode development: `bun run dev` 
- Build with watch: `bun run build:watch`
- Test locally: Use the validation script below

### Firebase Deployment (Production)
- Firebase CLI installation takes 10+ minutes and often times out. Use npx instead when possible.
- Deploy to Firebase: `bun run deploy` (requires Firebase authentication)
- Start emulators: `bun run serve` (may require Firebase CLI)
- View logs: `bun run logs`

## Validation

### Essential Validation Steps
Always run this validation after making changes:

```javascript
// Create this as /tmp/validate.js and run with: node /tmp/validate.js
console.log('🧪 Validating build...');

// 1. Check build output exists and is valid
const fs = require('fs');
const libPath = '/home/runner/work/n8n-md-to-docs/n8n-md-to-docs/lib';
if (!fs.existsSync(`${libPath}/index.js`) || fs.statSync(`${libPath}/index.js`).size === 0) {
    throw new Error('❌ Build failed or lib/index.js missing');
}

// 2. Check critical dependencies
const deps = ['firebase-functions', 'firebase-admin', 'express', 'googleapis', 'marked', 'docx'];
const nodeModules = '/home/runner/work/n8n-md-to-docs/n8n-md-to-docs/node_modules';
for (const dep of deps) {
    if (!fs.existsSync(`${nodeModules}/${dep}`)) {
        throw new Error(`❌ Missing dependency: ${dep}`);
    }
}

console.log('✅ Validation passed');
```

### Manual Testing Scenarios
- **CRITICAL**: Always test the conversion functionality after changes to the conversion logic
- Test markdown parsing with: Headers, lists, bold text, code blocks, line breaks
- Test API endpoints: POST to / with `{output: "# Test", fileName: "Test Doc"}`
- Test authentication flow with Bearer tokens
- Test error handling with invalid inputs

### Build Timing Expectations
- **Dependencies**: 15-30 seconds with Bun. NEVER CANCEL. Set timeout to 3+ minutes for npm installs.
- **Build**: Under 1 second. NEVER CANCEL. Set timeout to 2+ minutes.
- **Firebase CLI install**: 10+ minutes. Often times out. Use npx when possible.

## Common Tasks

### Repo Structure
```
.
├── README.md
├── package.json          # Node.js 22, Bun scripts
├── bun.lock             # Bun lockfile
├── tsconfig.json        # TypeScript config
├── firebase.json        # Firebase configuration
├── src/
│   ├── index.ts         # Main Firebase function
│   ├── types/           # TypeScript interfaces
│   └── services/        # Google Docs & DOCX converters
├── lib/                 # Build output (generated)
└── public/              # Static assets
```

### Key Files to Check After Changes
- Always check `src/index.ts` after API changes
- Always check `src/services/googleDocs.ts` after conversion logic changes
- Always check `src/services/docxConverter.ts` after document formatting changes
- Always validate `lib/index.js` exists and is ~28MB after builds

### package.json Scripts Reference
```json
{
  "build": "bun build ./src/index.ts --outdir ./lib --target node && cp package.json lib/",
  "build:watch": "bun build ./src/index.ts --outdir ./lib --target node --watch",
  "serve": "bun run build && firebase emulators:start",
  "deploy": "firebase deploy --only functions",
  "dev": "bun --watch src/index.ts"
}
```

### Dependencies Overview
- **Runtime**: Node.js 22, Bun package manager
- **Framework**: Firebase Functions v2, Express.js
- **Core**: googleapis (Google Docs API), marked (Markdown parser), docx (DOCX generation)
- **Auth**: OAuth2 via firebase-admin

## Troubleshooting

### Common Issues
- **Node.js version mismatch**: Ensure Node.js 22.x is installed (check with `node --version`)
- **Bun not found**: Run `source ~/.bashrc` after Bun installation
- **Firebase CLI timeout**: Use npx firebase commands or skip emulator testing
- **Build size**: lib/index.js should be ~28MB when bundled correctly
- **Missing dependencies**: Run `bun install` if node_modules is incomplete

### Working Around Firebase CLI Issues
If Firebase CLI installation fails or times out:
- Use `npx firebase` for one-off commands
- Focus on testing the built function directly
- Test conversion logic with unit tests instead of full emulator
- Use the validation script above for build verification

### Performance Notes
- Bun is significantly faster than npm for dependency management (30s vs 10+ minutes)
- Build process is very fast due to Bun's bundler
- Firebase deployment requires authentication setup
- The hosted service is available at https://md2doc.n8n.aemalsayer.com for testing

Always run `bun install && bun run build` and validate with the script above before committing changes.