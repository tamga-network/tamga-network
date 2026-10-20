---
document_id: ADR-0008
title: "Ləğv siyahısının yeri"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Depoda kod ilə spesifikasiya bir-birinə zidd idi: SPEC-CRED-0001 §5 "siyahı off-chain, pointer on-chain" deyirdisə, StatusListRegistry.sol bitmap-i zəncirdə saxlayırdı (_setBit, getChunk). Bu ADR ziddiyyəti aradan qaldırır. Qərar: bitstring siyahısı off-chain, sənədi verən qurum tərəfindən imzalanmış Status List Token kimi host edilir; zəncirdə yalnız URI + məzmun hash-i + versiya + ölçü lövbəri qalır. Əsas əsaslandırma məxfilikdir: hər ləğvi zəncirə yazmaq icazəli şəbəkədə bütün validator-lara ləğv ANINI sızdırır və blok zaman damğası ilə birləşdikdə sənəd sahibinin dairəsini daraldır. StatusListRegistry.sol yenidən yazılacaq.
domain: Credentials
translation_of: ADR-0008
source_version: "1.0.0"
---

# ADR-0008 — Ləğv Siyahısının Yeri

**Status: Accepted** ✅ (2026-09-09)

---

# Kontekst

## Aşkar edilən ziddiyyət

2026-09-09 depo auditində [[t:revocation]] mexanizminin **iki fərqli yerdə iki fərqli
şəkildə** təyin edildiyi aşkar olundu:

**[[SPEC-CRED-0001]] §5 deyir ki:**

> Siyahı off-chain ([[t:issuer]] host edir, imzalı/versiyalı); zəncirdə yalnız URI +
> hash + versiya + bitmap.

(Cümlənin sonundakı "+ bitmap" ifadəsi onsuz da öz içində ziddiyyətlidir — siyahı
off-chain-dirsə, bitmap zəncirdə nə gəzir?)

**`contracts/src/revocation/StatusListRegistry.sol` isə bunu edir:**

```solidity
function setRevoked(bytes32 issuerId, uint256 index) public onlyIssuer(issuerId)
function setRevokedBatch(bytes32 issuerId, uint256[] calldata indexes) external
function getChunk(bytes32 issuerId, uint256 chunkIndex) external view returns (uint256)
function _setBit(bytes32 issuerId, uint256 index, bool value) private
```

Yəni bitmap **zəncirdədir**, 256-bit chunk-lar şəklində. Hər ləğv bir zəncir
əməliyyatıdır.

İkisi eyni anda doğru ola bilməz. Bu ADR ziddiyyəti aradan qaldırır.

## Niyə indi

Bu, kod yazılan anda fərq edilməyən bir dizayn ayrımıdır və
[[SPEC-BC-0001]]-in "Yanaşma B (bitstring)" qərarının **iki fərqli oxunuşu**
olmasından qaynaqlanır. "Bitstring" məlumat strukturunu təyin edir; **harada
yerləşdiyini** təyin etmir. Qərarlar reyestrinə bitstring seçildiyi qeyd olunub, yerləşmə
sualı isə heç verilməyib.

---

# Qərar

## Qərar 1 — Bitstring siyahısı off-chain saxlanılır

[[t:status-list|Ləğv siyahısı]] IETF Token Status List (draft-ietf-oauth-status-list) əsasında
sənədi verən qurum tərəfindən **imzalı Status List Token** kimi dərc edilir:

```
https://status.<issuer-domain>/v1/statuslist/<listId>
```

Token sənədi verən qurumun [[t:credential]] imzalama açarı ilə **eyni etibar zəncirinə** bağlı
bir açarla imzalanır ([[SPEC-ID-0002]] X.509). Məzmunu sıxılmış
bitstring-dir.

## Qərar 2 — Zəncir yalnız lövbəri saxlayır

`StatusListRegistry` kontraktı bunları saxlayır:

```
listId        = keccak256(issuerId, listURI)
issuerId      bytes32
listURI       string
contentHash   bytes32     // hash of the published Status List Token
listSize      uint256     // min 100,000 (privacy floor kept)
version       uint64      // increases with every publication
publishedAt   uint64
status        {ACTIVE, RETIRED}
```

