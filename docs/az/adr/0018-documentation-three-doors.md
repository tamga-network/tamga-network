---
document_id: ADR-0018
title: "Sənədlərin üç qapısı"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Xarici auditoriyaya yönəlik sənədlər, Avropa İttifaqındakı (Aİ) quruluş kimi, üç ayrı qapıdan dərc olunur: ümumi izah (tamga.network/docs), tərtibatçı sənədləri (docs.tamga.network) və Tamga ARF (arf.tamga.network — arxitektura və istinad çərçivəsi və onun əlavələri). Tamga ARF ingilis və türk dillərində dərc olunur; türkcə mətn mənbə olaraq qalır, ingiliscə mətn eyni versiyanın rəsmi tərcüməsidir və versiya uyğunsuzluğu yığım (build) zamanı aşkarlanır. D-GOV-6-nın dərc sətrini dəyişir.
domain: Governance
translation_of: ADR-0018
source_version: "1.0.0"
---

# Kontekst

D-GOV-6 (2026-09-24) çərçivə sənədləri toplusunu (Tamga ARF, [[t:trust-framework|Trust Framework]], [[t:rulebook|Rulebook]], [[t:attestation]] rulebook-ları) müəyyən etdi və
dərc yerini `docs.tamga.network` kimi təyin etdi. Hazırkı vəziyyət:

- `tamga.network/docs` ümumi izahla tərtibatçı səhifələrini (inteqrasiya, kod) qarışdırır.
- `docs.tamga.network` hər şeyi bir yerdə təqdim edir: çərçivə sənədləri, bələdçilər, spesifikasiyalar, ADR-lər, daxili iş
  qeydləri (təhvil, Faza B təhlili). Tənzimləyici və ya qurum üçün [[t:ARF]] bu qarışıqlıqda itir.
- Aİ-də eyni ehtiyac üç ayrı yerlə qarşılanır: vətəndaş/qurum üçün izah (Komissiyanın saytı), tərtibatçı mərkəzi və **ARF**
  (ayrı, versiya nömrəli, ingiliscə nəşr; əlavələri: yüksək səviyyəli tələblər, attestation rulebook-ları).

Layihə rəhbərliyinin istəyi (2026-09-27): sənədlər Aİ-dəki kimi ayrılsın — ümumi sənədlər, tərtibatçı sənədləri və bir ARF.

# Qərar

## K1 — Üç qapı

| Qapı | Ünvan | Oxucu | Məzmun |
|---|---|---|---|
| **Ümumi** | `tamga.network/docs` (tamga-web, üç dil) | qurum, qərar verən, vətəndaş | anlayışlar, e-şəxsiyyət və eIDAS, Tamga Wallet, necə işləyir, ssenarilər, lüğət |
| **Tərtibatçı** | `docs.tamga.network` (VitePress, `tamga-network/docs`) | proqramçı, inteqrator | bələdçilər, kod nümunələri, paketlər, spesifikasiyalar, ADR-lər, qeydlər |
| **Tamga ARF** | `arf.tamga.network` (VitePress, `tamga-network/arf`) | tənzimləyici, qurum, auditor | əsas sənəd (FW-ARF-0001) + Əlavə A Trust Framework + Əlavə B iştirakçı qaydaları + Əlavə C attestation rulebook-ları |

Hər qapı digər ikisinə görünən keçid verir. Çərçivə sənədlərinin **yeganə ictimai yeri** `arf.tamga.network` ünvanıdır;
`docs.tamga.network` onları yenidən dərc etmir, `[[FW-*]]` istinadlarını ARF saytına bağlayır.

## K2 — Ad və domen adı

İctimai ad — **"Tamga ARF"** (açılışı: Arxitektura və İstinad Çərçivəsi / Architecture and Reference Framework). Yeni alt domen
adı — `arf.tamga.network` (statik; D-NAME-1 xidmət siyahısına sənəd nəşri kimi əlavə olunur, şəbəkə xidməti deyil).

## K3 — Dil və mənbə

- Tamga ARF **ingilis + türk** dillərində dərc olunur; kök səhifə ingiliscədir (`/`), türkcə — `/tr/`.
- **Mənbə türkcədir:** `docs/framework/*.md` (DOC-ID istinadları, MASTER_INDEX, təsdiq prosesi buradadır). Türkcə səhifələr yığım zamanı
  bu fayllardan yaradılır.
