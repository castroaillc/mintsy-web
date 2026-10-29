# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## mintsy Premium: store setup checklist

The app sells Premium through RevenueCat (`react-native-purchases`). Prices, trial length and the yearly
savings are read from the stores at runtime, so nothing here is hard-coded in the app. Steve does these steps.

**Suggested product ids** (the app tells Yearly from Monthly by the word in the id):
`mintsy_premium_yearly`, `mintsy_premium_monthly`.

### App Store Connect
- [ ] Agreements, Tax and Banking: sign the **Paid Apps** agreement and add bank and tax details (purchases fail without it).
- [ ] App › Subscriptions: create the subscription group **mintsy Premium**.
- [ ] In it, add the auto-renewable subscriptions `mintsy_premium_monthly` (1 month) and `mintsy_premium_yearly` (1 year), each with price, display name, description and a review screenshot.
- [ ] On each, add an **Introductory Offer**: Free, with the trial length you want (e.g. 1 week), for new subscribers.
- [ ] Users and Access › Sandbox: create **sandbox testers** (sign in on the device under Settings › App Store › Sandbox Account).
- [ ] App Store Connect API › In-App Purchase key: generate it and upload it to RevenueCat (RevenueCat › the iOS app › In-app purchase key configuration).
- [ ] App Information: Privacy Policy URL `https://getmintsy.com/privacy`. For the License Agreement keep **Apple's standard EULA** (don't upload a custom one), and end the App Store description with a Terms of Use line linking to it: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`. The paywall's "Terms of Use (EULA)" link (iOS only) points there; Android shows only the Privacy Policy link.

### Google Play Console
- [ ] Monetize › Products › Subscriptions: create `mintsy_premium_monthly` and `mintsy_premium_yearly`, each with an auto-renewing **base plan** (P1M / P1Y) and a **free trial offer** for new customers.
- [ ] Set up a payments profile; add **license testers** (Setup › License testing).
- [ ] Create a Google Cloud service account with Play Console financial access and upload its JSON key to RevenueCat (the Android app's service account credentials).
- [ ] Upload a build with the BILLING permission (any build with `react-native-purchases`) to an internal testing track so the products become available.

### RevenueCat
- [ ] Create the project **mintsy** and add the apps: App Store (`com.getmintsy.app`) and Play Store (`com.getmintsy.app`). For dev builds also add `com.getmintsy.app.dev` or test with the production bundle id.
- [ ] Products: import both products from each store.
- [ ] Entitlements: create **`premium`** and attach all four products (2 per store).
- [ ] Offerings: create **`default`** (make it Current) with the packages **`$rc_monthly`** (Monthly) and **`$rc_annual`** (Annual), each holding the App Store and Play Store product.
- [ ] Project settings › API keys: copy the **public** SDK keys:
  - iOS key (`appl_…`) → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `mobile-app/.env` and the EAS environment variables for the build profiles.
  - Android key (`goog_…`) → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, same places.
- [ ] Create a **secret API key** (v2, read access to customers/subscribers) → `REVENUECAT_SECRET_API_KEY` in the backend's environment (Cloud Run secret). Never in the app.
- [ ] Integrations › Webhooks: URL `https://<backend host>/webhooks/revenuecat`, Authorization header value = a long random string; put the same string in the backend's `REVENUECAT_WEBHOOK_AUTH`.
- [ ] App user ids: the app calls `Purchases.logIn(<Better Auth user id>)`, so RevenueCat's `app_user_id` is the backend user id. Leave "Restore behavior" at the default (transfer to new App User ID) unless you decide otherwise.

### After the keys are in
- [ ] Make a new development build (`eas build --profile development`); `react-native-purchases` is native code and Expo Go only runs RevenueCat's preview mode.
- [ ] Sandbox tests: buy yearly (trial), buy monthly, cancel, restore on a fresh install, let it expire (sandbox renewals are accelerated), switch plans, and sign in as another user (entitlements follow the account).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
