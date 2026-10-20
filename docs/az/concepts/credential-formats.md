---
title: Rəqəmsal sənəd formatları
---

# Rəqəmsal sənəd formatları

Tamga [[t:credential|rəqəmsal sənədləri]] iki standart formatda verilir. Hər ikisi Aİ-nin rəqəmsal şəxsiyyət cüzdanında istifadə olunan
formatlardır.

| | SD-JWT VC | ISO mdoc (ISO/IEC 18013-5) |
|---|---|---|
| Harada | İnternet üzərindən təqdimat (sayt, işəgötürən, qurum) | Üzbəüz təqdimat (qapı, turniket, kassa) və şəxsiyyət |
| Struktur | JSON; hər sahə ayrıca gizlədilə bilər | CBOR; sahələr ad sahələrində, imzalanmış heşlərlə |
| İdentifikator | `vct` = `urn:tamga:<alan>:<Tür>:<sürüm>` | `docType` |
| Holder binding | `cnf` açarı; hər təqdimatda cihaz imzası (KB-JWT) | cihaz açarı; sessiyaya bağlı cihaz imzası |

Şəxsiyyət sənədi hər iki formatda verilir ([[t:SD-JWT-VC]] və [[t:mdoc]], eyni cihaz açarına bağlı); digər rəqəmsal sənədlər bu gün
SD-JWT VC formatındadır. Cihaz imzası [[t:KB-JWT]] ilə rəqəmsal sənədin həmin telefondakı açara bağlı olduğu ([[t:holder-binding]]) sübut edilir.

## Rəqəmsal sənəd növləri və kataloq

Hər rəqəmsal sənəd növünün təsviri (göstərilən adlar, sahələr, hansı sahənin gizlədilə bildiyi) və JSON sxemi
`https://schemas.tamga.network/v1/catalogue.json` ünvanındakı [[t:schema-catalogue|sxem kataloqundadır]]. Rəqəmsal sənəd öz növünün
təsvirinə ([[t:vct]]) `vct#integrity` heşi ilə bağlıdır; [[t:verifier|yoxlayan tərəf]] təsvirin dəyişmədiyini yoxlayır.

| Növ | Kim verir |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | universitet |
| `urn:tamga:edu:DiplomaCredential:1` | universitet |
| `urn:tamga:id:IdentityAttestation:1` | şəxsiyyət xidməti (müvəqqəti; dövlətin şəxsiyyət sənədi gələnədək) |
| `urn:tamga:id:DrivingLicenceAttestation:1` | şəxsiyyət xidməti — sürücülük vəsiqəsi məlumatı; rəsmi sürücülük vəsiqəsi deyil, şəxsiyyət sənədi ilkin şərtdir |
| `urn:tamga:tkt:EventTicket:1` | bilet satıcısı |
| `urn:tamga:contact:EmailAddress:1`, `PhoneNumber:1` | şəxsiyyət xidməti |

## Ətraflı

- Rəqəmsal sənəd formatı: [[SPEC-CRED-0001]], SD-JWT VC profili: [[SPEC-CRED-0002]]
- Sxem kataloqu: [[SPEC-SCHEMA-0001]], təhsil: [[SPEC-SCHEMA-0002]], sektorlar: [[SPEC-SCHEMA-0003]]
- Paketlər: [`@tamga-network/sd-jwt`](/packages/sd-jwt), [`@tamga-network/mdoc`](/packages/mdoc), [`@tamga-network/schemas`](/packages/schemas)