Zəncirdə ləğv məlumatının **bir biti belə** yoxdur.

## Qərar 3 — Dərc dövrü sabit və küylüdür

Sənədi verən qurum siyahını **sabit intervallarla** yenidən dərc edir (tövsiyə: 1 saat) —
həmin intervalda ləğv olub-olmamasından asılı olmayaraq. Hər dərcdə `contentHash` və `version`
zəncirdə yenilənir.

Bu, Qərar 1-in məxfilik faydasını qorumaq üçün **məcburidir.** Yalnız ləğv
olanda dərc etsək, zəncirdəki yeniləmə əməliyyatının özü "bu saatda bir
ləğv baş verdi" məlumatını sızdırar — yəni qaçdığımız problemi geri gətirərik.

## Qərar 4 — `StatusListRegistry.sol` yenidən yazılacaq

`_setBit`, `getChunk`, `setRevoked`, `setRevokedBatch`, `unsetRevoked`
funksiyaları **çıxarılır.** Onların yerinə `publishList(...)` və
`getListAnchor(...)` gəlir.

`ITrustQueries.sol` daxilindəki `IStatusList.isRevoked(issuerId, index)` interfeysi də
**çıxarılır** — zəncir artıq bu suala cavab verə bilmir və cavab verəcəkmiş kimi
görünən interfeys saxlamaq təhlükəlidir.

## Qərar 5 — Yoxlama axını

[[t:verifier]]:

1. Sənədin `status` claim-indən `listURI` + `index` götürülür.
2. Status List Token endirilir (və ya keşdən götürülür).
3. Token-in imzası yoxlanılır.
4. Token-in hash-i zəncirdəki `contentHash` ilə müqayisə edilir.
5. `version` kifayət qədər təzədirmi, yoxlanılır (siyasət: məs. son 24 saat).
6. Bitstring-də `index` oxunur.

Addım 4 kritikdir: sənədi verən qurumun öz serverində siyahını səssizcə geri qaytarmasının
(ləğv edilmiş sənədi "etibarlı" göstərməsinin) qarşısı belə alınır.

---

# Əsaslandırma

## 1. Məxfilik — əsas əsaslandırma budur

On-chain bitmap-in ən ciddi problemi gas deyil, **ləğv anının sızması**dır.

İcazəli şəbəkədə hər əməliyyat hər validator-a görünür və blok zaman damğası daşıyır.
`setRevoked(issuerId, 4711)` əməliyyatı zəncirə yazıldıqda aşağıdakı məlumat şəbəkədəki bütün
dövlətlərin əlinə keçir:

> "X Universiteti 14 mart 2027-ci il saat 10:42-də 4711 nömrəli indeksdəki sənədi
> ləğv etdi."

Bu, tək başına indeksin kimə aid olduğunu demir. Amma korrelyasiya ilə dairəni daraldır:

- Universitet intizam qərarı ilə diplomu ləğv etdikdə, həmin qərarın tarixi
  adətən məlum olur və ya ictimaiyyətə açıqdır.
- Qurumdan ayrılan əməkdaşın sənədi ayrıldığı gün ləğv edilir. İşdən
  çıxma tarixi ilə zəncirdəki damğa üst-üstə düşür.
- Kütləvi ləğv (bir fakültənin bağlanması) zəncirdə aydın bir çoxluq kimi görünür.

Off-chain + sabit intervallı dərc bunun qarşısını alır: kənardan görünən yeganə şey
"siyahının yeni versiyası dərc edildi" faktıdır. Hansı bitin dəyişdiyi, hətta hər hansı bitin
dəyişib-dəyişmədiyi belə görünmür.

Bu, [[PM-TRUST-0001]]-in "əlaqələndirilə bilən hash belə risklidir" prinsipi ilə eyni
məntiqin zaman ölçüsündə tətbiqidir.

## 2. Standarta uyğunluq

