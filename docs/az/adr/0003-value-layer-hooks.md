---
document_id: ADR-0003
title: "Dəyər qatı qarmaqları"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  [[PM-AUTH-0001]] strategiyasına uyğun olaraq dəyər/ödəniş/agent qapısını AÇIQ saxlamaq üçün BU GÜN qəbul edilməli olan beş məcburi memarlıq qərarı. Hamısının bu gün xərci demək olar ki, sıfırdır; sonradan qəbul edilərsə, bütün istifadəçi bazasının köçürülməsini tələb edir. (1) Vətəndaş/ qurum zəncir hesabı əvvəldən AĞILLI KONTRAKT RƏQƏMSAL CÜZDANI olur (EOA deyil); (2) açar sahələri qəti şəkildə ayrılır — şəxsiyyət/aktiv/agent — və AKTİV bərpası şəxsiyyət escrow-undan ayrıdır, İSTİFADƏÇİNİN SEÇDİYİ bərpaçılarla həyata keçirilir (məcburi dövlət yox); (3) nümayəndəlik reyestri əhatə baxımından ümumidir (scope-generic); (4) credential-gating ümumi kontrakt primitividir; (5) öz token yoxdur, lakin token standartı qadağan edilmir — buraxılış FINANCE sənədi verən qurumların icazə siyahısına bağlıdır. Bu qərarlar contracts/ implementasiyası üçün məcburi məhdudiyyətdir.
domain: Governance
translation_of: ADR-0003
source_version: "1.0.0"
---

# ADR-0003 — Dəyər Qatı Qarmaqları

**Status:** Accepted
**Tarix:** 2026-08-06
**Qərar verən:** Tamga Network layihə rəhbərliyi
**Mənbə:** `docs/tamga-network-varlik-katmani-strateji.md` §4 +
`docs/tamga-network-cuzdan-odeme-agent.md` §2, §4 (strateji giriş
qaralamaları). Strategiyanın əsaslandırması → [[PM-AUTH-0001]].

---

# Kontekst

[[PM-AUTH-0001]] qərarı: Tamga **avtorizasiya qatıdır**, hesablaşma qatı
deyil; qısa müddətdə heç bir ödəniş funksiyası qurulmur. Lakin dəyər/ödəniş/agent
qapısını gələcəkdə aça bilmək **bu gün qəbul ediləcək bir neçə memarlıq qərarından** asılıdır. Bu
qərarların ortaq cəhəti: **bu gün xərci demək olar ki, sıfırdır, sonradan isə praktikada
mümkünsüzdür** (bütün istifadəçi bazasını yeni hesablara köçürmək lazım gəlir). Buna görə
`contracts/` Solidity yazılmazdan **əvvəl** onların sabitlənməsi məcburidir.

Bu ADR [[ADR-0001]] (Besu/EVM) və [[ADR-0002]] (suverenlik-öncəlikli idarəetmə)
üzərində qurulur; dəyər qatı X.509 və DID qərarından ([[DECISIONS]] D-ID-1)
**asılı deyil** (A qatı = EVM ünvanı istənilən halda mövcuddur).

---

# Qərar

## Qərar 1 — Zəncir hesabı əvvəldən ağıllı kontrakt rəqəmsal cüzdanıdır (EOA deyil)

Vətəndaşın/qurumun zəncir hesabı sadə açar-ünvan uyğunluğu (EOA) deyil, **kontrakt
hesabı** (account abstraction, ERC-4337 üslubunda) olmalıdır — hətta bu gün yalnız şəxsiyyət
əməliyyatları aparsa belə.

Bu yeganə qərar sonradan aşağıdakıları mümkün edir: bərpa, xərcləmə limitləri, agent
nümayəndəliyi, gas sponsorluğu, çoxlu imza, siyasət qaydaları. Bundan əlavə, **gas
sponsorluğu** dövlət xidməti üçün məcburidir — vətəndaş "gas token" əldə etməyə
məcbur olmamalıdır. EOA ilə başlanarsa, bunların heç biri sonradan əlavə edilə bilməz.

**Bugünkü xərc:** Bir kontraktı deploy etmək. ~sıfır.

## Qərar 2 — Açar sahələrini qəti ayırın + bərpanı ayırın

Üç ayrı törətmə yolu (derivation path), üç ayrı həyat dövrü:

