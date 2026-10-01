# Tamga Wallet (Expo) — demo v0

Belge cüzdanı (EUDI Wallet sınıfı), kripto cüzdanı değil. **D3:** cüzdan oluşturma (PIN / Face ID), QR ile
OpenID4VCI daveti, `tx_code` ile 10 kopya alma (her kopya ayrı anahtar), yerel doğrulama (A1–A5 + cnf + B4),
belge görüntüleme, "arka planda ne oldu" paneli. **D4:** OpenID4VP sunumu — doğrulayıcının QR'ı → imzalı istek
nesnesi doğrulama → güven listesinden RP kaydı (aşırı talep uyarısı, kayıtsız doğrulayıcı uyarısı) → alan alan
onay → PIN/Face ID → KB-JWT + JWE ile gönderim → sunum geçmişi (cihazda).

İş mantığı `packages/wallet-core` (`@tamga-network/wallet-core`, Node + RN); bu klasör yalnızca ekranlar ve cihaz
katmanıdır (`src/platform.ts`: SecureStore, FileSystem, expo-crypto, LocalAuthentication).

**ADR-0011 (D-ID-6):** "Kimliğimi doğrula" → sistem tarayıcısında Tamga kimlik servisi (KVKK rıza → uzaktan doğrulama; demo: sahte)
→ geri dönüş (`exp://…/--/idv/cb`, üründe `tamga-wallet://idv/cb`) → 10 kopya kimlik belgesi. "Kurumdan belge al" → güven
listesinden kurum dizini (ara + kategori) → "Diploma iste" → kurum satır içi OpenID4VP ile kimlik sunumu ister → onay → diploma
(öğrenci girişi/OBS yok). Kod: `src/issuance.ts`; `expo-web-browser`, `expo-linking`.

## Derleme (EAS — geliştirme ve mağaza)

Donanım anahtarları, cihaz kanıtı, yüz yüze gösterme (Bluetooth) ve tarayıcıdan sunum Expo Go'da çalışmaz; yerel modüller
(`modules/tamga-keys`, `modules/tamga-ble`) derleme ister. Profiller `eas.json`'da, farklar `app.config.ts`'te:

