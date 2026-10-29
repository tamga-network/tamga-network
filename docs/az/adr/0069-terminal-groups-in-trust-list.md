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
  `terminal_groups[]` (qrup identifikatoru, sertifikat barmaq izi, oflayn icazə) əlavə olunur ([[SPEC-TRUST-0001]] kiçik versiya).
  Sahə reyestrlərdə `group_id`, `label`, `offline_allowed`, `valid_from`, `valid_until` ilə istifadə olunurdu, lakin yükləyicinin
  sxemində və spesifikasiyada yox idi və qrupun hansı quruma aid olduğunu bildirmirdi.
- [[ADR-0065]]: girişlər Tamga Verify-a terminal açarı ilə özünü təqdim edir; açarları operator inzibatçı ucundan verir. K2 Qurum
  Konsolu ekranını, K5 isə `terminal_groups[]`-in siyahı sxeminə daxil edilməsini növbəti addım sayır.
- Yerləşdirilmiş Tamga Verify bir çox qurumun girişinə xidmət edir: bir yoxlayan tərəf qeydinin altında müxtəlif qurumların
  qrupları var (sandbox-da kampus turniketi, bilet girişi, kinoteatr girişi). Qurum öz girişlərini idarə edəcəksə, yoxlayıcı
  qrupun qurumunu etibarlı mənbədən bilməlidir; bu mənbə imzalı siyahıdır.
- Layihə rəhbərliyinin istiqaməti: ADR-0065-in açıq saxladığı iki iş tamamlanır; bağlanmış sxem qərarı dəyişərsə, ADR ilə.

# Qərar

## K1 — Sahələr
Yoxlayan tərəf qeydinin `terminal_groups[]` elementi:

| Sahə | Məcburi | Mənası |
|---|---|---|
| `group_id` | bəli | Qrup identifikatoru (`[a-z0-9-]{1,40}`); giriş siyasətindəki `terminal_group` ilə eyni. Bütün siyahıda unikaldır. |
| `institution_id` | aktiv qrupda bəli | Qrupun girişlərini idarə edən qurum: eyni siyahıdakı sənəd verənin `slug`-ı və ya yoxlayan tərəfin `dns_name`-i (sertifikat yenilənməsindən təsirlənməyən daimi identifikatorlar). |
| `label` | xeyr | İnsan üçün ad. |
| `allowed_policies[]` | aktiv qrupda bəli (ən azı bir) | Qrupun girişlərinin xidmət etdiyi giriş siyasətləri (`policy_id`). |
| `cert_fingerprints[]` | xeyr | Giriş cihazı sertifikatlarının SHA-256 barmaq izləri (onaltılıq, kiçik hərf); bir barmaq izi yalnız bir qrupda. |
| `offline_allowed` | xeyr | Oflayn giriş icazəsi ([[ADR-0012]] K3 riski qəbul edilibsə). |
| `valid_from`, `valid_until` | `valid_from` bəli | Etibarlılıq; `valid_until`-i keçmiş qrup geri çəkilib və tarix üçün siyahıda qalır. |

ADR-0012 K5-dəki "sertifikat barmaq izi" massivə çevrilir (bir qrupda bir neçə cihaz); qurum, siyasət və etibarlılıq sahələri
əlavə olunur.

## K2 — Dərc edənin yoxlaması
Siyahı dərc edən hər dərcdə qrupları yoxlayır: format, bütün siyahıda unikal `group_id`, aktiv qrupda siyahıda olan qurum və ən
azı bir siyasət, iki qrupda eyni sertifikat barmaq izi yoxdur. Xəta olarsa dərc dayanır. Geri çəkilmiş qrup köhnə formasında qala
bilər (real şəbəkədəki iki köhnə qrup belədir; dəyişmir).

## K3 — Yoxlayıcı siyahını oxuyur
`TrustSource` qrupu qaytarır (`terminalGroup`): qrup qeydi, bağlı olduğu yoxlayan tərəfin `dns_name`-i və hazırda aktiv olub-olmadığı
(yoxlayan tərəf ACTIVE və qrup etibarlılıq müddətində). Köhnəlmiş siyahıda cavab yoxdur (BT5). Siyahı faylını başqa yer şərh etmir
(BT4).

## K4 — Terminal açarı qurum adından
- Tamga Verify açarı verərkən qrupun siyahıdakı qurumunu qeydə yazır; siyahı qrupun siyasətlərindən heç birinə icazə vermirsə və ya
  qrup geri çəkilibsə, açar verilmir.
- İnzibatçı ucları iki çağıranı tanıyır: operator (inzibatçı tokeni, bütün açarlar) və **qurum** — quruma məhdudlaşdırılmış token
  `base64url(HMAC-SHA256(inzibatçı tokeni, "tamga-terminal-keys/v1:" + qurum))`, `x-tamga-institution` və `x-institution-token`
  başlıqları ilə. Qurum yalnız siyahıda özünə bağlı aktiv qrupun açarını alır, yalnız öz açarlarını görür və ləğv edir; başqa
  qurumun açarı mövcud deyilmiş kimi qəbul edilir (404).
- Qurum Konsolu bu ucları server tərəfində, sessiyadakı qurumun tokeni ilə çağırır ("Giriş terminalları" ekranı, yalnız
  inzibatçı): siyahı (ad, qrup, yaradılma, son istifadə, vəziyyət), yeni açar (bir dəfə göstərilir, kopyalama düyməsi) və təsdiqli
  ləğv. Konsolun audit jurnalına açar identifikatoru və qrup yazılır; açarın özü heç yerə yazılmır. Uclar xaricə bağlıdır (daxili
  ünvan).
- Qrup siyahıda yoxdursa, [[ADR-0065]] yolu dəyişmir: açarı yalnız operator verir.

