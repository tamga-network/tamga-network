---
document_id: ADR-0002
title: "Suverenlik prioritetli idarəetmə"
status: Active
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  Tamga Network idarəetməni SUVERENLİK PRİORİTETLİ üç səviyyəyə bölür: (1) Şəbəkəyə üzvlük (yeni dövlətin validator olması) validatorların əksəriyyəti (2/3) ilə səsə qoyulur; (2) Milli reyestrlər (sənədi verən qurum, relying party) YALNIZ müvafiq dövlətin səlahiyyətindədir, heç bir xarici səsvermə yoxdur (kod səviyyəsində onlyOwnerState); (3) Transsərhəd tanınma hər dövlət tərəfindən birtərəfli müəyyən edilir. Dövlətin çıxarılması vətəndaşların rəqəmsal sənədlərini etibarsız etmir; çıxış hüququ (withdraw) kodla təmin edilir. Model eIDAS LOTL presedentini izləyir. PM-BC-0001-dəki "təsisçi konsorsium + on-chain səsvermə" ifadəsini dəqiqləşdirir; SPEC-BC-0001 ilə tətbiq edilir.
domain: Governance
translation_of: ADR-0002
source_version: "1.0.0"
---

# ADR-0002 — Suverenliyə əsaslanan idarəetmə

**Status:** Accepted
**Tarix:** 2026-08-05
**Qərar verən:** Tamga Network layihə rəhbərliyi
**Mənbə:** `docs/tamga-network-guven-katmani-kontratlari-v2.md` (memarlıq qərarı layihəsi) — bu ADR həmin layihənin idarəetmə bölməsini rəsmiləşdirir.

---

# Kontekst

[[PM-BC-0001]] idarəetməni ümumi şəkildə "təsisçi konsorsium + on-chain səsvermə"
kimi saxlamışdı. Lakin kritik bir sual bunu dəqiqləşdirməyi tələb etdi:

> **Türkiyə öz qurumunu (məs. MEB) [[t:issuer]] edərkən niyə Qazaxıstanın səsini gözləməlidir?**

Gözləməməlidir. Əks halda bu, qəbuledilməz bir **suverenlik pozuntusu** və tətbiqin qarşısındakı
ən böyük maneə olardı. Presedent aydındır: [[t:eIDAS]]-da hər üzv dövlət öz Trusted
List-ini müstəqil dərc edir; Aİ yalnız siyahıları toplayır ([[t:LOTL]]). Heç bir dövlət
başqasının hansı qurumu sənədi verən qurum edəcəyinə səs vermir. Qarşılıqlı tanınma
**razılaşma/seçim**dir, qurum-qurum səsə qoyulan bir şey deyil.

---

# Qərar

İdarəetmə üç qata bölünür; hər qatda qərar **fərqli** aktora məxsusdur:

| Səviyyə | Mövzu | Qərar kimdədir | Hədd |
|--------|------|-------------|------|
| **1 — Şəbəkəyə üzvlük** | Yeni dövlətin validator olması / çıxarılması / protokolun yenilənməsi | Validatorların əksəriyyəti (mövcud dövlətlər) | **2/3** |
| **2 — Milli reyestrlər** | Öz sənədi verən qurumları, öz relying party-ləri | **Yalnız müvafiq dövlət** | Səsvermə YOXDUR (`onlyOwnerState`) |
| **3 — Transsərhəd tanınma** | "X ölkəsinin rəqəmsal sənədlərini qəbul edirəmmi?" | Hər dövlət, öz adından | Birtərəfli |

## Alt qərarlar
1. **Səviyyə 1 hədləri:** yeni dövlətin qəbulu **2/3**; dövlətin çıxarılması **2/3** (çıxarılanın
   səsi sayılmır); protokolun yenilənməsi **2/3**. (Yekdillik əvəzinə 2/3 seçildi: bir
   dövlətin böyüməni veto etmə/bloklama riskinin qarşısını alır; buna baxmayaraq, ağır qərardır.)
2. **Səviyyə 2 — kod səviyyəsində suverenlik:** hər dövlətin bir **namespace**-i var
   (`TR:issuer:*`, `KZ:rp:*` …) və həmin namespace-ə **yalnız həmin dövlətin səlahiyyətli
   açarı** yaza bilər. Kontraktda `onlyOwnerState(stateCode)` modifier-i ilə məcburi edilir;
   xoş niyyətdən asılı deyil.
3. **Səviyyə 3 — standart tanınma siyasəti:** **təsisçi üzvlər arasında FULL**
   (bir-birini əvvəldən tam tanıyır); **sonradan qoşulanlar üçün NONE** (opt-in) — dövlətlər
   öz qanunvericilik tempində açır. Bu, "ya hamısı, ya heç biri" tələsinin qarşısını alır.
