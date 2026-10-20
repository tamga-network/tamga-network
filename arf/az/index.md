---
title: Tamga ARF
aside: false
---

# Tamga ARF

<span class="arf-release">Buraxılış 1.0 · 16 oktyabr 2026</span>

**Tamga Network-un Arxitektura və İstinad Çərçivəsi** — türk dünyası üçün, [[t:eIDAS]] 2.0 və Avropa Rəqəmsal Şəxsiyyət
Cüzdanı ekosistemi ilə uyğun rəqəmsal etibar infrastrukturu. Tamga [[t:ARF]] kimin, hansı qaydalarla və hansı arxitektura ilə
iştirak etdiyini izah edir: istifadə halları, rollar, arxitektura, məlumat modeli, etibar modeli, təhlükəsizlik və idarəetmə,
həmçinin hər iştirakçının məcburi qaydaları.

Avropa İttifaqının (Aİ) ARF-inin quruluşunu izləyir: bir əsas sənəd və beş əlavə (Əlavə C dörd rulebook-dan ibarətdir; onların
quruluşu Aİ Attestation Rulebook şablonunu izləyir) və iki siyasət. Məcburi qaydalar vahid əsas kitabda — **Tamga
[[t:rulebook|Rulebook]]**-da toplanır; hər sənəd növünün bu kitabdan ayrılan öz rulebook-u var.

## Sənədlər

| Sənəd | Versiya | Kim üçün |
| --- | --- | --- |
| [Arxitektura və İstinad Çərçivəsi](/az/architecture) | 1.0.0 | hamı — buradan başlayın |
| [Əlavə A — Trust Framework](/az/trust-framework) | 1.0.0 | tənzimləyicilər, dövlətlər, qurumlar: idarəetmə, iştirak, uyğunluq, müqavilələr, təhvil |
| [Əlavə B — Tamga Rulebook](/az/rulebook) | 1.0.0 | hər iştirakçı: rollar üzrə ortaq, nömrələnmiş qaydalar |
| Əlavə C — Rulebook-lar | | Tamga Rulebook-dan ayrılan sənəd növü qaydaları: |
| · [Education Rulebook](/az/rulebooks/education) | 1.0.0 | universitetlər və yoxlayan tərəflər: tələbə sənədi və diplom |
| · [Identity Rulebook](/az/rulebooks/identity) | 1.0.0 | qurumlar və yoxlayan tərəflər: müvəqqəti şəxsiyyət sənədi |
| · [Event Ticket Rulebook](/az/rulebooks/event-ticket) | 1.0.0 | bilet satıcıları və giriş nöqtələri |
| · [Contact Rulebook](/az/rulebooks/contact) | 1.0.0 | saytlar və qurumlar: təsdiqlənmiş e-poçt ünvanı və telefon nömrəsi |
| [Əlavə D — Təriflər](/az/definitions) | 1.0.0 | terminlər və qısaltmalar |
| [Əlavə E — Mənbələr](/az/references) | 1.0.0 | standartlar, Tamga sənədləri və hər qaydanın mənbəyi |
| [Ləğv Siyasəti](/az/policies/revocation) | 1.0.0 | sənədi verən qurumlar, yoxlayan tərəflər, şəxslər: sənəd hansı hallarda ləğv edilir |
| [Cüzdan Attestasiyası Siyasəti](/az/policies/wallet-attestation) | 1.0.0 | cüzdan provayderləri və sənədi verən qurumlar: WIA və KA-nın verilməsi və ləğvi |
| [Oxu yolu](/az/reading-path) | 1.0.0 | rolunuza görə nəyi hansı ardıcıllıqla oxumalı olduğunuz |
| [Rollar](/az/roles) | 1.0.0 | hər rolun təfərrüatı: nə edir, qaydaları, nəyə ehtiyac duyur |
| [Qoşulma prosesi](/az/onboarding) | 1.0.0 | qoşulmanın addımları, fəaliyyətin dayandırılması və çıxış |

## Necə oxumalı

[Oxu yolu](/az/reading-path) hər rol üçün əvvəlcə çərçivənin hansı bölmələrini, sonra hansı tərtibatçı sənədlərini
oxuyacağınızı göstərir. [Tərtibatçı sənədləri](https://docs.tamga.network/az/) inteqrasiya bələdçilərini, kod nümunələrini və bu
çərçivənin əsaslandığı spesifikasiyaları əhatə edir.

## Harada dayanır

| Qat | Aİ-də | Tamga-da |
| --- | --- | --- |
| Hüquq və idarəetmə | eIDAS 2.0 və icra aktları | Əlavə A — Trust Framework |
| Arxitektura və rollar | Aİ ARF | Əsas sənəd |
| İştirakçı qaydaları | Aİ ARF Əlavə 2 (yüksək səviyyəli tələblər) | Əlavə B — Tamga Rulebook |
| Sənəd növü qaydaları | Attestation rulebook-ları | Əlavə C — Rulebook-lar |
| Texniki standartlar | ETSI, IETF, OpenID, ISO | Tamga spesifikasiyaları (docs.tamga.network), Əlavə E-də siyahılanıb |

## Dil və status

Tamga ARF ingilis və türk dillərində dərc olunur. Türkcə mətn mənbədir; ingiliscə mətn eyni versiyanın rəsmi tərcüməsidir.
Azərbaycan dilindəki mətn türkcə mənbədən avtomatik tərcümədir və rəsmi deyil; ziddiyyət olduqda türkcə mətn əsas götürülür.

## Buraxılışlar

- **1.0 (16 oktyabr 2026)** — cari buraxılış. İctimai elana qədər dəyişikliklər bu buraxılışın daxilində edilir.

Sənədlər CC BY 4.0 · Kod Apache-2.0.
