---
document_id: FW-READ-0001
title: "Oxu yolu"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-16
summary: >
  Tamga ARF-i rolunuza görə hansı ardıcıllıqla oxumağınızı göstərən vahid cədvəl: sənədi verən qurum, yoxlayan tərəf, cüzdan provayderi, dövlət və tənzimləyici, auditor, proqram tərtibatçısı və fərd üçün əvvəlcə ARF-in hansı bölmələri, sonra hansı tərtibatçı sənədləri.
translation_of: FW-READ-0001
source_version: "1.0.0"
---

# 1. Necə istifadə etməli

Tamga ARF bir əsas sənəddən və beş əlavədən ibarətdir. Hər şeyi əvvəldən axıra qədər oxumağınız lazım deyil: aşağıdakı cədvəl rolunuza görə əvvəlcə
çərçivənin hansı bölmələrini, sonra hansı tətbiq sənədlərini oxumağınızı ardıcıllıqla göstərir. Tətbiq sənədləri
tərtibatçı saytındadır (docs.tamga.network); orada addımlar, kod nümunələri və spesifikasiyalar yer alır.

Bir rolun nə etdiyini və hansı qaydalara tabe olduğunu bilmirsinizsə, əvvəlcə **Rollar** səhifəsinə ([[FW-ROLE-0001]]), şəbəkəyə
qoşulmağa hazırsınızsa, **Qoşulma prosesi** səhifəsinə ([[FW-ONB-0001]]) baxın.

# 2. Rollar üzrə oxu ardıcıllığı

| Rol | 1. Çərçivə (ARF) | 2. Tətbiq (tərtibatçı sənədləri) |
|---|---|---|
| **Sənədi verən qurum** (universitet, bilet satıcısı, peşə təşkilatı) | Əsas sənəd §2–§6 → [[FW-ROLE-0001]] "Sənədi verən qurum" → Əlavə A §3.2 (qoşulma qapıları) və §5.1 (müqavilələr) → Əlavə B §4 (RB-AP) → rəqəmsal sənəd növünüzün rulebook-u (Əlavə C) → Ləğv Siyasəti ([[FW-POL-0001]]) | [[GUIDE-0007]] → [[GUIDE-0003]] → [[GUIDE-0009]] |
| **Yoxlayan tərəf** (işəgötürən, bank, veb-sayt, giriş qapısı) | Əsas sənəd §2 və §6 → [[FW-ROLE-0001]] "Yoxlayan tərəf" → Əlavə A §3.2 (yoxlayan tərəfin qeydiyyatı) → Əlavə B §7 (RB-RP) → rəqəmsal sənəd növünün rulebook-unda yoxlama siyasəti | [[GUIDE-0008]] → [[GUIDE-0002]] və ya [[GUIDE-0001]] → [[GUIDE-0006]] |
| **Cüzdan provayderi** | Əsas sənəd §2, §5, §6 və §7 → [[FW-ROLE-0001]] "Cüzdan provayderi" → Əlavə A §3.2 və §4.3 (uyğunluq testləri) → Əlavə B §6 (RB-WP) → Cüzdan Sübutu Siyasəti ([[FW-POL-0002]]) | [[GUIDE-0005]] → [[GUIDE-0010]] → [[GUIDE-0009]] → [[SPEC-WALLET-0001]] |
| **Dövlət və ya tənzimləyici** | Əlavə A (tam; xüsusilə §1.6 idarəetmə və §7 təhvil planı) → əsas sənəd §6 (etibar modeli) və §8 (idarəetmə və təhvil) → [[FW-ROLE-0001]] "Dövlət" | [[GUIDE-0011]] → [[SPEC-TRUST-0001]] |
| **Səlahiyyətli mənbə** (tələbə məlumat sistemi, dövlət reyestri) | [[FW-ROLE-0001]] "Səlahiyyətli mənbə" → Əlavə B §5 (RB-AS) → Əlavə A §3.6 (məlumatların qorunması) | Rəqəmsal sənəd növünün sxemi (məs. [[SPEC-SCHEMA-0002]]) |
| **Auditor** (uyğunluğun qiymətləndirilməsi, daxili audit) | Əlavə A §4 (uyğunluq: rejim, rollar, testlər, nəzarət, sanksiyalar, insidentlər) → Əlavə B (tam) → Əlavə E §3 (qayda mənbələri) | [[GUIDE-0009]] → invariantlar ([[INVARIANTS]]) |
| **Proqram tərtibatçısı və ya inteqrator** | Əsas sənəd §4–§6 → Əlavə B-də rolunuza aid bölmə | Tərtibatçı sənədlərinin başlanğıc bələdçiləri ([[GUIDE-0000]]) → [[GUIDE-0004]] → spesifikasiyalar |
| **Fərd** (sənəd sahibi) və ya ümumi oxucu | Əsas sənəd §1 və §2 → Əlavə B §8 (RB-H: hüquqlarınız) → Əlavə D (təriflər) | tamga.network-dəki öyrənmə yolu |

# 3. Qısa arayış

| Sual | Harada |
|---|---|
| Şəbəkədə kim nə edir? | [[FW-ROLE-0001]] |
| Şəbəkəyə necə qoşula bilərəm, hansı sənədlər tələb olunur? | [[FW-ONB-0001]], Əlavə A §3.2 |
| Hansı qaydaya əməl etməliyəm? | Əlavə B (rollar üzrə), Əlavə C (rəqəmsal sənəd növləri üzrə) |
| Rəqəmsal sənəd hansı şərtlərdə ləğv edilir? Cüzdan sübutu necə verilir? | [[FW-POL-0001]], [[FW-POL-0002]] |
| Qayda haradan qaynaqlanır? | Əlavə E §3 |
| Termin nə deməkdir? | Əlavə D |
| Şəbəkəni kim idarə edir, necə təhvil veriləcək? | Əsas sənəd §8, Əlavə A §1.6 və §7 |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
