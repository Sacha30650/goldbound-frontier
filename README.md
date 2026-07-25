# Goldbound Frontier

Jeu mobile iOS/Android de chercheur d'or et de construction de village, construit avec Capacitor. La version GitHub Pages sert de preview web du même gameplay.

## Plateformes

- **Android** : projet Gradle complet dans `android/` (SDK 24 minimum, cible SDK 36)
- **iOS** : projet Xcode/Swift Package Manager complet dans `ios/`
- **Web/PWA** : preview déployable directement sur GitHub Pages
- Identifiant natif : `com.goldbound.frontier`

## Fonctionnalités

- Mini-jeu de détection à timing avec qualité de signal
- Argent, or, pièces et diamant premium très rare
- Énergie avec régénération, XP, niveaux et série de scans
- Village constructible avec revenus passifs et gains hors ligne
- Upgrades d'équipement et missions progressives
- Publicités récompensées simulées et boutique pay-to-win simulée
- Sauvegarde `localStorage`, PWA et interface responsive

## Développement

```bash
npm install
npm run build
npx cap sync
```

### Android

Le build Android nécessite JDK 21 et le SDK Android :

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
npm run sync
cd android && ./gradlew assembleDebug
```

APK de debug : `android/app/build/outputs/apk/debug/app-debug.apk`.

### iOS

Sur macOS avec Xcode :

```bash
npm run sync
npx cap open ios
```

Choisir ensuite l'équipe Apple Developer et le profil de signature dans Xcode avant l'archivage App Store Connect.

### Preview web locale

```bash
python3 -m http.server 4173
```

Puis ouvrir <http://localhost:4173>.

## Note monétisation

La preview simule les achats et publicités. Pour une publication commerciale, connecter les écrans existants à StoreKit 2 / Google Play Billing et à une régie publicitaire récompensée telle qu'AdMob, avec restauration des achats et validation serveur.
