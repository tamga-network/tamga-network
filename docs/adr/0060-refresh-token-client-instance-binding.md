---
document_id: ADR-0060
title: "Yenileme belirteci istemci örneği anahtarına bağlı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  Yenileme belirteci (kurum belgelerinin sessiz yenilemesi ADR-0023 ve kimlik servisinin ZK kopyası belirteci ADR-0044) artık
  DPoP anahtarına değil, ilk ihraçtaki istemci kanıtının (WIA) `cnf` anahtarına — istemci örneği anahtarına — bağlıdır
  (OAuth 2.0 Attestation-Based Client Authentication §10.3; RFC 9449 §5). Yenilemede o anahtarlı taze WIA zorunludur; DPoP
  anahtarı değişebilir, yeni erişim belirteci yeni DPoP anahtarına bağlanır. Cüzdan her işlemde yeni WIA anahtarı kullanmayı
  sürdürür (ADR-0025 K6: kurumlar cüzdanı birbirine bağlayamaz); yenileme belirteci alan belgenin işlemindeki WIA anahtarını
  belgeyle saklar ve yenilemede sağlayıcıdan bu anahtara taze WIA ister. ADR-0023 ve ADR-0044 K3'teki "DPoP anahtarına bağlı"
  kuralını değiştirir. Kabul: 2026-10-22.
domain: Protocol
related: ["[[ADR-0023]]", "[[ADR-0025]]", "[[ADR-0044]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Bağlam

- **Standart.** RFC 9449 §5: kimliği doğrulanan istemcinin yenileme belirteci DPoP anahtarına bağlanmaz, istemciye bağlıdır; DPoP
  anahtarı yenilemede değişebilir. OAuth 2.0 Attestation-Based Client Authentication (taslak -07) §10.3: istemci kanıtıyla kimliği
  doğrulanan istemcide yetkilendirme sunucusu yenileme belirtecini **istemci örneği anahtarına** (kanıttaki `cnf`) bağlar; başka
  örnek anahtarıyla yenileme reddedilir.
- **Bugün.** Tamga'da yenileme belirteci ilk ihraçtaki DPoP anahtarına bağlıydı ([[ADR-0023]], [[ADR-0044]] K3); WIA her işlemde
  yeni anahtarla alınır ([[ADR-0025]] K6), bu yüzden bağ DPoP anahtarına kurulmuştu.
- **OpenID uyum öz-testi (2026-10-21, bulgu G12).** FAPI 2.0 `refresh-token` modülü yenilemeyi yeni DPoP anahtarıyla ve aynı istemci
  kanıtıyla yapar (geçmeli), sonra başka örnek anahtarlı kanıtla ve eski DPoP anahtarıyla dener (reddedilmeli). Bizim bağımız
  ikisinde de ters sonuç veriyordu.

# Karar

## K1 — Bağ istemci örneği anahtarı
Yenileme belirteci, verildiği işlemdeki istemci kanıtının (WIA) `cnf.jwk` anahtarının RFC 7638 parmak izine bağlanır. Yenilemede
sunulan WIA'nın `cnf` anahtarı aynı olmalıdır; değilse `invalid_grant`. DPoP kanıtı yine zorunludur (anahtar değişebilir); yeni
erişim belirteci yeni DPoP anahtarına bağlanır.

## K2 — Cüzdan örnek anahtarını belgeyle saklar
WIA her işlemde yeni anahtarla alınmaya devam eder (ADR-0025 K6). Yenileme belirteci veren işlemde kullanılan WIA anahtarı belgenin
yenileme bağına yazılır (`instanceKeyRef`) ve silinmez; yenilemede cüzdan sağlayıcıdan **bu anahtara** taze (< 24 saat) WIA
ister. Anahtar yalnız o belgeyi veren kuruma gösterilir; başka kurumlar başka anahtarlar görür (bağlanamazlık korunur). Belge
silinince anahtar da silinir (başka bağda ya da cüzdanın o anki WIA'sında kullanılmıyorsa).

## K3 — Kapsam
Kurum issuer'ının yenileme belirteci ([[ADR-0023]]) ve kimlik servisinin ZK kopyası belirteci ([[ADR-0044]] K3). Eski (DPoP
bağlı) belirteçler geçerliliğini yitirir (geliştirme evresi, [[ADR-0029]]); cüzdan sonraki belge alışında yenisini alır.

# Değerlendirilen seçenekler

- **DPoP bağı kalsın.** Standarda göre gerekli değil; test aracının iki kontrolü başarısız kalır.
- **DPoP ya da örnek anahtarı (ikisinden biri).** ATCA §10.3'ün "başka örnek anahtarıyla ret" kuralını karşılamaz.
- **Cüzdanın tek kalıcı örnek anahtarı.** Bütün kurumlar aynı anahtarı görürdü — ADR-0025 K6'ya aykırı (bağlanabilirlik).
- **Seçilen:** belge başına örnek anahtarı — standart bağ + kurumlar arası bağlanamazlık.

# Değişmezler

| Kod | Kural |
|---|---|
| RT1 | Yenileme belirteci istemci örneği anahtarına (ihraçtaki WIA `cnf` parmak izi) bağlıdır; yenilemede aynı anahtarlı WIA zorunludur. |
| RT2 | Yenilemede DPoP kanıtı zorunludur; yeni erişim belirteci o istekteki DPoP anahtarına bağlanır. |
| RT3 | Cüzdan yenileme bağının örnek anahtarını yalnız o belgeyi veren kurumla kullanır; başka işlemlerde yeni WIA anahtarı kullanır. |

# Uygulama

- `@tamga-network/issuer` 0.7.2: `clientInstanceJkt`. wallet-core 0.7.2: `RefreshBinding.instanceKeyRef`,
  `ZkCopyBinding.instanceKeyRef`, `wuaForBinding`, `autoRefreshCredential` / `refreshZkCopies` `wuaForInstance`,
  `instanceKeysInUse`; `removeCredential` bağın anahtarını da siler.
- Platform: kurum issuer'ı `refresh_tokens.instance_jkt` (şema adımı 11) ve yenilemede örnek anahtarı denetimi; kimlik servisi
  ZK belirtecinde `ijk`.
- Cüzdan (Tamga Wallet): sağlayıcı protokolü `requestWia({ keyRef })` (var olan anahtara WIA), bağlı anahtarlar WIA değişiminde
  silinmez.
- Şartname: [[SPEC-PROTO-0001]] §4.1–4.2.

# Durum

**Accepted — 2026-10-22.** Proje yönetimi onayıyla (OpenID uyum öz-testi bulgusu G12). DECISIONS: D-PROTO-4.
