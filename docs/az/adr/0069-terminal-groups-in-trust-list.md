---
document_id: ADR-0069
title: "Etibar siyahısında giriş qrupları: qurum, siyasət, sertifikat; terminal açarı qurum adından"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  ADR-0012 K5-in nəzərdə tutduğu `terminal_groups[]` sahəsi yoxlayan tərəfin qeydində formalaşır: hər giriş qrupu `group_id`, `institution_id` (girişləri idarə edən qurum), `label`, `allowed_policies[]`, istəyə bağlı `cert_fingerprints[]` və `offline_allowed`, həmçinin etibarlılıq müddətini daşıyır. Tamga Verify qrupun qurumunu imzalı siyahıdan oxuyur: terminal açarını yalnız həmin qurum adından verir, qurum yalnız öz qruplarının açarlarını görür və ləğv edir (Qurum Konsolu, quruma məhdudlaşdırılmış tokenlə); siyahıda geri çəkilmiş qrupun açarı girişdə keçmir. Sertifikatlı giriş identifikasiyası üçün sahə və oxuyucu hazırdır; girişlər bu gün terminal açarı ilə gəlir (ADR-0065). Qəbul: 2026-10-29 (ADR-0065-in tamamlanması üçün ümumi təsdiq).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0038]]", "[[ADR-0065]]", "[[SPEC-TRUST-0001]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
translation_of: ADR-0069
source_version: "1.0.0"
---

# Qısaca

Giriş qrupunun (məsələn, bir tədbir şirkətinin bilet girişləri) hansı quruma aid olduğu artıq imzalı etibar siyahısında yazılır.
Tamga Verify bu məlumatla giriş açarlarını qurumlar üzrə ayırır: hər qurum Qurum Konsolunda yalnız öz girişlərinin açarlarını
yaradır, görür və ləğv edir. Siyahı qrupu geri çəkərsə, həmin qrupun girişləri dərhal dayanır. Giriş cihazının özünü
sertifikatla təqdim etməsi üçün lazım olan sahə də siyahıda hazırdır; bu yol giriş proqramı hazır olanda açılır.

# Kontekst

- [[ADR-0012]] K5: terminal yalnız qeydiyyatdan keçmiş yoxlayan tərəfin tabeliyində müəyyən edilir; `relying_parties[]` qeydinə
  `terminal_groups[]` əlavə olunur ([[SPEC-TRUST-0001]] kiçik versiya). Sahə reyestrlərdə istifadə olunurdu, lakin yükləyicinin
  sxemində və spesifikasiyada yox idi və qrupun hansı quruma aid olduğunu bildirmirdi.
- [[ADR-0065]]: girişlər Tamga Verify-a terminal açarı ilə özünü təqdim edir; K2 Qurum Konsolu ekranını, K5 isə `terminal_groups[]`-in
  siyahı sxeminə daxil edilməsini növbəti addım sayır.
- Yerləşdirilmiş Tamga Verify bir çox qurumun girişinə xidmət edir; qurum öz girişlərini idarə edəcəksə, yoxlayıcı qrupun qurumunu
  etibarlı mənbədən bilməlidir — bu mənbə imzalı siyahıdır.

# Qərar

## K1 — Sahələr
`group_id` (məcburi, bütün siyahıda unikal; giriş siyasətindəki `terminal_group` ilə eyni), `institution_id` (aktiv qrupda məcburi:
eyni siyahıdakı sənəd verənin `slug`-ı və ya yoxlayan tərəfin `dns_name`-i), `label`, `allowed_policies[]` (aktiv qrupda ən azı bir
`policy_id`), `cert_fingerprints[]` (giriş cihazı sertifikatlarının SHA-256 barmaq izləri; bir barmaq izi yalnız bir qrupda),
`offline_allowed`, `valid_from` (məcburi) və `valid_until` (keçmişsə qrup geri çəkilib və tarix üçün siyahıda qalır).

## K2 — Dərc edənin yoxlaması
Siyahı dərc edən hər dərcdə qrupları yoxlayır: format, unikal `group_id`, aktiv qrupda siyahıda olan qurum və ən azı bir siyasət,
iki qrupda eyni barmaq izi yoxdur. Xəta olarsa dərc dayanır. Geri çəkilmiş qrup köhnə formasında qala bilər.

## K3 — Yoxlayıcı siyahını oxuyur
`TrustSource` qrupu qaytarır (`terminalGroup`): qrup qeydi, yoxlayan tərəfin `dns_name`-i və hazırda aktiv olub-olmadığı. Köhnəlmiş
siyahıda cavab yoxdur (BT5).

## K4 — Terminal açarı qurum adından
Tamga Verify açarı verərkən qrupun siyahıdakı qurumunu qeydə yazır. İnzibatçı uçları iki çağıranı tanıyır: operator (inzibatçı
tokeni) və **qurum** — `base64url(HMAC-SHA256(inzibatçı tokeni, "tamga-terminal-keys/v1:" + qurum))`, `x-tamga-institution` və
`x-institution-token` başlıqları ilə. Qurum yalnız siyahıda özünə bağlı aktiv qrupun açarını alır, yalnız öz açarlarını görür və
ləğv edir; başqa qurumun açarı mövcud deyilmiş kimi qəbul edilir (404). Qurum Konsolu bu uçları server tərəfində çağırır ("Giriş
terminalları" ekranı, yalnız inzibatçı): siyahı, yeni açar (bir dəfə göstərilir, kopyalama düyməsi) və təsdiqli ləğv. Açarın özü
heç yerə yazılmır. Qrup siyahıda yoxdursa, [[ADR-0065]] yolu dəyişmir.

## K5 — Girişdə siyahı yoxlaması
`POST /terminal/verify`-da qrup siyahıda geri çəkilibsə və ya açarın qurumu siyahıdakı qurumdan fərqlidirsə, sorğu 403 alır və
tokenə toxunulmur.

## K6 — Sertifikatlı giriş üçün hazırlıq
`cert_fingerprints[]` və `TrustSource.terminalGroupByCertFingerprint` sertifikatlı giriş və oflayn girişlər üçündür; bu gün heç bir
giriş sertifikatla gəlmir.

## K7 — Sandbox
Sandbox siyahısında üç nümunə qurumun qrupu qurumu və siyasəti ilə dərc olunur; sınaq girişinin açıq açarları işləməyə davam edir.

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| TG1 | Giriş qrupu yoxlayan tərəf qeydinin `terminal_groups[]` elementidir; `group_id` bütün siyahıda unikaldır; aktiv qrup siyahıda olan quruma (`institution_id`) və ən azı bir giriş siyasətinə bağlıdır; dərc edən bu şərti ödəməyən qrupla dərc etmir. |
| TG2 | Qurum adından terminal açarlarının idarəsi quruma məhdudlaşdırılmış tokenlə aparılır: qurum yalnız imzalı siyahıda özünə bağlı aktiv qrupun açarını alır, yalnız öz açarlarını görür və ləğv edir; açar qeydi qrupun qurumunu daşıyır; açarın özü yalnız verildiyi cavabda görünür. |
| TG3 | Siyahıda geri çəkilmiş və ya qurumu dəyişmiş qrupun açarı girişdə keçmir (403, tokenə toxunulmur) və bu qrupa açar verilmir; qrup siyahıda yoxdursa, [[ADR-0065]] TK1–TK3 qüvvədədir. |

# Status

**Accepted — 2026-10-29.** Layihə rəhbərliyinin [[ADR-0065]]-in tamamlanması üçün ümumi təsdiqi ilə. DECISIONS: D-PROX-3.
TG1–TG3 məcburidir.
