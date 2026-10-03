# Belge Standardı

**Sürüm:** 1.0.0 (2026-10-02) · **Kapsam:** bu depodaki bütün Markdown belgeleri (docs.tamga.network ve arf.tamga.network kaynakları)

Belgeler bir rehber gibi okunur: **sadeden başlar, derine iner.** Bu standart belgelerin nerede durduğunu, nasıl adlandırıldığını,
nasıl yazıldığını ve iki dilde nasıl tutulduğunu tanımlar.

---

# 1. Klasörler

Klasörler okurun amacına göre ayrılır. Adlar (dosya, klasör, adres) İngilizcedir; içerik Türkçedir ve İngilizce çevirisi vardır.

| Klasör | Ne için | Sitede |
|---|---|---|
| `docs/guides/` | Başlarken: adım adım rehberler (GUIDE-*) | evet |
| `docs/concepts/` | Kavramlar: sade anlatım, kod ve kural kodu yok | evet |
| `docs/specifications/` | Şartnameler: kesin kurallar (SPEC-*) | evet |
| `docs/adr/` | Kararlar (ADR-*), konu grubuyla (`domain`) | evet |
| `docs/architecture/` | Bileşen mimarisi (ARCH-*) | kısmen |
| `docs/framework/` | Tamga ARF ve ekleri (FW-*) — arf.tamga.network | ARF sitesinde |
| `docs/glossary.md` | Sözlük | evet |
| `docs/background/` | Gerekçe (PM-*) ve araştırma (RS-*) | hayır |
| `docs/ledger/` | Zincir aşaması — bugün kullanılmıyor ([[ADR-0009]]) | hayır |
| `docs/_internal/`, `docs/_archive/` | İç kayıtlar ve arşiv — public depoya girmez | hayır |
| `docs/en/` | İngilizce çeviriler (Türkçe kaynakla aynı yol) | evet, kökte |

Dosya adı kısa ve İngilizcedir: `specifications/identity-proofing.md`, `guides/verify-on-server.md`. ADR'ler numarasıyla:
`adr/0031-per-site-pseudonyms.md`. Klasör kökü `index.md`'dir.

# 2. Kimlik

Her belgenin kalıcı bir kimliği (`document_id`) vardır; klasör, dosya adı ya da başlık değişse de kimlik değişmez.
Belgeler birbirine kimlikle bağlanır: `[[SPEC-CRED-0003]]`; bir kurala `[[SPEC-CRED-0003]]/S1`.

| Önek | Tür | Örnek |
|---|---|---|
| `GUIDE-NNNN` | rehber | GUIDE-0002 |
| `SPEC-<ALAN>-NNNN` | şartname | SPEC-PROTO-0002 |
| `ADR-NNNN` | karar | ADR-0031 |
| `ARCH-NNNN` | mimari | ARCH-0003 |
| `FW-<ALAN>-NNNN` | çerçeve belgesi (ARF, Trust Framework, rulebook) | FW-RB-0002 |
| `PM-<ALAN>-NNNN` · `RS-<KONU>-NNNN` | gerekçe · araştırma | PM-ASSUR-0001 |

Alan kısaltmaları: `ID` kimlik · `TRUST` güven · `CRED` belge biçimi · `SCHEMA` şema · `PROTO` protokol · `API` · `WALLET` ·
`BC` zincir · `ARF` · `TF` Trust Framework · `RB` rulebook.

Çerçeve belgeleri (FW-*) **karar üretmez**: kuralları ADR/SPEC kaynaklarından derler, kendi kurallarını `RB-<ROL>-<NN>`
biçiminde numaralar. Tamga Rulebook ([[FW-RB-0001]]) bütün katılımcılar ve belge türleri için ortak kuralları taşır; her belge
türünün rulebook'u (Education, Identity, Event Ticket) ondan dallanır.

# 3. Ön bilgi (front matter)

```yaml
---
document_id: SPEC-ID-0003
title: "Kimlik ispatı"
status: Active            # Draft · Active · Deprecated  (ADR: Proposed · Active · Superseded)
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-02
summary: >
  Bir-iki cümle: belge ne anlatır, kimin işine yarar.
domain: Identity          # yalnız ADR: Trust · Credentials · Identity · Wallet · Services · Governance
---
```

İngilizce çeviride ayrıca `translation_of: <document_id>` ve `source_version: <Türkçe kaynağın sürümü>` bulunur; `document_id`
aynı kalır, `title` ve `summary` İngilizcedir.

# 4. Başlık