```
Identity key → credential presentation, pseudonym derivation.  Not recoverable*. Not delegable.
Asset key    → chain transactions, value transfer.             Recoverable. Delegable within limits.
Agent key    → transactions within a delegation.               Time-limited. Revocable instantly.
```

**Bərpanın ayrılması (məcburi):** Bərpa mexanizmi **yalnız aktiv açarına/
hesabına** tətbiq olunur. Şəxsiyyət açarı və [[t:credential|rəqəmsal sənədlər]] bu mexanizmə **heç vaxt** daxil
edilmir — əks halda "bərpaçılar" şəxsiyyəti ələ keçirə bilər. (*Şəxsiyyət/[[t:pseudonym|psevdonimlər]]
əsas toxumdan deterministik olaraq yenidən yaradılır; rəqəmsal sənədlər [[t:issuer|sənədi verən qurumdan]] yenidən
tələb edilir — bunlar "bərpa" deyil, yenidən törətmə/tələbdir.)

**Bərpaçıların tərkibi (qərar, 2026-08-06):** Aktiv rəqəmsal cüzdanının bərpaçılarını
**istifadəçi özü seçir** (ailə/etibarlı şəxslər + **istəyə bağlı** qurum), M-of-N
hədd + vaxt kilidi ilə. **Məcburi dövlət qurumu bərpaçı DEYİL** — çünki bu, məhz
[[PM-AUTH-0001]]-da qaçınılan senzura/təzyiq paradoksunu pul sahəsinə yenidən
gətirərdi. Aktiv bərpası şəxsiyyət escrow-undan ([[SPEC-BC-0002]] guardian) **ayrı və
müstəqil** mexanizmdir. Konkret M-of-N, vaxt kilidinin müddəti və sui-istifadə
ssenariləri → PM-ID-0003.

**Bugünkü xərc:** Rəqəmsal cüzdanda üç törətmə yolu. ~bir günlük iş.

## Qərar 3 — Nümayəndəlik reyestri əhatə baxımından ümumidir (scope-generic)

Agent nümayəndəlik kontraktı bu gün yazılır, lakin əhatələr ödənişdən kənar saxlanılır
(`logistics:verify`, `health:read`). `scope` sahəsi string əvəzinə **genişləndirilə bilən**
şəkildə layihələndirilir; gələcəkdə `pay:*` əhatəsini əlavə etmək bir sətirlik iş olur. Ödənişə xas nümayəndəlik
sistemini sonradan yazmaq mövcud bütün nümayəndəlikləri etibarsız edərdi.

Nümayəndəliyin dəyişməz prinsipləri (SPEC-AGENT-0001-də ətraflı verilir): agent-in öz şəxsiyyəti
yoxdur, törəmə səlahiyyəti var; **müddətsiz nümayəndəlik yoxdur** (`validUntil` məcburidir); **ani
[[t:revocation]] (kill switch)** şərtsizdir; **məsuliyyət vəlinin üzərindədir**; hər əməliyyat nümayəndəlik
istinadı ilə loglanır; agent şəxsiyyət rəqəmsal sənədini **təqdim edə bilməz** (yalnız əməliyyat səlahiyyəti).

## Qərar 4 — Credential-gating ümumi primitiv olsun

"Bu əməliyyatı etmək üçün filan rəqəmsal sənəd tələb olunur" qaydası ödənişə xas deyil, ümumi
kontrakt kitabxanası olmalıdır:

```solidity
modifier requiresCredential(bytes32 credentialType, bytes calldata proof) { ... }
```

Bu gün rəqəmsal sənədin yoxlanmasında, sabah isə "bu köçürməni yalnız KYC keçmiş hesablar edə bilər"
qaydasında **eyni primitiv** işləyir. [[SPEC-BC-0001]] StatusList/IssuerRegistry
yoxlaması ilə uzlaşır.

> **Daraltma (2026-09-10, [[SPEC-AGENT-0001]]):** Bu qərar **daraldılıb**.
> [[ADR-0008]] ilə ləğv siyahısı zəncirdən kənara çıxarıldığı üçün zəncir
> rəqəmsal sənədin etibarlılığını görə bilmir; buna görə **Faza 0-da zəncirüstü
> credential-gating yoxdur** və `requiresCredential` zəncir primitivi
> kimi yazılmır. Yoxlama off-chain ([[SPEC-API-0001]]) aparılır. Gələcəkdə
> açılma yolu (qeydiyyatdan keçmiş [[t:verifier|yoxlayan tərəfin]] imzalı bəyanatı + təzəlik + [[t:nonce]]) layihə
> kimi [[SPEC-AGENT-0001]] §4-də qeydə alınıb. Qərar 3 (nümayəndəlik) bundan təsirlənmir.

