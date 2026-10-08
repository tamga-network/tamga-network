# Framework — Tamga Güven Çerçevesi Belge Seti

**Cevapladığı soru:** *Bu ekosisteme kim, hangi kurallarla, hangi mimariyle katılır?*

Bu katman, Tamga Network'ün **dışa dönük, yayınlanan** belgelerini taşır. Diğer katmanlar
(project-memory, architecture, specifications, adr) mühendislik gerekçesini ve tekniği
korur; bu katman aynı kararları **kurumların, düzenleyicilerin ve entegratörlerin okuyacağı**
biçimde derler. EUDI ekosistemindeki karşılığı: ARF + Trust Framework (ulusal şema) +
ana rulebook ve belge türü rulebook'ları.

> **İlke:** Çerçeve belgeleri karar **üretmez**, derler. Bir kural burada varsa kaynağı bir
> ADR, SPEC, PM veya INVARIANTS kodudur ve Ek E'de `DOC-ID/KOD` biçiminde atıf verilir. Kaynağı
> olmayan bir madde kural olarak yazılmaz: proje yönetimi kararıyla kurala dönüşür ya da ilgili belgenin "Açık konular"
> bölümüne girer. Kamuya açık metinde iç kodlar (sapma, karar tablosu, inceleme kodları) yer almaz.

---

# Belge seti

**Yayın:** `arf.tamga.network` — Tamga ARF 1.0, İngilizce + Türkçe ([[ADR-0018]]). Bu klasör Türkçe **kaynaktır**;
İngilizce çeviri `arf/` klasöründedir ve her dosya kaynağın sürümünü taşır (`npm run arf:check`). Bir belgenin sürümü
artınca aynı çalışmada İngilizcesi de güncellenir.

| ID | Dosya | Ne | EUDI muadili | Sürüm / statü |
|---|---|---|---|---|
| `FW-ARF-0001` | `0001-tamga-arf.md` | **Mimari ve Referans Çerçevesi** (ana belge): kullanım durumları, roller, mimari, veri modeli, güven modeli, güvenlik, yönetişim | EUDI ARF | 1.0.0 · Active |
| `FW-TF-0001` | `0002-trust-framework.md` | **Ek A — Trust Framework**: yönetişim, katılım kapıları, uyum, sözleşmeler, devir planı | Ulusal eID/EUDI güven şeması; CIR 2024/2977, 2979, 2980, 2981 ve 2982'nin karşılığı | 1.0.0 · Active |
| `FW-RB-0001` | `0003-tamga-rulebook.md` | **Ek B — Tamga Rulebook** (ana rulebook): bütün katılımcılar ve belge türleri için ortak, numaralı kurallar (RB-*) | ARF Annex 2 HLR (rol bazlı) | 1.0.0 · Active |
| `FW-RB-0002` | `0004-education-rulebook.md` | **Education Rulebook** (Ek C): `urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1` | ARF Annex 3 attestation rulebook | 1.0.0 · Active |
| `FW-RB-0003` | `0005-identity-rulebook.md` | **Identity Rulebook** (Ek C): `urn:tamga:id:IdentityAttestation:1`, `urn:tamga:id:DrivingLicenceAttestation:1` | ARF PID Rulebook deseni (PID değil, EAA) | 1.0.0 · Active |
| `FW-RB-0004` | `0006-event-ticket-rulebook.md` | **Event Ticket Rulebook** (Ek C): `urn:tamga:tkt:EventTicket:1` | ARF Annex 3 attestation rulebook | 1.0.0 · Active |
| `FW-DEF-0001` | `0007-definitions.md` | **Ek D — Tanımlar** | ARF Annex 1 | 1.0.0 · Active |
| `FW-REF-0001` | `0008-references.md` | **Ek E — Kaynaklar**: standartlar, karar kayıtları, kural kaynakları | — | 1.0.0 · Active |
| `FW-READ-0001` | `0009-reading-path.md` | **Okuma yolu**: rol başına okuma sırası (ARF, sonra geliştirici belgeleri) | — | 1.0.0 · Active |
| `FW-ROLE-0001` | `0010-roles.md` | **Roller**: her rolün işi, bugün kimin üstlendiği, kuralları, ihtiyaçları | — | 1.0.0 · Active |
| `FW-ONB-0001` | `0011-onboarding.md` | **Katılım süreci**: rol başına adımlar, belgeler, inceleme, listeye giriş, askı ve çıkış | — | 1.0.0 · Active |

Belge türü rulebook'ları Tamga Rulebook'tan dallanır: ortak kuralların hepsini devralır, yalnızca türe özgü kuralları ekler.

Planlı: `FW-RISK-0001` Tamga Risk Register (ARF R1–R14 türevi);
`FW-RB-0005+` diğer belge türü rulebook'ları (tüzel kişilik, oda üyeliği) — `SPEC-SCHEMA-0003`
kontrol listesi (SG1–SG7) geçildikçe.

---

# Document ID

```text
FW-<DOMAIN>-<NUMBER>
```

Domainler: `ARF` (mimari çerçeve), `TF` (trust framework / yönetişim), `RB` (rulebook), `DEF` (tanımlar), `REF`
(kaynaklar), `READ` (okuma yolu), `ROLE` (roller), `ONB` (katılım süreci), `RISK` (risk kütüğü). Bkz. `CONTRIBUTING.md` (Belgeler — kimlik).

---

# Yayın

- **Kaynak:** bu klasör, CC BY 4.0 (`LICENSE-docs`). Değişiklik = sürüm artışı; sürüm notları
  yayın kaydında (`arf/releases.json`).
- **Web:** **`https://arf.tamga.network`** — Tamga ARF ([[ADR-0018]]); İngilizce kök, Türkçe `/tr/`. `arf/` VitePress ile
  derlenir (`npm run arf:build`); Türkçe sayfalar bu klasörden üretilir (`scripts/arf-sync.mjs`), İngilizce `arf/*.md`
  elle çevrilir ve kaynağın sürümünü taşır (`npm run arf:check`). Nginx bloğu operatör deposunda (`arf.tamga.network`).
- **Yayın düzeni:** bir belgenin sürümü artınca → İngilizcesi güncellenir → `arf/releases.json`'da yeni yayın kaydı →
  `npm run arf:snapshot` → `npm run arf:check`. Yayınlar `arf/archive/` altında dondurulur; site sürüm menüsü ve "ne değişti"
  sayfasını bunlardan üretir. İlk yayın 1.0'dır (2026-10-02).
- **PDF:** sürüm etiketlendiğinde Typst ile (tamga-web whitepaper hattı) — planlı.
- **Dil:** Türkçe kaynak; İngilizce aynı sürümün resmî çevirisi (TDT üyeleri ve AB muhatapları için).
- **Atıf:** güven listelerindeki `operator.trust_framework` alanı bu belgenin yayın URL'ine
  işaret eder.

---

# Statü ve onay

Set, DB-12 ("Tamga Trust Framework belgesi") kararının uygulamasıdır ve D-GOV-6 ile kabul edildi. Onay kayıtları
operatörün arşivindedir. Bütün belgeler 1.0.0 sürümünde ve "Active" durumdadır.

Değişiklik kuralı: bir ADR kabul edildiğinde etkilenen çerçeve belgesi aynı oturumda güncellenir
(DECISIONS §10.7 listesindeki "Trust Framework" maddesi bu klasörü kasteder).
