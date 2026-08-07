# Non-production fixture host

This static, standalone Vercel project exists only so a real Android emulator can exercise the hardened HTTPS downloader with measured internal APK fixtures. Vercel assigned its first deployment to that test project's stable production target; it is not the Hub backend, contains no catalogue or publisher data, and is never used as a product/public-launch deployment.