4. **Çıxarılma ≠ rəqəmsal sənədlərin məhvi:** dövlətin çıxarılması yalnız "yeni qeyd
   yaza bilməz + blok yarada bilməz" deməkdir. Vətəndaşlarının rəqəmsal cüzdanındakı [[t:credential|rəqəmsal sənədlər]]
   etibarsız olmur; onların taleyi digər dövlətlərin Səviyyə 3 tanınma qərarından asılıdır.
5. **Çıxış hüququ (exit):** dövlət birtərəfli olaraq `withdraw()` ilə çıxa bilər; səsvermə
   tələb olunmur. Kod səviyyəsində təminat.
6. **Transsərhəd yurisdiksiya (home-state suverenliyi):** vətəndaşın [[t:pseudonym|psevdonimini]]
   YALNIZ onun öz dövlətinin guardian həddi + öz məhkəməsi aça bilər; başqa dövlət
   aça bilməz. Təfərrüatlar [[PM-ID-0002]] (accountable disclosure) ilə işlənir; [[PM-ID-0001]]
   "açıqlama = home-state suverenliyi" prinsipi ilə uyğundur.

---

# Əsaslandırma

1. **Tətbiq oluna bilmə.** Heç bir dövlət "daxili institusional qərarlarım başqalarının səsindən
   asılıdır" və ya "bir gün çıxarılsam, vətəndaşlarımın şəxsiyyəti dəyərsizləşər" riski ilə şəbəkəyə qoşulmaz.
   Suverenlik təminatları iştirakın ilkin şərtidir.
2. **Presedent (eIDAS/LOTL).** Aİ-nin işləyən modeli məhz budur; nəzəri deyil, sübut olunmuşdur.
3. **Mərhələli inteqrasiya.** Birtərəfli tanınma hər dövlətə öz tempində açmağa
   imkan verir; ilkin mərhələdə tam uyğunlaşma məcburiyyətini aradan qaldırır.
4. **Kod səviyyəsində təminat.** `onlyOwnerState` + `withdraw` suverenliyi vəddən
   çıxarıb mühəndislik təminatına çevirir.

---

# Nəticələr

**Müsbət:**
- Güclü tətbiq stimulu (suverenlik + çıxış + rəqəmsal sənədlərin davamlılığı).
- Governance kontraktının əhatəsi daralır → daha sadə, daha kiçik hücum səthi.
- eIDAS ilə konseptual uyğunluq → interoperability asanlığı.

**Xərc / diqqət:**
- Cross-recognition matrisinin idarə edilməsi (hər dövlət × hər dövlət × kateqoriya) əməliyyat
  yükü yaradır; rəqəmsal cüzdan/[[t:verifier]] UX-i bunu gizlətməlidir.
- "Təsisçilər FULL" standartı təsisçi dəstin diqqətlə seçilməsini tələb edir.
- Home-state yurisdiksiyası transsərhəd cinayət ssenarilərində məhdud qala bilər (gələcəkdə
  dövlətlərarası razılaşma tələb oluna bilər — [[PM-ID-0002]] açıq məsələ).

---

# Nəzərdən keçirilmiş alternativlər

- **Hər şey ümumi səsvermə ilə (tam konsorsium):** Rədd edildi — Səviyyə 2/3-də suverenlik pozuntusu;
  tətbiq olunmaz.
- **Heç bir ümumi səsvermə (tam müstəqil):** Rədd edildi — şəbəkənin tərkibi (kim validatordur)
  nəzarətsiz qalır; "masa arxasında kim oturur" ümumi qərar olmalıdır.
- **Yekdillik (Səviyyə 1):** Rədd edildi — bir dövlət böyüməni bloklaya bilər; 2/3 üstün tutuldu.
- **Standart tanınma FULL (hamı üçün):** Rədd edildi — qanunvericilik/suverenlik riski; təsisçilər
  FULL + sonrakılar NONE üstün tutuldu.

---

# Əlaqəli sənədlər

- [[PM-BC-0001]] — "təsisçi konsorsium + on-chain səsvermə" ifadəsi bu ADR ilə dəqiqləşdirilir.
- [[ADR-0001]] — Mühərrik (Besu/QBFT); Səviyyə 1 səsvermələri QBFT validator dəsti ilə üst-üstə düşür.
- [[SPEC-BC-0001]] — Bu modelin kontrakt tətbiqi (Governance, Registry, Recognition).
- [[ARCH-0001]] — Mərhələli validator modeli (Faza 0-da namespace/səsvermə prosesi).
- [[PM-ID-0001]] / [[PM-ID-0002]] — Home-state suverenliyi və accountable disclosure.

---

# Status

İdarəetmə modeli qərara alınıb. Tətbiq təfərrüatları
(kontrakt interfeysləri, hədd parametrləri) [[SPEC-BC-0001]]-dadır; guardian tərkibi
və transsərhəd yurisdiksiya [[PM-ID-0002]] + [[PM-GOV-0001]] (planlaşdırılır) ilə dərinləşdiriləcək.
