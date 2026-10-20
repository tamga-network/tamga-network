---
document_id: ADR-0030
title: "Məhsul adları"
status: Active
version: 1.0.0
created: 2026-09-30
last_updated: 2026-10-07
summary: >
  İstifadəçiyə görünən məhsul adları sabitlənir: rəqəmsal cüzdan tətbiqi Tamga Wallet, veb-saytlara giriş "Tamga ilə daxil ol" (Sign in with Tamga), host edilən yoxlayan tərəf Tamga Verify. "TamgaID" məhsul adı kimi istifadə edilmir. D-OSS-2-dəki "istifadəçiyə görünən brend (TamgaID ilə daxil ol) dəyişmir" cümləsini əvəz edir.
domain: Governance
translation_of: ADR-0030
source_version: "1.0.0"
---

# Kontekst

D-OSS-2 (2026-09-27) npm əhatə dairəsini (scope) `@tamga-network` kimi müəyyən edərkən istifadəçiyə görünən brendi "TamgaID ilə daxil ol" kimi
qeyd edirdi. Eyni ad saytda rəqəmsal cüzdanın adı kimi də keçirdi. Halbuki:

- Rəqəmsal cüzdan tətbiqinin adı əvvəldən **Tamga Wallet**-dir (mağaza adı; paket identifikatoru o vaxt ~~`network.tamga.wallet`~~ idi — bax: 2026-10-07 dəyişiklik qeydi).
- `id.tamga.network` və `tamga-id` tenantı ayrıca xidmətdir: müvəqqəti şəxsiyyət [[t:attestation]] xidməti ([[ADR-0011]]).
- Rəqəmsal cüzdan yalnız şəxsiyyət daşımır: qurumların rəqəmsal sənədləri, biletlər, gələcəkdə isə ödəniş və aktivlərin saxlanması kimi funksiyalar da eyni tətbiqdə
  ola bilər. Məhsula "ID" demək onu şəxsiyyətlə məhdudlaşdırır.

Bir adın üç ayrı şeyə (rəqəmsal cüzdan, giriş, şəxsiyyət xidməti) uyğun gəlməsi istifadəçini və qurumları çaşdırır.

# Qərar

İstifadəçiyə görünən üç məhsul adı sabitlənir: rəqəmsal cüzdan **Tamga Wallet**, veb giriş **"Tamga ilə daxil ol"**, host edilən
[[t:verifier]] **Tamga Verify**. "TamgaID" məhsul adı kimi istifadə edilmir.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| PN1 | Rəqəmsal cüzdan tətbiqinin adı hər yerdə **Tamga Wallet**-dir (tk: Tamga Wallet). |
| PN2 | Veb-sayt giriş düyməsi və axını **"Tamga ilə daxil ol"** / "Tamga ilə qeydiyyatdan keç" (en "Sign in with Tamga" / "Sign up with Tamga"; tk "Tamga bilen gir" / "Tamga bilen hasaba dur"). Düymənin görünüşü brend səhifəsində təsvir olunub (`tamga.network/brand`). |
| PN3 | Host edilən yoxlayan tərəfin (vasitəçi yoxlayan tərəf, [[ADR-0017]]; `verify.tamga.network`) adı **Tamga Verify**-dır. |
| PN4 | "TamgaID" məhsul adı kimi istifadə edilmir. Kod və məlumat identifikatorları (`tamga-id` tenantı, `id.tamga.network`, `urn:tamga:id:*`) dəyişmir; bunlar ad deyil, ünvandır. |

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| Rəqəmsal cüzdanın adını TamgaID etmək | rədd | "Tamga ilə giriş" üçün xoş səslənir, lakin rəqəmsal cüzdanın ödəniş və aktiv funksiyaları əlavə olunduqda ad mənasız qalır. |
| "TamgaID ilə daxil ol", rəqəmsal cüzdan Tamga Wallet | rədd | Eyni məhsula iki ad; şəxsiyyət xidməti ilə qarışdırılır. |
| **Rəqəmsal cüzdan Tamga Wallet, giriş "Tamga ilə daxil ol", yoxlayan tərəf Tamga Verify** | **qəbul** | Bir məhsul — bir ad; giriş düyməsi brendi daşıyır, məhsulu məhdudlaşdırmır. |

# Nəticələr

- Saytda, sənədlərdə, verify səhifələrində, nümunələrdə və lüğətdə "TamgaID" istifadə edilmir.
- D-OSS-2-dəki brend cümləsi bu ADR ilə dəyişdirilir (DECISIONS §9b).
- Paket adları dəyişmir (`@tamga-network/verifier`, `/web`).

# Status

**Accepted — 2026-09-30.** Layihə rəhbərliyinin təsdiqi ilə.

# Dəyişiklik qeydi

- **2026-10-07:** Tamga Wallet-ın tətbiq identifikatoru rəqəmsal cüzdanın öz qərarı ilə `com.tamgawallet`-dır ([[ADR-0042]] — şəbəkə rəqəmsal cüzdanlara ad
  vermir). Kontekst bölməsində qeyd olunan `network.tamga.wallet` artıq istifadə edilmir. Məhsul adları (PN1–PN4) dəyişmir.
