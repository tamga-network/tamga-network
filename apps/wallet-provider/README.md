# apps/wallet-provider — Tamga Wallet Provider (wallet.tamga.network)

> **Geçici olarak burada.** Bu servis Tamga Wallet'a aittir; cüzdan deposuna (`provider/`) taşınacak. Taşınana kadar burada çalışır.

Cüzdan sağlayıcısı (ADR-0025, AB TS3): cüzdan birimini kaydeder, kısa ömürlü **Cüzdan Örneği Kanıtı** (WIA) ve belge
anahtarları için **Anahtar Kanıtı** (KA, `key_attestation`) verir, ikisi için iptal listesi yayınlar. Kişisel veri tutmaz.
Belge veren kurum, ihraçta WIA ve KA'yı güven listesindeki sağlayıcı anahtarıyla doğrular.

```bash
npm run wallet-provider   # :4005; env: TAMGA_WP_BASE, TAMGA_WP_PORT, TAMGA_PKI_DIR, TAMGA_WP_DATA_DIR,
                          # cihaz kanıtı: TAMGA_WP_ANDROID_PACKAGE, TAMGA_WP_APPLE_APP_ID, TAMGA_WP_DEVICE_DEV (yalnız geliştirme)
```

| Uç | Ne |
|---|---|
| `POST /units/challenge` | Cihaz kanıtı için tek kullanımlık meydan okuma (5 dk) |
| `POST /units` | Birim kaydı: birim anahtarıyla imzalı kanıt + isteğe bağlı cihaz kanıtı (Android anahtar kanıtı / Apple App Attest) → `{unit_id, key_storage}` |
| `POST /wia` | 24 saatten kısa ömürlü WIA — her belge işleminde yeni anahtar ve yeni iptal girişi |
| `POST /ka` | Anahtar Kanıtı: belge anahtarları ve **doğrulanmış** depo seviyesi |
| `POST /units/revoke` | Kişinin isteğiyle birim iptali (bütün WIA girişleri iptal edilir): cihazdan imzalı kanıtla **ya da** telefonsuz, yalnız kapatma koduyla (`revocation_code`; Tamga Wallet WA-ADR-0002) |
| `POST /units/revocation-code` | Kapatma kodunun ön özetini birime bağlar (imzalı kanıt). Sunucuda yalnız scrypt yavaş özeti; kod ve ön özet tutulmaz, günlüğe yazılmaz |
| `POST /units/status` | Yalnız ipucu: `active` / `revoked` (imzalı kanıt). Telefon silme kararını buna değil imzalı `GET /status/wia` listesindeki kendi WIA girişine bakarak verir (çekim kimliksiz) |
| `GET` · `POST /lost` | "Telefonumu kaybettim" sayfası (TR/EN; `?lang=`): kod + geri alınamaz onayı → iptal. Kişisel veri istenmez/gösterilmez; `no-store`, çerçeve yok, dış betik yok; genel deneme sayacı YOK (DoS), eşzamanlı scrypt üst sınırı (`503` + `Retry-After`); IP başına dakika sınırı nginx'te; form gövdesi yalnız bu rotada |
| `GET /status/wia` · `GET /status/ka` | İptal listeleri (Token Status List; imzacı = sağlayıcı anahtarı) |
| `GET /.well-known/wallet-provider` | Sağlayıcı kimliği, çözümler, imza sertifikası parmak izi |
| `GET /` · `GET /healthz` | Trust Mark sayfası · sağlık |

**Depo seviyesi dürüsttür:** cihaz kanıtı doğrulanmadıkça birim `software` sayılır ve KA bunu `iso_18045_basic` olarak
bildirir; doğrulanmamış bir cihaz beyanı kabul edilmez. Cihaz kanıtı doğrulaması (`src/device-attestation.ts`) mağaza
sürümüyle zorunlu olur.
