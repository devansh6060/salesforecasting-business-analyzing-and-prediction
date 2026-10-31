# Deploy ForecastIQ to Vercel

This package contains static website files plus Vercel Functions for `/api/market` and `/api/indices`. No database or environment variable is required.

## Recommended: deploy with the Vercel CLI

1. Extract the ZIP file. Do not run deployment from inside the ZIP preview.
2. Install Node.js 20 or newer from https://nodejs.org/.
3. Double-click `DEPLOY_TO_VERCEL.bat`, or open PowerShell/VS Code inside the extracted folder and run:

   ```powershell
   npx vercel@latest --prod
   ```

5. Sign in when prompted and accept the detected settings. Keep the project root as the current directory and use **Other** as the framework preset if Vercel asks.
6. Vercel will print the production URL when deployment completes.

## Deploy through GitHub

1. Extract the ZIP and upload the extracted files to a new GitHub repository. `index.html`, `vercel.json` and the `api` folder must remain at the repository root.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Select **Other** for Framework Preset. Leave Build Command and Output Directory empty.
4. Select **Deploy**.

## Verify after deployment

- Open the generated Vercel URL and use **Continue as Demo Executive**.
- Open **Forecast Studio** and change a forecast preset.
- Open **Stock performance**, search for `RELIANCE`, and confirm that live NSE data loads.
- The market-data provider may occasionally delay or rate-limit responses; successful responses are cached for one minute. Stock prices refresh every minute while the section is visible. Uploaded CSVs are not replaced by automatic refreshes.

Authentication in this academic version is browser-local. For public production use, replace it with server-side authentication and persistent storage.
