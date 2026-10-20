---
title: Spesifikasiyalar
---

# Spesifikasiyalar

Spesifikasiyalar Tamga Network-un dəqiq qaydalarıdır: [[t:credential|rəqəmsal sənədin]] necə yazıldığı, necə verilib təqdim edildiyi,
[[t:trust-list|etibar siyahılarının]] formatı. Kod bunlara uyğun yazılır; uyğunluq testləri (`conformance/`) bunları yoxlayır.

Yeni başlayırsınızsa, əvvəlcə [Anlayışlar](/concepts/) səhifələrini və [Başlanğıc](/guides/) bələdçilərini oxuyun; spesifikasiyaya
hər hansı qaydanın tam mətni lazım olduqda müraciət edin. Hər spesifikasiya qısa "Qısaca" bölməsi ilə başlayır, qaydalar və təfərrüatlar ondan sonra gəlir.

## Rəqəmsal sənədlər

| Spesifikasiya | Nədən bəhs edir |
|---|---|
| [[SPEC-CRED-0001]] | Rəqəmsal sənəd formatı və protokolların ümumi çərçivəsi |
| [[SPEC-CRED-0002]] | SD-JWT VC rəqəmsal sənədinin bayt səviyyəsində yazılışı |
| [[SPEC-CRED-0003]] | Ləğv və ləğv siyahısı |

## Protokollar

| Spesifikasiya | Nədən bəhs edir |
|---|---|
| [[SPEC-PROTO-0001]] | Sənədi verən qurumun rəqəmsal cüzdana sənəd verməsi (OpenID4VCI) |
| [[SPEC-PROTO-0002]] | Rəqəmsal cüzdanın yoxlayan tərəfə sənəd təqdim etməsi (OpenID4VP) |
| [[SPEC-API-0001]] | Yoxlama xətti və xidmət API-si |

## Etibar və şəxsiyyət

| Spesifikasiya | Nədən bəhs edir |
|---|---|
| [[SPEC-TRUST-0001]] | Etibar siyahılarının formatı və dərc edilməsi |
| [[SPEC-ID-0002]] | Qurumun eyniləşdirilməsi: X.509 sertifikatları |
| [[SPEC-ID-0003]] | Rəqəmsal sənəd verilməzdən əvvəl şəxsiyyətin yoxlanılması |

## Sxemlər

| Spesifikasiya | Nədən bəhs edir |
|---|---|
| [[SPEC-SCHEMA-0001]] | Sxem kataloqu (`schemas.tamga.network`) |
| [[SPEC-SCHEMA-0002]] | Education sxemləri: tələbə sənədi və diplom |
| [[SPEC-SCHEMA-0003]] | Digər sektorlar üçün skelet və açılma şərtləri |

## Rəqəmsal cüzdan

| Spesifikasiya | Nədən bəhs edir |
|---|---|
| [[SPEC-WALLET-0001]] | Uyğun rəqəmsal cüzdanın daxili qaydaları |

---

İdentifikatorlar (`SPEC-…`) daimidir; fayl adı və ya başlıq dəyişsə belə, istinadlar pozulmur. Bütün məcburi qaydaların vahid siyahısı:
[Məcburi qaydalar](/rules).

Zəncir mərhələsinə aid spesifikasiyalar (etibar qatı kontraktları, agent səlahiyyətləndirməsi) bu gün istifadə olunmur; zəncir mərhələsi açıldıqda
dərc ediləcək.