[[ADR-0006]] ləğvi **Token Status List**-ə həvalə etdi. Həmin standartın
arxitekturası onsuz da "sənədi verən qurum token dərc edir, yoxlayan tərəf onu çəkir" şəklindədir.
Bitmap-i zəncirə yerləşdirmək standartın məlumat strukturunu götürüb ötürmə modelindən
imtina etmək olardı — yəni yarımçıq uyğunluq. Yarımçıq uyğunluq xarici rəqəmsal cüzdanlarla və xarici
yoxlayan tərəflərlə işləməni pozur.

## 3. Xərc və miqyas

İcazəli şəbəkədə gas ödənişsiz olsa belə, zəncir vəziyyəti (state) hər validator-un
diskində saxlanılır və həmişəlik qalır.

Təxmini ölçü: bir universitet üçün 100.000 indeksli siyahı = 12,5 KB
bitmap. Türkiyədə ~200 ali təhsil müəssisəsi → 2,5 MB. Türk dünyası miqyasında
minlərlə sənədi verən qurum × siyahının böyüməsi → onlarla MB daimi vəziyyət, üstəlik hər
ləğvdə bir əməliyyat və bir blok.

Off-chain-də eyni məlumat CDN-dən təqdim olunur və zəncir vəziyyətindən heç istifadə etmir.

## 4. Miqyaslana bilmə və təzəlik balansı

Off-chain siyahı yoxlayan tərəfdə aqressiv şəkildə keşlənə bilər. On-chain oxuma
hər dəfə RPC node-a müraciət etməyi tələb edir — yoxlama isə şəbəkədə ən tez-tez icra olunan
əməliyyatdır.

## 5. [[ADR-0007]] ilə eyni nümunə

Sxem reyestri də eyni nümunədən istifadə edir: **məzmun off-chain, lövbər on-chain.**
İki fərqli nümunədən istifadə etmək həm kodu, həm də zehni modeli lüzumsuz yerə ikiyə
bölür. Vahid nümunə: *zəncir xarici dünyadakı sənədin hansı versiyasının qüvvədə
olduğunu bildirir.*

---

# Nəzərdən keçirilmiş alternativlər

## A — Bitmap tamamilə zəncirdə (mövcud kod) — Rədd edildi

- **Üstünlük:** Vahid mənbə; yoxlayan tərəf əlavə HTTP sorğusu etmir; sənədi verən qurumun serveri
  çöksə belə, ləğv məlumatı əlçatan qalır.
- **Çatışmazlıq:** Ləğv anının sızması (§1), daimi vəziyyət xərci, standartdan
  kənarlaşma, RPC asılılığı.

Rədd edildi. Yeganə real üstünlüyü olan "sənədi verən qurumun serveri çökərsə" ssenarisi
Qərar 5-in 4-cü addımı + keşləmə ilə kifayət qədər qarşılanır.

## B — Kriptoqrafik akkumulyator / ZK ləğv — Təxirə salındı

Merkle/RSA akkumulyatoru və ya ZK üzvlük sübutu ilə ləğv məxfilik baxımından
ən güclü həlldir (yoxlayan tərəf hansı indeksi sorğuladığını belə açıqlamır).

Rədd edilmədi, **təxirə salındı.** Əsaslandırma: yetkin kitabxana və rəqəmsal cüzdan dəstəyi yoxdur,
[[ADR-0006]]-in ES256 bazası ilə uyğunluğu əlavə araşdırma tələb edir və pilotu
lüzumsuz yerə mürəkkəbləşdirir. `RS-REVOCATION-0001` bunu Faza 2 üçün
qiymətləndirəcək.

## C — Qısamüddətli sənəd (ləğvsiz) — Qismən qəbul edildi

Ləğvi tamamilə aradan qaldırmağın yolu sənədi çox qısamüddətli edib
daim yeniləməkdir.

- **Tələbə sənədi** üçün doğru cavab budur: 30 gün TTL, ləğv siyahısına heç
  daxil olmur.
- **Diplom** üçün yanlışdır: diplom daimidir, onun daim yenilənməsi həm
  sənədi verən quruma yükdür, həm də hər yeniləmədə sənədi verən quruma "bu şəxs hələ aktivdir" siqnalı verir
  (izləmə səthi).