- **En fazla 6 kelime / 45 karakter**, alt başlık ("— …") yok; ayrıntı `summary`'ye.
- İç kısaltma ve süreç adı yok ("Faz B", "WL4", "D-ID-2"). Standart adı olabilir: "OpenID4VP profili".
- Kenar çubuğu ve sekme başlığı aynı addır (site `title`'ı kullanır).

# 5. Sayfa iskeleti

1. **Bir cümle:** bu belge ne, kimin işine yarar.
2. **Ne zaman okunur:** önce ne okunmalı, sonra nereye gidilir (2–3 madde).
3. **Sade anlatım:** kavram, akış ya da şekil — kod ve kural kodu yok.
4. **Adımlar / kurallar:** kural kodu ilk geçtiği yerde kısa açıklamasıyla.
5. **Derinlik:** ayrıntı, kenar durumları, standarda atıf.
6. **Durum:** tek satır — "**Yürürlükte** — sürüm 1.0.0 (tarih)".

Şartnamelerde kural tabloları ve değişmezler tam ve kesin yazılır; iskelet girişi ve akışı düzenler.

# 6. Terimler (karma kural)

Türkçe metin **Türkçe okunur**; İngilizce terim cümlenin içine melez tamlama olarak girmez ("registration certificate
sağlayıcısı" yazılmaz). Kural iki gruba ayrılır:

| Grup | Türkçe metinde | Örnek |
|---|---|---|
| **Rol ve gündelik kavram** | Türkçe yazılır; ilk kullanımda İngilizce terim parantezde | belge (credential), belge veren (issuer), doğrulayıcı (verifier), belge sahibi (holder), cüzdan sağlayıcısı (wallet provider), güven listesi (trust list), iptal listesi (status list), kayıt sertifikası (registration certificate), takma ad (pseudonym), kimlik doğrulama (identity proofing) |
| **Teknik, kriptografik, protokol terimi ve kısaltma** | İngilizce kalır; kısaltmanın açılımı ilk kullanımda | salted hash, disclosure, selective disclosure, nonce, holder binding, key binding, proof of possession, attestation, relying party, wallet unit, PID, EAA, QTSP (Qualified Trust Service Provider), SD-JWT VC, OpenID4VP |

İngilizce metinde bütün terimler İngilizcedir.

**Yazım.** Terimin sayfadaki ilk kullanımı ipucuyla yazılır: `[[t:trust-list]]`. Türkçe sayfada "güven listesi (trust list) ⓘ",
İngilizce sayfada "trust list ⓘ" görünür; kısaltmada açılım: "QTSP (Qualified Trust Service Provider) ⓘ". (i) üzerine gelince ya
da dokununca okurun dilindeki kısa açıklama açılır. Türkçe çekim için: `[[t:trust-list|güven listesinde]]`; İngilizce terime ek
gerekirse kesme işaretiyle: `[[t:PID|PID'in]]`. Sonraki kullanımlar düz yazılır. Başlıkta, tabloda, kod örneğinde ve `[[ID]]`
atfında ipucu kullanılmaz.

Terimler tek kaynakta: `docs/.vitepress/terms.json` (docs ve ARF ortak). Her terimde `label` (İngilizce), varsa `tr_label`
(Türkçe metindeki karşılığı — rol ve gündelik kavram grubu), kısaltmada `expansion`, `en` ve `tr` açıklama bulunur. Yeni terim
önce oraya eklenir; hangi gruba gireceği orada `tr_label` ile belirlenir.

# 7. Diller

- **docs.tamga.network:** İngilizce kökte, Türkçe `/tr/` altında. Türkçe metin kaynaktır (`docs/<yol>`); İngilizce çeviri
  `docs/en/<aynı yol>`. Çeviri, kaynağın sürümünü `source_version` ile taşır; kaynak değişince çeviri aynı çalışmada
  güncellenir (`npm run docs:check` denetler).
- **arf.tamga.network:** İngilizce kökte, Türkçe `/tr/` altında; Türkçe kaynak `docs/framework/`, İngilizce `arf/`
  (`npm run arf:check`).
- Site içi bağlantı İngilizce yolla yazılır (`/guides/code-examples`); Türkçe sayfada `/tr/` öneki kendiliğinden eklenir.

# 8. Sürümler

- Her belge SemVer taşır. **1.0.0 ilk yayındır (2026-10-02).** Anlamı değiştirmeyen düzeltme yama (`1.0.1`), yeni kural ya da
  bölüm ara sürüm (`1.1.0`), uyumu bozan değişiklik ana sürüm (`2.0.0`).
- Değişiklik geçmişi belgenin içinde tutulmaz: belge değişiklikleri depo kökündeki `CHANGELOG.md`'ye, ARF yayınları
  `arf/releases.json` ve "What changed" sayfasına yazılır.
- Kapatılmış bir karar ancak yeni bir ADR ile değişir; eski ADR silinmez, `Superseded` olur.

# 9. Bağlayıcı kurallar (değişmezler)

Şartname ve kararlardaki bağlayıcı kurallar başlığında "Değişmez" geçen bölümlerde `| **KOD** | metin |` tablolarıyla yazılır.
Kod belge kapsamlıdır: belge içinde `S1`, dışarıdan `[[SPEC-CRED-0003]]/S1`. Doğrulama hattının adım kodları (`A1…E4`) değişmez
değildir. Bütün kurallar `INVARIANTS.md`'de toplanır — **üretilen** dosyadır (`node scripts/sync-invariants.mjs`); çakışma
bölümü boş kalır. Belge dizini `MASTER_INDEX.md` de üretilir (`npm run docs:index`).

# 10. Kamuya açık metin

Yayınlanan belgelerde kişi adı, araç adı, iç kayıt yolu ve özel depo yolu bulunmaz; kararlar "proje yönetimi" onayıyla anılır.
`npm run docs:check` ve `npm run arf:check` denetler.
