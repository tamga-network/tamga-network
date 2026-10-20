---
document_id: ADR-0001
title: "Besu QBFT reyestri"
status: Active
version: 1.0.0
created: 2026-07-29
last_updated: 2026-10-02
summary: >
  Tamga Network-un blockchain mühərriki kimi Hyperledger Besu-nun QBFT consensus ilə istifadəsinə qərar verilmişdir. Əsaslandırma: daxili EVM (gələcək aktivlər/ödənişlər), EBSI ilə eyni texnoloji yığın, vahid zəncirin sadəliyi, icazəli/bərabər səlahiyyətli/ani yekunluq tələblərinin daxili olaraq qarşılanması və tam suverenlik. Validator miqyaslanma həddi "dövlətlər=validator, qurumlar=full node" dizaynı ilə aradan qaldırılır.
domain: Trust
translation_of: ADR-0001
source_version: "1.0.0"
---

# ADR-0001 — Blockchain Framework və Consensus: Hyperledger Besu (QBFT)

**Status:** Accepted
**Tarix:** 2026-07-29
**Qərarı verən:** Tamga Network layihə rəhbərliyi

---

# Kontekst (Context)

[[PM-BC-0001]] Tamga-nın öz suveren, açıq mənbəli, icazəli, hər dövlət üçün bərabər səlahiyyətli, BFT/PoA consensus-lu şəbəkəsini qurmağa qərar verdi; lakin konkret çərçivə/mühərrik seçimini (Qat 4) şüurlu şəkildə açıq saxladı.

[[RS-FRAMEWORKS-0001]] iki namizədi müqayisə etdi:
- **Hyperledger Besu** (QBFT)
- **Cosmos SDK** (CometBFT)

Qiymətləndirmə Tamga-nın tələblərinə əsasən aparıldı: icazəlilik, bərabər səs, ani yekunluq, suverenlik, vahid ortaq zəncir, gələcəkdə aktiv/ödəniş imkanı, EBSI ilə qarşılıqlı uyğunluq.

---

# Qərar (Decision)

> Tamga Network-un blockchain mühərriki **Hyperledger Besu** olacaq və **QBFT** consensus ilə işləyəcəkdir.

Alt qərarlar:
- Şəbəkə **icazəli, müstəqil özəl şəbəkə** kimi qurulur (öz genesis-i, öz chain ID-si). Ethereum əsas şəbəkəsinə və ya başqa şəbəkəyə bağlı deyil.
- **Consensus:** QBFT (2/3+ ixtisaslı çoxluq, single-block finality). Validatorların səs gücü bərabərdir (PoA).
- **Validator = dövlətlər; full node = etibarlı qurumlar.** (Miqyaslanma və bərabər səlahiyyət prinsipi üçün.)
- **Ağıllı müqavilə:** EVM / Solidity — gələcək aktiv, transfer və ödəniş imkanları bu qatda hazırlanır.
- QBFT ilə IBFT 2.0 arasında yekun tənzimləmə tətbiq mərhələsində dəqiqləşdirilir (ADR yenilənə bilər).

---

# Əsaslandırma (Rationale)

1. **Daxili EVM → gələcək imkanlar.** Besu-nun EVM-i aktiv/ödəniş/saxlama funksiyalarını yetkin ERC şablonları ilə birbaşa mümkün edir (Cosmos-da bu əlavə qatdır).
2. **EBSI ilə eyni yığın.** EBSI Besu + IBFT 2.0 istifadə edir (RS-EBSI-0001). Eyni əsas qarşılıqlı uyğunluğu və bilik transferini asanlaşdırır.
3. **Vahid zəncirin sadəliyi.** Cosmos-un çoxzəncirli/IBC üstünlüyü Tamga-nın "vahid ortaq zəncir" qərarı çərçivəsində istifadəsiz qalır.
4. **Daxili uyğunluq.** İcazəlilik, PoA/bərabər səs və ani yekunluq Besu QBFT-də birbaşa təmin olunur.
5. **Tam suverenlik.** Apache 2.0, öz şəbəkəmiz, fork edilə bilər; heç bir şirkətdən/şəbəkədən asılılıq yoxdur.

---

# Nəticələr (Consequences)

**Müsbət:**
- Aktiv/ödəniş yol xəritəsi üçün hazır zəmin (EVM).
- EBSI ilə texniki yaxınlıq → interoperability asanlığı.
- Yetkin alət/tərtibatçı ekosistemi.
- Sadə, vahid şəbəkə əməliyyatı.

**Diqqət / xərc:**
- QBFT ~20 validatordan yuxarıda çətinlik çəkir → "dövlətlər=validator, qurumlar=full node" dizaynı ilə həll edildi; dövlətlərin sayı çox artarsa, miqyaslanma strategiyası lazım olacaq ([[PM-BC-0001]] Gələcək).
- Java əsaslı əməliyyat təcrübəsi tələb olunur.
- TPS Cosmos-dan aşağıdır; lakin etibar infrastrukturunun iş yükü üçün kifayətdir.

---

# Nəzərdən keçirilmiş alternativlər

- **Cosmos SDK (CometBFT):** Validator miqyaslanması və TPS baxımından üstündür; lakin EVM daxili deyil, çoxzəncirli üstünlük Tamga-da istifadəsiz qalır, EBSI-dən fərqli yığındır. Rədd edildi.
- **Sıfırdan consensus:** [[PM-BC-0001]]-da artıq rədd edilib (risk, müddət, suverenliyə töhfəsi yoxdur).
- **Ethereum L1/L2 üzərində qurmaq:** [[PM-BC-0001]]-də rədd edilib (suverenlik itkisi, GDPR baxımından risk).

---

# Əlaqəli sənədlər

- [[PM-BC-0001]] — Bu ADR oradakı açıq "Qat 4" qərarını bağlayır.
- [[RS-FRAMEWORKS-0001]] — Bu qərarın əsaslandığı müqayisə.
- RS-EBSI-0001 — EBSI presedenti (Besu + IBFT 2.0).
- ACA-BC-0001 — Consensus əsasları.
