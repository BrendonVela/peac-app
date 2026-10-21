# Getting PEAC into the App Store

Already done in the code:
- Privacy Policy: https://peac-app.vercel.app/privacy
- Terms of Service: https://peac-app.vercel.app/terms
- In-app account deletion (Settings -> Delete my account)
- App icons (public/icon-*.png), dark launch colors, iPhone notch / home-bar spacing
- capacitor.config.json (wraps the live site https://peac-app.vercel.app as the app)
- mobile/www/index.html (shown only if the phone is offline)

Still needs an Apple Developer account ($99/yr) and a Mac (or a cloud Mac / build service):
1. npm install @capacitor/core @capacitor/cli @capacitor/ios
2. npx cap add ios
3. npx cap open ios   (opens Xcode)
4. In Xcode: set the Team, bundle id com.peac.app, app icon (use public/icon-512.png at 1024x1024)
5. Add native push (APNs) - web push from the website does not work inside the wrapped app
6. Product -> Archive -> upload to App Store Connect
7. App Store Connect: screenshots, description, privacy "nutrition label", demo login for Apple's reviewer

Demo account for Apple review: make one coach + one athlete login with sample data and put the
emails/passwords in App Store Connect -> App Review Information.