## Qərar 5 — Öz token-inizi buraxmayın, lakin token standartını qadağan etməyin

İdarəetmədə və texniki memarlıqda Tamga-nın **öz pul vahidinin olmadığı** açıq şəkildə
bildirilir (bu, mərkəzi bankla münasibəti əvvəldən düzgün qurur). Lakin zəncir səviyyəsində
ERC-20 yerləşdirilməsi **qadağan edilmir** — gələcəkdə mərkəzi bank və ya lisenziyalı bank tokenləşdirilmiş
depozitlərini burada emissiya etmək istəyə bilər; o zaman Tamga **emitent deyil,
ev sahibi** olur.

**Məhdudiyyət:** Token buraxma səlahiyyəti **icazə siyahısına** bağlanır — yalnız Issuer
Registry-də `FINANCE` kateqoriyasında olan, müvafiq dövlətin səlahiyyət verdiyi qurumlar
([[ADR-0002]] `onlyOwnerState` + [[SPEC-BC-0001]] IssuerCategory). Bu, icazəsiz token
spam-inin qarşısını alır və tənzimləyicilərə etibar verir.

---

# Əsaslandırma

- **Geri dönməzlik asimmetriyası:** Beş qərarın bu gün xərci ~sıfırdır; sonradan
  qəbul edilməsi istifadəçi köçünü tələb edir. Asimmetriya qəti şəkildə "indi qəbul et" istiqamətindədir.
- **Strategiya ilə uyğunluq:** Qarmaqlar funksiya deyil; heç biri bu gün ödəniş
  imkanı açmır. Fokusun itirilməsi riskini ([[PM-AUTH-0001]]) artırmırlar.
- **Suverenliklə uyğunluq:** Qərar 2 (istifadəçinin seçdiyi bərpa) və Qərar 5
  (FINANCE icazə siyahısı) senzura paradoksunu pul sahəsindən uzaq saxlayır.

---

# Nəticələr (contracts/ üçün məcburi)

1. `contracts/` rəqəmsal cüzdanı **kontrakt hesabı** kimi layihələndirilir (Qərar 1); EOA fərziyyəsi
   qəbul edilmir.
2. Rəqəmsal cüzdan/SDK **üç törətmə yolu** yaradır (Qərar 2); bərpa yalnız aktiv yoluna aiddir.
3. Nümayəndəlik kontraktı `scope`-u **genişləndirilə bilən** şəkildə yazılır (Qərar 3).
4. `requiresCredential` **ortaq kitabxana** kimi `shared/` və ya `contracts/lib`-də
   (Qərar 4).
5. Native token **yoxdur**; ERC-20 yerləşdirilməsi FINANCE-issuer **icazə siyahısı** ilə məhdudlaşdırılır
   (Qərar 5).

---

# Əlaqələr

- [[PM-AUTH-0001]] — bu ADR-in strategiya əsaslandırması.
- [[ADR-0001]] — Besu/EVM (A qatının hesab modeli).
- [[ADR-0002]] — suverenlik-öncəlikli idarəetmə (FINANCE icazəsi, `onlyOwnerState`).
- [[SPEC-BC-0001]] — Issuer Registry / IssuerCategory / StatusList (credential-gating məlumat mənbəyi).
- [[SPEC-BC-0002]] — accountable disclosure (aktiv bərpasından ayrı şəxsiyyət escrow-u).
- PM-ID-0003 (planlaşdırılır) — aktiv rəqəmsal cüzdanının bərpa tərkibinin təfərrüatı.
- [[SPEC-AGENT-0001]] — agent nümayəndəlik səthi (Qərar 3) + credential-gating
  daraltması (Qərar 4).

Beş qarmaq qərarı sabitləndi (2026-08-06). `contracts/`
implementasiyası bu məhdudiyyətlərə əməl edir. Bərpa tərkibi və agent nümayəndəliyinin təfərrüatı
ayrı sənədlərə həvalə edildi. **2026-09-10:** Qərar 4 [[SPEC-AGENT-0001]] ilə
daraldıldı (Faza 0-da zəncirüstü credential-gating yoxdur; bax: Qərar 4 qeydi).
