# Fix 1 — HTTPS on localhost (quick fix)

## Issue

```
FB.login can no longer be called from http pages
```

Meta now requires HTTPS even for local development — `FB.login` will not work over plain `http://localhost`.

## Solution

Serve both the frontend and backend over HTTPS locally, using a locally-trusted certificate.

## Steps

### 1. Install a local SSL plugin for Vite (client)

```bash
npm install -D @vitejs/plugin-basic-ssl
```

### 2. Generate a locally-trusted certificate using `mkcert`

- Download the latest release: https://github.com/FiloSottile/mkcert/releases
- Install the local CA:
  ```bash
  .\mkcert.exe -install
  ```
- Generate a cert for localhost:
  ```bash
  .\mkcert.exe localhost
  ```
- This produces two files: `localhost.pem` (certificate) and `localhost-key.pem` (private key).

### 3. Backend — serve over HTTPS

- Import `https` in `server.js` and use the generated cert/key to create an HTTPS server instead of a plain HTTP one.
- Update the CORS config to allow the `https://localhost` origin (not just `http://localhost`).

### 4. Meta App Dashboard

- Go to your app's WhatsApp Business → **Dev Console**:
  `https://developers.facebook.com/apps/<APP_ID>/whatsapp-business/wa-dev-console/`
- Make sure the configured redirect/embed URLs use `https://localhost`, matching your new local setup.

<!-- ngrok command  -->

.\ngrok http https://localhost:4001