## K5 — Girişdə siyahı yoxlaması
`POST /terminal/verify`-da açar yoxlandıqdan sonra qrup siyahıda geri çəkilibsə və ya açarın qurumu siyahıdakı qurumdan
fərqlidirsə, sorğu 403 alır və tokenə toxunulmur. Beləliklə qurumun qeydi və ya giriş qrupu siyahıdan çıxanda girişləri də
dayanır.

## K6 — Sertifikatlı giriş üçün hazırlıq
`cert_fingerprints[]` və `TrustSource.terminalGroupByCertFingerprint` sertifikatlı giriş kimliyi (qarşılıqlı TLS və ya imzalı giriş
sorğusu) və oflayn girişlər üçündür. Bu gün heç bir giriş sertifikatla gəlmir; yol giriş proqramı və sertifikat paylanması hazır
olanda ayrıca dəyişikliklə açılır ([[ADR-0065]] K5 hədəfi).

## K7 — Sandbox
Sandbox siyahısında üç nümunə qurumun qrupu qurumu və siyasəti ilə dərc olunur (`istanbul-bilgi-campus` → `istanbul-bilgi`,
`campus-access`; `bubilet-gate` → `bubilet`, `event-ticket`; `paribu-cineverse-gate` → `paribu-cineverse`, `event-ticket`). Sınaq
girişinin açıq mühit açarları işləməyə davam edir ([[ADR-0065]] K4).

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Qrupun qurumunu yalnız Qurum Konsolunun icarəçi parametrində saxlamaq | rədd | Yoxlayıcı qurumu bilmir; konsoldakı xəta başqa qurumun açarını açır; dərc olunmuş, imzalı mənbə yoxdur |
| Hər quruma ayrıca, əl ilə paylanan inzibatçı tokeni | rədd | Serverdə hər qurum üçün ayrıca sirr; idarəetmə yükü; törəmə token eyni təhlükəsizliyi verir |
| **Siyahı qurumu bildirir; quruma məhdudlaşdırılmış törəmə token** | **seçildi** | Tək mənbə imzalı siyahıdır; qurumu həm yoxlayıcı, həm konsol ayrıca yoxlayır; yeni sirr yoxdur |
| Qrupları ayrıca siyahı növünə köçürmək | rədd | Lazımsız yeni format; ADR-0012 K5 qrupu yoxlayan tərəf qeydinin altına qoyur |

# Dəyişməz qaydalar

| Kod | Qayda |
|---|---|
| TG1 | Giriş qrupu yoxlayan tərəf qeydinin `terminal_groups[]` elementidir; `group_id` bütün siyahıda unikaldır; aktiv qrup siyahıda olan quruma (`institution_id`) və ən azı bir giriş siyasətinə bağlıdır; dərc edən bu şərti ödəməyən qrupla dərc etmir. |
| TG2 | Qurum adından terminal açarlarının idarəsi quruma məhdudlaşdırılmış tokenlə aparılır: qurum yalnız imzalı siyahıda özünə bağlı aktiv qrupun açarını alır, yalnız öz açarlarını görür və ləğv edir; açar qeydi qrupun qurumunu daşıyır; açarın özü yalnız verildiyi cavabda görünür. |
| TG3 | Siyahıda geri çəkilmiş və ya qurumu dəyişmiş qrupun açarı girişdə keçmir (403, tokenə toxunulmur) və bu qrupa açar verilmir; qrup siyahıda yoxdursa, [[ADR-0065]] TK1–TK3 qüvvədədir. |

# Nəticələr

- Kod: `@tamga-network/trust` (`TerminalGroup` sxemi, `RelyingParty.terminal_groups`, `TrustSource.terminalGroup` /
  `terminalGroupByCertFingerprint`); siyahı dərc edən (`terminal-groups.ts` yoxlaması; sandbox və test reyestrləri); `apps/verify`
  (`terminal-keys.ts` qurum və son istifadə, `institutionToken`; `routes/terminal.ts` quruma məhdudlaşdırılmış uclar və girişdə
  siyahı yoxlaması); Qurum Konsolunun "Giriş terminalları" ekranı (operator deposu).
- Sənədlər: [[SPEC-TRUST-0001]] §4 (yoxlayan tərəf qeydi), [[SPEC-API-0001]] §6.4, etibar siyahısı API tərifi, yoxlayan tərəfin
  qeydiyyat bələdçisi və sandbox bələdçisi §6, [[FW-RB-0006]] §4.3; [[ADR-0065]] K2 və K5 bu qərarla tamamlandı.
- Paketlər: mənbə 0.7.4 (yeni oxuyucu istəyə bağlıdır; köhnə siyahılar yüklənməyə davam edir).
- **Tətbiq qeydi (0.7.4, 2026-10-29):** TG3 bağlı qalma prinsipi ilə tətbiq olunur. "Siyahı köhnəlib" ilə "qrup siyahıda yoxdur"
  ayrılır (`freshness().healthy`): quruma bağlı açar və ya siyahıda bir dəfə görülmüş qrup siyahıda təsdiqlənə bilmirsə, girişdə
  403, yeni açar verilmir. Qrup siyahısız olanda operatorun verdiyi sahibsiz açar qrup siyahıya düşəndə qrupun qurumuna bağlanır.
  `allowed_policies` girişdə də yoxlanılır: keçid kartı öz siyasətinin identifikatorunu daşıyır; icazəsiz siyasətin kartı istifadə
  edilmədən rədd edilir.

# Status

**Accepted — 2026-10-29.** Layihə rəhbərliyinin [[ADR-0065]]-in tamamlanması üçün ümumi təsdiqi ilə (hərfi sitat xüsusi təsdiq
qeydində). DECISIONS: D-PROX-3. TG1–TG3 məcburidir.
