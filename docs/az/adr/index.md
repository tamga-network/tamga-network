---
title: Arxitektura qərarlarının qeydləri (ADR)
---

# Arxitektura qərarlarının qeydləri (ADR)

ADR Tamga Network-da qəbul edilmiş və məcburi qüvvə qazanmış qərarın daimi qeydidir: hansı problem var idi, hansı
variantlar nəzərdən keçirildi, hansı qərar verildi və bunun nəticələri nələrdir. Bağlanmış qərar yalnız yeni ADR ilə
dəyişdirilə bilər; köhnə qeyd silinmir, "əvəz olundu" kimi işarələnir.

<AdrTable />

## ADR-in strukturu

| Bölmə | Məzmun |
|---|---|
| Kontekst | Qərarı zəruri edən vəziyyət və məhdudiyyətlər |
| Qərar | Nömrələnmiş qərar bəndləri (K1, K2, …) |
| Nəzərdən keçirilən variantlar | Alternativlər, onların üstünlükləri və çatışmazlıqları, niyə seçilmədikləri |
| Nəticələr | Təsirə məruz qalan sənədlər, kod və istismar |
| İnvariantlar | Qərardan irəli gələn məcburi qaydalar (məs. `ADR-0017/HV1`); [məcburi qaydalar səhifəsinə](/rules) daxil edilir |
| Status | Təklif → Qəbul edildi → (lazım olduqda) Əvəz olundu; qəbul tarixi |

## Proses

1. Təklif kimi yazılır (status: Təklif).
2. Layihə rəhbərliyi qəbul edir; tarix qeyd olunur və qərar `D-*` kodu alır.
3. Təsirə məruz qalan spesifikasiyalar və [Tamga ARF](https://arf.tamga.network/az/) sənədləri eyni iş çərçivəsində yenilənir.
