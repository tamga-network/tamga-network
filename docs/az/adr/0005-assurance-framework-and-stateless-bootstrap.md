---
document_id: ADR-0005
title: "Təminat modeli və dövlətsiz başlanğıc"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-02
summary: >
  Tamga-nın etibar səviyyəsi modelini QƏRAR kimi təsbit edir: etibar iki müstəqil oxda ölçülür — Holder/Wallet Assurance (T0–T3) və Issuer Assurance (I1–I3) — və yoxlayan tərəfin qərarı bu ikisinin HASİLİDİR. Bundan əlavə, dövlətsiz bootstrap qəbul edilir: dövlətlər şəbəkəyə qoşulana qədər etibar mövcud Türkiyə qurumlarından (e-imza/NES=T3, bank/GSM=T1, KYC/qurum masası=T2) MİRAS ALINARAQ yaradılır. Öz səviyyələrimiz eIDAS LoA-ya 1:1 uyğunlaşdırılır. Ətraflı əsaslandırma → PM-ASSUR-0001.
domain: Identity
translation_of: ADR-0005
source_version: "1.0.0"
---

# ADR-0005 — İki oxlu Assurance modeli və dövlətsiz bootstrap

**Status:** Accepted
**Tarix:** 2026-09-03
**Qərarı verən:** Tamga Network layihə rəhbərliyi
**Mənbə:** `tamga-guven-cercevesi-v0.1.md` (Bölmə B, D) — iş qeydi; strategiya əsaslandırması
və tam model → [[PM-ASSUR-0001]].

---

# Kontekst

[[PM-ID-0001]] §6.2 assurance səviyyələrinin olacağını və [[t:eIDAS]] [[t:LoA]]-yə uyğunlaşdırılacağını
bildirdi, lakin səviyyələri müəyyən etmədi. [[PM-PH-0001]] (§Gələcək, maddə 5) "infrastruktur dövlət olmadan
da işləyə bilməlidir" dedi, lakin bunun *necə* olacağını açıq qoydu. Bu iki boşluq şəbəkənin
dövlətlər qoşulmazdan əvvəl (Faz 0, [[ARCH-0001]]) işləməsinə mane olurdu.

Qərar bu boşluqları aradan qaldırır və etibarın ölçülməsini tətbiq oluna bilən edir.

---

# Qərar

## Qərar 1 — Etibar iki oxda ölçülür (tək rəqəm deyil)

- **Ox A — Holder/Wallet Assurance: T0 (anonim) → T1 (aşağı) → T2 (əhəmiyyətli) → T3 (yüksək).**
- **Ox B — Issuer Assurance: I1 (qeydiyyatlı) → I2 (müqaviləli) → I3 (akkreditə olunmuş).**
- **[[t:verifier]] qərarı = Ox A × Ox B (hasil, cəm deyil).** Yüksək [[t:holder]] + akkreditə
  olunmamış [[t:issuer]] = dəyərsiz; akkreditə olunmuş sənədi verən qurum + T0 sənəd sahibi = dəyərsiz.
- **IssuerCategory ≠ Issuer Assurance:** [[SPEC-BC-0001]] kateqoriyası sektoru, I1–I3 isə
  akkreditasiya dərəcəsini göstərir; bunlar bir-birinə ortoqonaldır.

## Qərar 2 — Dövlətsiz bootstrap qəbul edilir

Dövlətlər şəbəkəyə qoşulana qədər etibar mövcud Türkiyə qurumlarından **miras alınır** (derived
assurance). Heç bir səviyyə dövlətlə saziş tələb etmir:

- **T3** ← e-imza/NES/Mobil İmza ilə challenge-in ([[t:nonce]]) imzalatdırılması (BTK ESHS kök yoxlaması).
- **T2** ← məsafədən KYC / NFC pasport / **qurumun qeydiyyat masası** (universitet/palata = Qeydiyyat Orqanı).
- **T1** ← bank mikro-köçürməsi / GSM xəttinə sahiblik.
- **Issuer Assurance I1–I3** ← Tamga müvəqqəti olaraq Root TAO rolunda akkreditasiya edir.

