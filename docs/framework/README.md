# Framework — Tamga Güven Çerçevesi Belge Seti

**Cevapladığı soru:** *Bu ekosisteme kim, hangi kurallarla, hangi mimariyle katılır?*

Bu katman, Tamga Network'ün **dışa dönük, yayınlanan** belgelerini taşır. Diğer katmanlar
(project-memory, architecture, specifications, adr) mühendislik gerekçesini ve tekniği
korur; bu katman aynı kararları **kurumların, düzenleyicilerin ve entegratörlerin okuyacağı**
biçimde derler. EUDI ekosistemindeki karşılığı: ARF + Trust Framework (ulusal şema) +
Attestation Rulebook'lar.

> **İlke:** Çerçeve belgeleri karar **üretmez**, derler. Bir kural burada varsa kaynağı bir
> ADR, SPEC, PM veya INVARIANTS kodudur ve `DOC-ID/KOD` biçiminde atıf verilir. Kaynağı
> olmayan bir kural "ÖNERİ" olarak işaretlenir ve `/request-approval` yoluna girer.

---

# Belge seti

**Yayın:** `arf.tamga.network` — Tamga ARF 0.3, İngilizce + Türkçe ([[ADR-0018]]). Bu klasör Türkçe **kaynaktır**;
İngilizce çeviri `arf/` klasöründedir ve her dosya kaynağın sürümünü taşır (`npm run arf:check`). Bir belgenin sürümü
artınca aynı oturumda İngilizcesi de güncellenir.

| ID | Dosya | Ne | EUDI muadili | Sürüm / statü |
|---|---|---|---|---|
| `FW-ARF-0001` | `0001-tamga-arf.md` | **Tamga ARF** — Mimari ve Referans Çerçevesi: roller, güven modeli, yüksek seviye mimari, veri modeli, yaşam döngüleri, protokoller, fazlar, standart uyum haritası | EUDI ARF v3.0.0 | 0.2.0 · Active |
| `FW-TF-0001` | `0002-tamga-trust-framework.md` | **Tamga Trust Framework** — yönetişim çerçevesi: strateji, teknoloji, şema kuralları, uyum, sözleşmeler (World Bank 5 katman) + devir planı | Ulusal eID/EUDI güven şeması; CIR 2024/2977–2982'nin karşılığı | 0.2.1 · Active (Ek A) |
| `FW-RB-0001` | `0003-tamga-rulebook.md` | **Tamga Rulebook** — katılımcı kuralları: her rol için bağlayıcı, numaralı kurallar (RB-*) ve kaynak atıfları | ARF Annex 2 HLR (rol bazlı) | 0.2.0 · Active (Ek B) |
| `FW-RB-0002` | `0004-attestation-rulebook-education.md` | **Attestation Rulebook — Eğitim**: `urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1` | ARF Annex 3 Attestation Rulebook (PID Rulebook deseni) | 0.1.1 · Active (Ek C) |
| `FW-RB-0003` | `0005-attestation-rulebook-identity.md` | **Attestation Rulebook — Tamga Kimlik Belgesi**: `urn:tamga:id:IdentityAttestation:1` | ARF PID Rulebook deseni (PID değil, EAA) | 0.1.1 · Draft (Ek C) |
| `FW-RB-0004` | `0006-attestation-rulebook-event-ticket.md` | **Attestation Rulebook — Etkinlik Bileti**: `urn:tamga:tkt:EventTicket:1` | ARF Annex 3 Attestation Rulebook | 0.1.0 · Draft (Ek C) |

Planlı: `FW-RISK-0001` Tamga Risk Register (ARF R1–R14 türevi, `docs/beta/05` R-40);
`FW-RB-0005+` diğer attestation rulebook'ları (tüzel kişilik, oda üyeliği) — `SPEC-SCHEMA-0003`
kontrol listesi (SG1–SG7) geçildikçe.

---

# Document ID

```text
FW-<DOMAIN>-<NUMBER>
```

Domainler: `ARF` (mimari çerçeve), `TF` (trust framework / yönetişim), `RB` (rulebook),
`RISK` (risk kütüğü). Bkz. `DOCUMENTATION-STANDARD.md` §Document ID Convention (v1.1.0).

---

# Yayın

- **Kaynak:** bu klasör, CC BY 4.0 (`LICENSE-docs`). Değişiklik = sürüm artışı + `CHANGELOG`
  bölümü (her belgenin sonunda).
- **Web:** **`https://arf.tamga.network`** — Tamga ARF ([[ADR-0018]]); İngilizce kök, Türkçe `/tr/`. `arf/` VitePress ile
  derlenir (`npm run arf:build`); Türkçe sayfalar bu klasörden üretilir (`scripts/arf-sync.mjs`), İngilizce `arf/*.md`
  elle çevrilir ve kaynağın sürümünü taşır (`npm run arf:check`). Nginx bloğu operatör deposunda (`arf.tamga.network`).
- **Yayın düzeni:** bir belgenin sürümü artınca → İngilizcesi güncellenir → `arf/releases.json`'da yeni yayın kaydı (ya da
  henüz yayınlanmamış güncel yayının kaydı güncellenir) → `npm run arf:snapshot` → `npm run arf:check`. Eski yayınlar
  `arf/archive/` altında dondurulmuş kalır; site sürüm menüsü ve "ne değişti" sayfasını bunlardan üretir.
- **PDF:** sürüm etiketlendiğinde Typst ile (tamga-web whitepaper hattı) — planlı.
- **Dil:** Türkçe kaynak; İngilizce aynı sürümün resmî çevirisi (TDT üyeleri ve AB muhatapları için).
- **Atıf:** güven listelerindeki `operator.trust_framework` alanı bu belgenin yayın URL'ine
  işaret eder (`docs/delivery/04-TRUST-LIST-FORMAT.md` §2).

---

# Statü ve onay

Set, DB-12 ("Tamga Trust Framework belgesi") kararının uygulamasıdır; **v0.1.0 2026-09-24'te kabul edildi (D-GOV-6)**; eskiden: taslaktı ve
onay beklemektedir**. Onay kayıtları operatörün arşivindedir. Kanonik olarak
kabulle birlikte `review_status: Completed` olur ve MASTER_INDEX'te "Framework" katmanı
altında "Active" görünür.

Değişiklik kuralı: bir ADR kabul edildiğinde etkilenen çerçeve belgesi aynı oturumda güncellenir
(DECISIONS §10.7 listesindeki "Trust Framework" maddesi bu klasörü kasteder).