| Komut | Ne üretir |
|---|---|
| `npm run build:dev` | geliştirme derlemesi (`network.tamga.wallet.dev`, "Tamga Wallet (Dev)", App Attest development) — mağaza sürümüyle yan yana |
| `npm run build:preview` | iç dağıtım (TestFlight / APK), mağaza kimliği |
| `npm run build:store` / `submit:store` | mağaza derlemesi (sürüm numarası EAS'te, otomatik artar) / gönderim (Play: `secrets/play-service-account.json`, iç test kanalı, taslak) |

Önkoşul: Expo hesabı (`npx eas-cli@latest login`), Apple Developer hesabı ve Google Play Console. `npm run doctor` bağımlılıkları denetler.

## Çalıştırma (iPhone, Expo Go)

```bash
# 1) tamga-network kökünde bağımlılıklar (workspace)
npm install
# 2) issuer'ı (Kurum Konsolu dahil, http://localhost:4003) LAN adresiyle başlat (tamga-platform/.env): telefon offer URL'sine doğrudan gider
#    TAMGA_ISSUER_BASE=http://<PC-LAN-IP>:4001
cd ../tamga-platform && npm run dev
# 3) wallet provider (WUA) — cüzdan → Ayarlar → "Wallet Provider adresi": http://<PC-LAN-IP>:4005
#    TAMGA_WP_BASE=http://<PC-LAN-IP>:4005 ; cd ../tamga-network && npm run wallet-provider
# 3b) referans verifier (LAN'da güven listesini de sunar: TAMGA_VERIFY_SERVE_TRUST=1, .env'de)
#    TAMGA_VERIFY_BASE=http://<PC-LAN-IP>:4004
cd ../tamga-network && npm run verify
# 4) cüzdan
cd apps/wallet && npm run start:lan      # QR'ı iPhone Kamera ile okut → Expo Go (aynı Wi-Fi). Expo Go yeni sürümleri hesap ister:
#    telefonda Expo Go'ya ve PC'de `npx expo login` ile AYNI hesaba gir (Google ile üye olunduysa expo.dev'de şifre tanımla).
#    Cüzdan → Ayarlar → "Güven listesi adresi": http://<PC-LAN-IP>:4004/trust   (RP kaydı + kurum dizini için)
#    Ayarlar → "Issuer adresi": http://<PC-LAN-IP>:4001 · "Kimlik servisi adresi": http://<PC-LAN-IP>:4006 (tamga-platform: npm run id)
```

Akış: portal `http://<PC-LAN-IP>:4003/bilgi` → öğrenci girişi (`121200001` / `demo`) → "Diplomamı
cüzdanıma al" → ekranda QR + PIN → cüzdanda **Belge ekle** → QR → PIN → belge.

Sunum: tarayıcıda `http://<PC-LAN-IP>:4004` → "QR üret" → cüzdanda QR okut → alanları onayla → sonuç ekranı.

Windows güvenlik duvarı 4001/4003/4004/4005'e LAN'dan izin vermeli. Sahneler 3→11'i telefon olmadan denemek:
`cd tamga-platform && npx tsx ops/demo-scenes.ts` (dört servis ayakta; hız için `TAMGA_STATUS_INTERVAL_SEC=10`). `http` (TLS'siz) yalnızca geliştirme içindir.

## Sapmalar (demo)

- **S-14** WUA'daki cihaz beyanı self-reported (Wallet Provider doğrulamaz); pilotta App Attest / Play Integrity.
- **S-9** anahtarlar yazılımda (`SoftwareKeyProvider`, özel anahtar Keychain'de şifreli ama JS'e açık); WUA
  `key_storage: software` beyanı D4'te eklenir; pilotta `SecureEnclaveKeyProvider` (EAS dev build).
- **S-11** `wallet.json` (belgeler, manifest) şifresiz; pilotta şifreli.
- Expo Go'da özel URL şeması yok → QR uygulama içi kamerayla okunur (bağlantı yapıştırma da var).
- Şema kataloğu `schemas.tamga.network/v1/index.json` erişilemezse B4 atlanır (trace'te görünür).

## Doğrulama

`npm run typecheck` (bu klasör) · `npm run export:check` (Metro paketleme provası) · çekirdek testleri
`npm test` (kök) ve `tamga-platform` `wallet-e2e.test.ts` (issuer ile uçtan uca).

## Yapı (U1, 2026-09-25 — expo-router)

Ekran ve etkileşim kuralları: [[SPEC-WALLET-0001]] (onay ekranı, kopya seçimi, PIN/biyometri).

```
src/app/                 rotalar (yalnızca ekran; iş mantığı yok)
  _layout.tsx            sağlayıcılar + kök Stack (tema tercihi ayarlardan: karanlık varsayılan / açık / sistem)
  index.tsx              kapı → /onboarding | /lock | /(tabs)
  onboarding.tsx         3 kaydırmalı tanıtım → setup.tsx (PinPad) → (tabs)
  (tabs)/                expo-router/js-top-tabs: YATAY KAYDIRMA, çubuk altta; index Belgelerim · scan Tara · history Geçmiş · settings Ayarlar
  identity.tsx · institutions/{index,[slug]}.tsx · credential/[id].tsx
  receive/{txcode,progress,done}.tsx · review.tsx (modal) · confirm.tsx (PIN onayı, modal; iOS+Android) · sent.tsx · idv/cb.tsx
src/state/wallet.tsx     WalletProvider (durum, kilit, meşgul, confirmUser, session: geçici akış nesneleri)
src/ui/                  theme.ts · icons.ts (kategori→ikon) · index.tsx (bileşen sözlüğü)
src/{wallet,issuance,present,platform}.ts   değişmedi
(_legacy kaldırıldı 2026-09-25 — v0 tek dosya App tarihsel; gerekirse oturum raporlarından)
```
Giriş noktası `package.json` `"main": "expo-router/entry"`; `@/…` = `src/…` (tsconfig paths).
Doğrulama: `npm run check` (prettier --check + eslint + tsc) + `CI=1 npx expo export --platform ios --output-dir .expo-export-check` + `npx expo-doctor`.
Kurallar: `@react-navigation/*` doğrudan import edilmez (SDK 56+; `expo-router/js-top-tabs` vb.); geçici akış nesneleri `session.get()/set()`;
PinPad hatayı `onDone` dönüş metniyle gösterir; React Compiler lint kuralları (ref mutasyonu, efekt içinde setState) hatadır.
Durum (2026-09-25): U1–U4 yapıldı (onboarding, PIN onay ekranı, tema tercihi, kaydırmalı sekmeler, kamera yalnız odakta). Sıradaki: cihaz testi → cila.