- İngiliscə `arf/*.md` əl ilə tərcümə olunur; hər fayl `translation_of` və `source_version` daşıyır. Mənbə versiyası artıb tərcümə
  yenilənməzsə, yığım dayanır (`npm run arf:check`, CI).
- Ziddiyyət olduqda türkcə mənbə əsas götürülür; bu, hansısa dövlət və ya şura sənədi öz üzərinə götürdükdə yenidən qiymətləndirilir
  ([[FW-TF-0001]] §7).

## K4 — Versiya

Tamga ARF **buraxılış nömrəsi** daşıyır (məs. "Tamga ARF 1.0"); hər sənədin öz versiyası da ayrıca görünür. Buraxılış nömrəsi
toplunun istənilən sənədində MINOR və ya MAJOR artım olduqda yüksəlir; versiya tarixçəsi ARF saytında hamı üçün açıqdır.

# Nəzərdən keçirilmiş variantlar

| Seçim | Üstünlük | Çatışmazlıq | Nəticə |
|---|---|---|---|
| Hamısı `tamga.network` altında (`/docs`, `/developers`, `/arf`) | bir sayt, yeni domen adı yoxdur | ARF təqdimat saytının bir hissəsi kimi görünür; iki fərqli nəşr aləti bir saytda | rədd |
| Ayrı ünvanlar, tərtibatçı üçün də yeni domen adı | ən təmiz ayrılma | iki yeni domen adı; `docs.tamga.network` keçidləri qırılır | rədd |
| **Ayrı ünvanlar; tərtibatçı `docs.` qalır, ARF `arf.`** | Aİ quruluşuna ən yaxın; ARF rəsmi sənəd kimi görünür; mövcud keçidlər qorunur | bir yeni alt domen adı | **seçildi** |
| ARF yalnız türkcə | sürətli | beynəlxalq oxucu (Aİ, TDT dövlətləri) ingiliscə oxuyur | rədd |
| ARF üç dildə (EN/TR/TK) | saytın qalan hissəsi ilə eyni | ən çox iş; türkməncə mətnin ayrıca yoxlanılması lazımdır | sonraya |

# Nəticələr

- `tamga-network/arf/` (VitePress, iki dil) + `scripts/arf-sync.mjs` (türkcə mənbədən yaradılma, `--check` versiya yoxlaması).
- `docs.tamga.network` tərtibatçı sənədləri kimi yenidən təşkil olunur; çərçivə bölməsi ARF-ə bağlanır.
- `tamga-web`: menyu və alt hissə (footer) üç qapını göstərir; `/docs` ümumi izahda qalır.
- `ops` (operator deposu): nginx `arf.tamga.network` bloku, `deploy.sh` yığım + nəşr; DNS qeydi (operator).
- D-GOV-6-nın "Dərc" sətri bu ADR-ə bağlanır (DECISIONS "Dəyişdirilmiş Qərarlar").
- K4-ün tətbiqi: buraxılışların qeydi — `arf/releases.json`; hər buraxılış `arf/archive/<yayın>/` altında dondurulur (`npm run arf:snapshot`)
  və `/v<yayın>/` ünvanında oxunaqlı qalır; saytda versiya menyusu ("latest" etiketi) və buraxılışlar arasında sətir fərqi səhifəsi
  (`/changes`). `arf:check` buraxılış qeydi ↔ sənəd versiyaları ↔ arxiv uyğunluğunu da yoxlayır.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| DY1 | Çərçivə sənədlərinin (FW-*) yeganə ictimai dərc yeri Tamga ARF saytıdır; başqa sayt onların surətini dərc etmir, keçid verir. |
| DY2 | Tamga ARF-in ingiliscə tərcüməsi türkcə mənbənin eyni versiyasını daşıyır; versiya fərqi olduqda nəşr edilmir. |
| DY3 | Tamga ARF səhifələri özəl depo yollarına, yazışmalara və ya icarəçi (tenant) məlumatlarına keçid vermir. |

# Status

**Accepted — 2026-09-27.** Seçilən: ayrı ünvanlar, ingiliscə + türkcə ARF, ad "Tamga ARF". DECISIONS: D-DOCS-1.

**Qeyd (2026-10-02):** ümumi izah qapısı `tamga.network/learn` ünvanına köçürüldü ("Öyrən": sıfırdan Tamga Network-a qədər uzanan öyrənmə yolu). Qərar dəyişməyib; yalnız ünvan dəyişib.