Dövlət qoşulduqda (Faz 1) bu aradan qalxmır; **PID Provider** T3-ün yanına daha geniş baza
və yüksək qeydiyyat keyfiyyəti əlavə edərək ([[t:PID]]) defolt yüksək LoA mənbəyinə çevrilir.

## Qərar 3 — Öz səviyyələrimiz eIDAS LoA-ya 1:1 uyğunlaşdırılır

T1≈Low, T2≈Substantial, T3≈High. Daxildə qeydiyyat/authenticator/yoxlama ölçülərini ayrıca
nəzərdən keçirmək imkanı (NIST 800-63 üslubunda) saxlanılır; xaricə vahid eIDAS LoA kimi təqdim olunur →
EUDI/EBSI interop itkisi yoxdur ("uyğun, lakin müstəqil", [[PM-PH-0001]]).

## Qərar 4 — Assurance decay və istifadəçiyə rəqəm göstərilməməsi

- Səviyyə zamanla/hadisə ilə **aşağı salınır** (cihaz dəyişikliyi → T1, istifadəsiz qalma, mənbə [[t:credential]]
  müddətinin bitməsi, anomaliya).
- Son istifadəçiyə **rəqəm göstərilmir** (vəziyyət göstərilir); rəqəmlər yoxlayan tərəfin siyasət
  mühərrikinə aiddir.

---

# Əsaslandırma

- **eIDAS/EBSI presedenti:** iki ox eIDAS sənəd sahibi LoA-sı ilə EBSI sənədi verən qurum akkreditasiya
  zəncirinin birləşməsidir — sübut olunmuş model.
- **Dövlətsiz işləyə bilmə:** "dövlətlə sazişim yoxdur → heç kimi yoxlaya bilmərəm" fikri yanlışdır;
  derived assurance ilə bu gün T3-ə qədər təminat yaratmaq olar. Bu, layihəni dövlətdən əvvəlki dövrdə
  yaşaya bilən edən yeganə rıçaqdır.
- **İnflyasiya riski:** səviyyə meyarları yumşaldılarsa, sistem mənasızlaşır → meyarlar
  rəsmi Trust Framework-ə yazılır, onların dəyişdirilməsi prosedur baxımından çətinləşdirilir (PM-GOV-0001).

---

# Nəticələr

1. [[PM-ASSUR-0001]] bu modelin tam project-memory qeydidir (yeni `assurance/` domeni).
2. Yoxlayan tərəfin siyasət mühərriki sənəd sahibi **və** sənədi verən qurum həddini birlikdə tətbiq edir → [[ADR-0003]]
   `requiresCredential` primitivinin parametrləri.
3. [[SPEC-BC-0001]] `Issuer` struct-ına **sənədi verən qurumun təminat səviyyəsi (Issuer Assurance)** sahəsi əlavə olunur
   (sənəd sahibinin təminat səviyyəsi zəncirə yazılmır — fərdi məlumatlar, [[PM-TRUST-0001]]).
4. [[SPEC-CRED-0001]] [[t:holder-binding]] + [[t:WUA]] sənəd sahibi təminatının texniki ilkin şərtidir.
5. [[ARCH-0001]] Faz 0 dövlətsiz bootstrap qatı kimi dəqiqləşir.

---

# Əlaqələr

- [[PM-ASSUR-0001]] — tam model və əsaslandırma.
- [[PM-ID-0001]] — §6.2 burada konkretləşir; PID Provider = Faz 1 T3.
- [[PM-PH-0001]] — dövlətsiz işləyə bilmə prinsipinin qarşılığı.
- [[SPEC-CRED-0001]] / [[SPEC-BC-0001]] — texniki daşıyıcı və zəncirdə təmsil.
- [[ADR-0006]] — rəqəmsal sənəd formatı (bu qərarın daşıyıcısı).
- PM-GOV-0001 (planlaşdırılır) — səviyyə meyarlarının mətni + TAO akkreditasiyasının idarəetməsi.

İki oxlu model + dövlətsiz bootstrap + eIDAS uyğunlaşdırması +
decay + təqdimat prinsipi qəbul edildi (2026-09-03).
