---
document_id: ADR-0014
title: "Tədbir kateqoriyası"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  IssuerCategory qapalı çoxluğuna (GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER) yalnız EVENTS (tədbir/bilet satıcısı) əlavə olunur; TRANSPORT və TELECOM real bir qurum gələnə qədər əlavə olunmur. Yeni dəyər enum-un sonuna əlavə olunur (sıra nömrəsinin sabitliyi). Bilet satıcısı `bubilet` OTHER-dən EVENTS-ə keçirilir. Qərar DB-23-ü bağlayır.
domain: Credentials
translation_of: ADR-0014
source_version: "1.0.0"
---

# Kontekst

`IssuerCategory` qurumun sektorunu bildirən **qapalı çoxluqdur** ([[SPEC-BC-0001]] §3, `@tamga-network/trust`
sxemi, `IIssuerRegistry.sol`); çoxluq DECISIONS-da "yekun" kimi bağlanmışdı, buna görə də onun genişləndirilməsi ADR tələb edir. D10 (bilet)
ilə ilk tədbir bileti satıcısı (`bubilet`, operator modeli) [[t:trust-list|etibar siyahısına]] daxil oldu və uyğun kateqoriya olmadığından müvəqqəti
olaraq `OTHER` aldı. Sual (DB-23, 2026-09-26): yalnız **EVENTS** əlavə olunsun, yoxsa rəqəmsal cüzdanın ekranda artıq etiketini
göstərdiyi **TRANSPORT** və **TELECOM** də?

Layihə rəhbərliyinin qərarı (2026-09-27): bilet [[t:issuer|sənədlərini verən qurumlar]] üçün kateqoriya **tədbir** olur.

# Qərar

1. **K1 — Yalnız EVENTS əlavə olunur.** Mənası: tədbir, konsert, idman, səhnə, sərgi kimi bir hadisəyə giriş hüququ verən
   bilet və ya iştirak [[t:credential|rəqəmsal sənədi]] buraxan qurum (bilet satıcısı, təşkilatçı, məkan). Nəqliyyat bileti (TRANSPORT) və operator
   rəqəmsal sənədləri (TELECOM) bu qərara daxil deyil; real sənədi verən qurum namizədi çıxdıqda öz ADR-i ilə əlavə olunur.
2. **K2 — Sıra nömrəsinin sabitliyi.** Yeni dəyər enum-un **sonuna** əlavə olunur:
   `{GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS}`. Kontrakt hələ yerləşdirilməyib (Faza 0),
   lakin sona əlavə etmə qaydası bundan sonrakı hər genişləndirmə üçün də keçərlidir (ABI/yaddaş uyğunluğu).
3. **K3 — Keçirmə.** `bubilet` etibar siyahısı qeydi `OTHER` → `EVENTS` (yeni siyahı versiyası); `event-ticket` [[t:verifier]]
   siyasəti `allowed_categories: ["EVENTS"]`. Rəqəmsal cüzdan etiketi "Tədbir".
4. **K4 — Sxem metadata-sı dəyişmir.** `urn:tamga:tkt:EventTicket:1` metadata-sındakı `issuer_categories: ["OTHER"]`
   məlumatlandırıcıdır ([[SPEC-SCHEMA-0001]]: məcburi yoxlama etibar qatındadır) və dərc olunmuş metadata-nın məzmun xülasəsi
   dəyişdirilə bilməz (D1, `vct#integrity`). Düzəliş növbəti sxem versiyasında (`EventTicket:2`) edilir.

# Əsaslandırma / alternativlər

- **EVENTS + TRANSPORT + TELECOM (rədd edildi):** sənədi verən qurumu olmayan kateqoriya açmaq çoxluğu spekulyativ şəkildə böyüdür; bir
  kateqoriyanın mənası (məs., nəqliyyatda kart, yoxsa bilet; telekomda xəttə sahiblik, yoxsa başqa şey) ilk real qurumla aydınlaşır.
- **OTHER-də saxlamaq (rədd edildi):** kobud filtr mənasını itirir; bilet üzrə yoxlayan tərəf "digər" kateqoriyasındakı hər qurumu
  qəbul etməyə məcbur olur. Əsas qapı yenə də `vct` + sxem səlahiyyətidir, lakin kateqoriya ikinci müdafiə xəttidir.
- **Adlandırma:** ilk təklif `TICKETING` idi; layihə rəhbərliyinin təklifi ilə `EVENTS` — kateqoriya satış kanalını deyil, sektoru ifadə edir.

# Dəyişməzlər

| # | İnvariant |
|---|---|
| **IC1** | `IssuerCategory` qapalı çoxluqdur; yeni dəyər yalnız ADR ilə və enum-un **sonuna** əlavə olunur (sıra nömrələri dəyişmir). |
| **IC2** | Kateqoriya kobud filtrdir, səlahiyyət deyil: sənədi verən qurumun rəqəmsal sənədinin qəbulu `vct` + zaman pəncərəli sxem səlahiyyəti ([[SPEC-TRUST-0001]]) ilə müəyyən edilir; kateqoriya təkbaşına qəbul səbəbi ola bilməz. |
| **IC3** | Kateqoriya dəyişikliyi yeni etibar siyahısı versiyası ilə dərc olunur və rəqəmsal sənədin `iat`-na görə qiymətləndirilən səlahiyyəti geriyə doğru dəyişdirmir (D-BC-3). |

# Nəticələr

- Kod: `@tamga-network/trust` sxemi, `IIssuerRegistry.sol`, etibar siyahısı mənbəyi (`bubilet`), `apps/verify` siyasəti,
  rəqəmsal cüzdan etiket/ikon uyğunlaşdırması (`TICKETING` → `EVENTS`).
- Sənədlər: [[SPEC-BC-0001]] (enum), [[SPEC-ID-0002]] (şərh sətri), terminlər lüğəti, DB-23 bağlandı.
- Qalan: `EventTicket:2`-də `issuer_categories: ["EVENTS"]` (K4).

# Status

**Accepted — 2026-09-27.** DECISIONS: D-CAT-1.