**Qəbul edilən:** Qarışıq yanaşma. Sxem əsasında TTL siyasəti [[SPEC-SCHEMA-0002]]-də
müəyyən edilir; qısamüddətli tiplər ləğv siyahısından istifadə etmir.

## D — Hibrid: təcili ləğv zəncirdə, adi ləğv off-chain — Rədd edildi

"Kritik ləğvlər dərhal zəncirə yazılsın" ideyası cəlbedici görünür, amma ən pis
məxfilik nəticəsini yaradır: zəncirə yazılan ləğv **məhz ən həssas olan**
ləğvdir. Sızmanı azaltmır, əksinə cəmləşdirir.

---

# Nəticələr

## Məcburi nəticələr

1. `StatusListRegistry.sol` **yenidən yazılır** (Qərar 4). Mövcud bitmap
   məntiqi çıxarılır.
2. `ITrustQueries.sol` → `IStatusList.isRevoked` **çıxarılır.**
3. `CredentialGate.sol` daxilindəki `CredentialRevoked` yoxlaması zəncirdən oxuma
   edə bilməyəcəyi üçün yenidən nəzərdən keçirilməlidir. Zəncirüstü credential-gating
   ([[ADR-0003]] Qərar 4) artıq ləğv statusunu **birbaşa** görə bilmir; ləğv
   yoxlaması çağıran tərəfin təqdim etdiyi təzə sübuta əsaslanmalıdır. Bu,
   [[ADR-0003]]-in bir nəticəsini daraldır və `SPEC-AGENT-0001`-də nəzərdən keçiriləcək.
4. [[SPEC-CRED-0001]] §5-dəki "+ bitmap" ifadəsi düzəldilir.
5. [[SPEC-CRED-0003]] bu qərarı normativ şəkildə təsbit edir: token formatı, dərc
   dövrü, keş siyasəti, təzəlik həddi.
6. `status.<issuer-domain>` hər sənədi verən qurum üçün idarə olunan komponentdir —
   [[ARCH-0004]] inventarına və sənədi verən qurumun onboarding yoxlama siyahısına daxil edilir.

## Qəbul edilən kompromislər

- **Sənədi verən quruma əməliyyat yükü.** Hər sənədi verən qurum artıq status serveri
  idarə etməli olur. Kiçik qurumlar üçün Tamga hostinq xidməti təklif edə bilər —
  lakin bu halda Tamga bütün ləğvləri görür. Bu, mərkəzləşmə nöqtəsidir və
  [[PM-GOV-0001]]-də siyasət kimi nəzərdən keçirilməlidir.
- **Təzəlik pəncərəsi.** Sabit intervallı dərc ən pis halda bir dərc
  intervalı qədər (1 saat) gecikmə deməkdir. Dərhal ləğv tələb edən ssenarilər
  üçün Qərar 3-ün intervalı sxem əsasında qısaldıla bilər.
- **Əlavə şəbəkə sorğusu.** Yoxlayan tərəf yoxlama zamanı daha bir HTTP sorğusu edir.
  Keşləmə sayəsində praktikada bu, nəzərə alınmayacaq qədər azdır.

---

# Əlaqələr

**Düzəldir:** [[SPEC-CRED-0001]] §5 (ziddiyyət) · `StatusListRegistry.sol`
**Əsaslanır:** [[ADR-0006]] · [[PM-TRUST-0001]]
**Tətbiq edir:** [[SPEC-CRED-0003]] · [[SPEC-BC-0001]] (yenidən yazılma)
**Daraldır:** [[ADR-0003]] Qərar 4 (credential-gating ləğv görünürlüyü)
**Qardaş qərar:** [[ADR-0007]] (eyni off-chain məzmun + on-chain lövbər nümunəsi)
**Təxirə salır:** `RS-REVOCATION-0001` (akkumulyator/ZK, Faza 2)

---

# Status

**Accepted** ✅ — 2026-09-09. [[DECISIONS]]-ə `D-REV-1` kimi daxil ediləcək və
D-NET/D-CRED bölmələrindəki müvafiq sətirlər yenilənəcək.
