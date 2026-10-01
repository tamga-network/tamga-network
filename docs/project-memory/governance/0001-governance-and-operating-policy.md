---
document_id: PM-GOV-0001
title: Yönetişim ve İşletim Politikası — Kodla Sınırlanamayan Yetkiler
category: Governance
domain: Governance
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-09
last_updated: 2026-09-09
authors:
  - Tamga Network Engineering
language: tr
document_type: project-memory
audience:
  - engineers
  - architects
  - operators
  - ai-agents
stability: Stable
maturity: Foundational
tags:
  - governance
  - policy
  - centralization
  - transparency
  - phase-transition
  - commitments
keywords:
  - soft power operational control
  - hosted status service centralization
  - CDN access log commitment
  - indexer operation policy
  - schema usage statistics k-anonymity
  - domain custody succession
  - tripwire threshold
  - transparency report
related:
  - ADR-0002
  - PM-PH-0001
  - PM-TRUST-0001
  - PM-SCHEMA-0001
  - ARCH-0001
  - ARCH-0003
  - ARCH-0004
  - SPEC-SCHEMA-0001
  - SPEC-CRED-0003
depends_on:
  - ADR-0002
  - PM-PH-0001
summary: >
  [[ADR-0002]] egemenliği KODA gömdü — `onlyOwnerState` iyi niyete bağlı değil.
  Ama vakfın Faz 0'da tuttuğu yetkilerin çoğu kodla sınırlanamaz: CDN'i kim
  işletir, status barındırma kimde, indeksleyiciyi kim çalıştırır, alan adı
  kimin elinde. Bunlar "yumuşak güç"tür ve yalnızca politika, sözleşme ve
  şeffaflıkla sınırlanır. Bu doküman o yetkileri sayar, beş birikmiş politika
  kararını (barındırılan status, CDN logu, indeksleyici işletimi, şema
  istatistikleri, alan adı devri) kapatır, ölçülebilir TRIPWIRE eşikleri koyar
  ve verilmiş kamusal taahhütleri denetlenebilir bir kütüğe alır.
priority: Critical
---

# Giriş

[[ADR-0002]] sert problemi çözdü: egemenlik `onlyOwnerState` ile koda gömülü,
iyi niyete bağlı değil. Türkiye'nin anahtarı Kazakistan'ın kaydına yazamaz —
kontrat revert eder.

Ama bu, gücün tamamı değil.

Faz 0'da vakıf şunları işletiyor: `schemas.tamga.network`, indeksleyiciler,
bootnode'lar, dört validator, muhtemelen küçük kurumların status sunucuları, ve
`tamga.network` alan adının kendisi.

**Bunların hiçbiri kontratla sınırlanamaz.** Bir kontrat "CDN erişim logu tutma"
diyemez. "Barındırdığın issuer'ların iptallerini okuma" diyemez. Bunlar
politika, sözleşme ve şeffaflık meseleleridir.

Bu doküman o boşluğu kapatır.

---

# Problem — İki Tür Güç

| | Kodla sınırlanan | Kodla sınırlanamayan |
|---|---|---|
| **Ne** | Kayıt yazma, oylama, yükseltme | İşletim, barındırma, veri görünürlüğü |
| **Nasıl** | `onlyOwnerState`, 2/3, UUPS yetkisi | Politika, sözleşme, denetim |
| **İhlal edilirse** | İşlem revert eder | **Kimse fark etmez** |
| **Örnek** | Yabancı devlet kaydı değiştiremez | Vakıf CDN loglarından kim ne doğruladı görebilir |

Sağ sütun daha tehlikelidir çünkü ihlali **sessizdir** — [[ARCH-0005]] §3'teki
tedarik zinciri argümanının yönetişim katmanındaki karşılığı.

## Vakfın Faz 0'da tuttuğu yumuşak yetkiler

| # | Yetki | Neyi görebilir / yapabilir |
|---|---|---|
| Y1 | `schemas.tamga.network` işletimi | Kim hangi tipi ne zaman çözümledi |
| Y2 | Barındırılan status sunucuları | O kurumların **tüm iptalleri** ve zamanlaması |
| Y3 | İndeksleyici işletimi | Doğrulama trafiği — kim kimi doğruluyor |
| Y4 | Dört validator | Faz 0'da tek başına konsensüs |
| Y5 | Alan adı sahipliği | Tüm `vct` tanımlayıcılarının çözümlenebilirliği |
| Y6 | SDK yayın hattı | Bkz. [[ARCH-0005]] §3 |

Y4 zaten [[ARCH-0001]] §3'te fazlı validator modeliyle ele alınmış. Kalan
beşi bu dokümanın konusu.

---

# İlke — Devredilmek Üzere Tasarla

Her yumuşak yetki için üç soru sorulur:

1. **Ne görüyor?** Görmemesi gerekeni görmemesi için teknik önlem var mı?
2. **Ne zaman devredilecek?** Faz geçişi tetikleyicisi nedir?
3. **Devredilmezse ne olur?** Ölçülebilir bir eşik (tripwire) var mı?

Üçüncüsü kritiktir. "Faz 1'de devredeceğiz" bir niyettir; **"aktif issuer'ların
%30'unu barındırırsak konsey gündemine girer"** bir taahhüttür.

---

# Karar P1 — Barındırılan Status Hizmeti

> Kaynak: [[SPEC-CRED-0003]] §10.2, [[ARCH-0004]] Açık Konu 2

## Problem

Her issuer kendi status sunucusunu işletmeli ([[ADR-0008]]). 300 mezunu olan
bir meslek yüksekokulu için bu ağır bir yük. Vakıf barındırırsa — **vakıf
ağdaki tüm iptalleri ve zamanlamalarını görür.** Tam da [[ADR-0008]]'in
zincirden kaçırdığı bilgi, vakıfta toplanır.

## Karar

Barındırma hizmeti **sunulur**, dört koşulla:

| # | Koşul |
|---|---|
| P1.a | **İmzalama anahtarı kurumda kalır.** Vakıf yalnızca dosya servis eder; token'ı kurum imzalar. Vakıf sahte durum yayınlayamaz. |
| P1.b | **Erişim logu tutulmaz** (P2 ile aynı rejim). |
| P1.c | **Barındırılan issuer listesi kamuya açıktır.** Kim barındırılıyor gizlenmez. |
| P1.d | **Tripwire: %30.** Aktif issuer'ların %30'undan fazlası vakıf tarafından barındırılıyorsa, bu otomatik olarak konsey gündemine girer ve merkeziyetsizleştirme planı istenir. |

P1.a sayesinde vakıf **yalan söyleyemez**, ama **görebilir** — bu ayrım
önemlidir ve tamamen kapatılamaz. Barındırma doğası gereği görünürlük verir.

## Ölçüm

Barındırılan issuer oranı, üç ayda bir yayınlanan şeffaflık raporunda yer alır
(§Taahhütler).

---

# Karar P2 — CDN Erişim Logu

> Kaynak: [[SPEC-SCHEMA-0001]] Güvenlik Notları, [[ARCH-0004]] §5.4

## Problem

`schemas.tamga.network` her şema çözümlemesini görebilir. Kimin hangi credential
tipini ne zaman kullandığı, IP başına toplanabilir. Bu, sistemin kendisinden
büyük bir takip yüzeyi olur.

Cüzdanın toplu şema çekimi ([[ARCH-0003]] A8) ve verifier'ın ön çekimi
([[SPEC-CRED-0003]] §9.1) bunu büyük ölçüde azaltır ama **sıfırlamaz**.

## Karar

| # | Kural |
|---|---|
| P2.a | **IP adresi hiçbir biçimde loglanmaz** — ham, karma veya kısaltılmış hâlde. |
| P2.b | Yalnızca **toplu sayaç**: yol başına, saat başına istek sayısı. |
| P2.c | Hata ayıklama logu 7 günden uzun tutulmaz ve IP içermez. |
| P2.d | Aynı rejim `status.<issuer>` için de **önerilir**; barındırılan issuer'lar için **zorunludur** (P1.b). |
| P2.e | CDN sağlayıcısının varsayılan loglaması **kapatılır**; kapatılamıyorsa sağlayıcı değiştirilir. |

P2.e pratikte en zor maddedir — çoğu CDN varsayılan olarak erişim logu tutar.
Sağlayıcı seçimi bu şarta bağlıdır ([[ARCH-0004]] iş kalemi).

## Doğrulama

Faz 1'den itibaren **yıllık bağımsız denetim**. Denetçi CDN yapılandırmasını ve
log saklama politikasını inceler; rapor kamuya açıktır.

---

# Karar P3 — İndeksleyici İşletimi

> Kaynak: [[ARCH-0003]] Açık Konu 1, [[ARCH-0004]] Açık Konu 1

## Problem

İndeksleyici zorunlu bir bileşen ([[ARCH-0003]] §2.1). Vakıf ortak bir
indeksleyici hizmeti sunarsa, **tüm doğrulama trafiğini tek noktadan görür** —
hangi işveren hangi üniversitenin mezununu doğruluyor.

Bu, Y2'den daha hassastır: iptal verisi seyrektir, doğrulama trafiği yoğundur.

## Karar

| # | Kural |
|---|---|
| P3.a | **Her verifier kendi indeksleyicisini çalıştırır.** Varsayılan budur. |
| P3.b | Vakıf **barındırılmış indeksleyici hizmeti sunmaz.** Bunun yerine referans dağıtım (docker-compose + kurulum rehberi) yayınlar. |
| P3.c | Devletler kendi indeksleyicilerini işletebilir; bu, o devletin kendi iç meselesidir ve vakfı ilgilendirmez. |
| P3.d | İndeksleyici, veri kaybı riski taşımaz — zincirden sıfırdan oynatılabilir ([[ARCH-0004]] O7). Bu, kendi kendine işletmeyi teknik olarak ucuz kılar. |

P3.b, P1'den **daha katı** bir karardır. Sebebi ölçek farkıdır: status
barındırma seyrek yazma görür, indeksleyici barındırma sürekli okuma görür.

## Gözden geçirme tetikleyicisi

Küçük verifier'lardan (KOBİ ölçeği) gelen talep, referans dağıtımın yetersiz
kaldığını gösterirse karar yeniden değerlendirilir — ama o durumda P1'deki
tripwire mantığı uygulanır.

---

# Karar P4 — Şema Kullanım İstatistikleri

> Kaynak: [[PM-SCHEMA-0001]] Gelecek

## Problem

"Hangi şema ne kadar kullanılıyor" bilgisi, emekliye ayırma kararları için
gereklidir ([[SPEC-SCHEMA-0001]] §9). Ama aynı veri, ince granülaritede
toplanırsa kurum ve kişi davranışını ele verir.

## Karar

| # | Kural |
|---|---|
| P4.a | Yalnızca **şema başına, ay başına toplam sayaç**. |
| P4.b | Issuer bazında, verifier bazında veya credential bazında **hiçbir sayaç tutulmaz**. |
| P4.c | **Asgari kova boyutu: 50.** Aylık sayacı 50'nin altında olan şema için sayı yayınlanmaz, `<50` olarak gösterilir. |
| P4.d | Amaç sınırlaması: veri **yalnızca** şema yaşam döngüsü kararlarında kullanılır. Başka amaçla kullanımı politika ihlalidir. |
| P4.e | Ham sayaçlar 13 aydan uzun saklanmaz. |

P4.c, küçük ve niş şemaların (örneğin tek bir kurumun NATIONAL şeması) tekil
kurumu ele vermesini engeller. 50 eşiği tahmini olarak seçilmiştir ve saha
verisiyle kalibre edilmelidir.

---

# Karar P5 — Alan Adı Emanetçiliği ve Devri

> Kaynak: [[SPEC-SCHEMA-0001]] §10.3

## Problem

Her Tamga credential'ının `vct` claim'i `schemas.tamga.network` altında bir
URL'dir ve **kalıcı bir tanımlayıcıdır**. Alan adının kaybı, geçmişe dönük tüm
tiplerin çözümlenememesi demektir.

Bu, teknik bir risk değil **kurumsal** bir risktir: vakıf tasfiye olursa,
bir uyuşmazlık çıkarsa, ya da alan adı yenilenmezse.

## Karar

| # | Kural |
|---|---|
| P5.a | Alan adı **vakıf tüzel kişiliği** adına kayıtlıdır; hiçbir gerçek kişi adına değil. |
| P5.b | Registrar kilidi (transfer lock) ve **DNSSEC** açıktır. |
| P5.c | Yenileme en az **10 yıllık** olarak yapılır ve takvim uyarısı vakıf yönetiminde iki ayrı kişide tanımlıdır. |
| P5.d | **Halefiyet sözleşmesi**: vakıf tasfiye olursa alan adı konseye geçer. Konsey henüz kurulmamışsa, sözleşmede adı geçen tarafsız bir emanetçiye geçer. |
| P5.e | Faz 1'den itibaren üye devletler **ayna** işletir ([[SPEC-SCHEMA-0001]] §1.4 `/v1/resolve`). Ayna, alan adı erişilemez olsa bile çözümlemeyi sürdürür. |
| P5.f | Tüm şema deposu **açık kaynak ve aynalıdır**; içerik hiçbir koşulda tek bir tarafın elinde değildir. |

P5.e ve P5.f birlikte, alan adı kaybını **felaketten ciddi soruna** indirir.
`vct` URL'leri çözümlenemez hâle gelse bile, `vct#integrity` sayesinde
önbelleklenmiş şemalar geçerliliğini korur ([[SPEC-SCHEMA-0001]] §7.1) ve
içerik aynalardan kurtarılabilir.

---

# Kurumsal Yapı

## Faz 0 — Vakıf

| Organ | Görev |
|---|---|
| Yönetim | Günlük işletim, altyapı, SDK yayını |
| Teknik kurul | Spesifikasyon değişiklikleri, ADR onayı |
| (yok) | Konsey — henüz devlet üye yok |

Faz 0'da vakıf hem operatör hem düzenleyicidir. Bu bir **geçici anormalliktir**
ve böyle adlandırılmalıdır; kalıcı bir tasarım gibi sunulmamalıdır.

## Faz 1 — Konsey

İlk devlet katılımıyla konsey kurulur. Vakıf operatörlüğü sürdürür ama
düzenleyicilik konseye geçer.

| Karar türü | Faz 0 | Faz 1+ |
|---|---|---|
| NETWORK şeması | Vakıf teknik kurulu | Konsey 2/3 ([[SPEC-BC-0001]] §4.3) |
| Protokol yükseltmesi | Vakıf | Konsey 2/3 |
| Üye kabul/çıkarma | — | Konsey 2/3 |
| Ulusal kayıtlar | Vakıf (vekaleten) | Devletin kendisi (`onlyOwnerState`) |
| Bu dokümandaki politikalar | Vakıf | **Konsey** |

## Faz geçişi tetikleyicileri

| Geçiş | Tetikleyici |
|---|---|
| Faz 0 → Faz 1 | İlk devlet validator'ı üretime girer |
| Vakıf validator'larının devri | Devlet validator sayısı ≥ 4 |
| Politika yetkisinin devri | Konsey kurulur |
| Barındırma hizmetlerinin devri | P1.d tripwire veya devlet talebi |

---

# Taahhütler Kütüğü

Katılımcılara verilmiş kamusal sözler. Denetlenebilir olması için tek yerde.

| # | Taahhüt | Kaynak | Doğrulama |
|---|---|---|---|
| C1 | Zincire hiçbir kişisel veri yazılmaz | [[PM-TRUST-0001]] | Kontrat denetimi, kaynak kod |
| C2 | CDN erişim logu tutulmaz (IP hiçbir biçimde) | P2 | Yıllık bağımsız denetim |
| C3 | Barındırılan status'ta imzalama anahtarı kurumda kalır | P1.a | Kurum kendi anahtarını üretir |
| C4 | Vakıf barındırılmış indeksleyici sunmaz | P3.b | Hizmet kataloğu |
| C5 | Şema istatistikleri yalnızca toplu, kova ≥ 50 | P4 | Yayınlanan rapor |
| C6 | Alan adı halefiyeti sözleşmeye bağlı | P5.d | Sözleşme metni kamuya açık |
| C7 | SDK yayını yalnızca CI'dan, kalıcı token yok | [[ARCH-0005]] P2 | Provenance kaydı |
| C8 | Egemenlik kodda: bir devlet başkasının kaydını değiştiremez | [[ADR-0002]] | Kontrat testi |
| C9 | Pilot katılımcılarına Faz 0 sınırları açıkça bildirilir | §Pilot | Katılım metni |

## Şeffaflık raporu

Üç ayda bir yayınlanır. Asgari içerik: barındırılan issuer oranı (P1.d),
aktif issuer/şema/liste sayıları, şema kullanım sayaçları (P4), olay özetleri
(SEV1/SEV2 sayısı), ve taahhüt kütüğündeki her maddenin durumu.

---

# Pilot Katılımcılarına Bildirim Yükümlülüğü

Faz 0'ın bilinen sınırları, pilot üniversitesine ve verifier'lara **yazılı
olarak** bildirilir. Asgari liste:

1. **Kimlik eşleştirme prosedüreldir** — PID olmadığı için `cnf` kişi
   kimliğini kanıtlamaz ([[SPEC-CRED-0001]] §3, [[SPEC-SCHEMA-0002]] §1.2.3).
2. **`idx` korelasyonu** — iki verifier iş birliği yaparsa aynı diplomayı
   eşleştirebilir ([[SPEC-CRED-0003]] §9.4); çözümü batch issuance, Faz 2.
3. **Bayat öğrenci belgesi** — 90 güne kadar ([[SPEC-SCHEMA-0002]] §2.1.1).
4. **Vakıf operatör ve düzenleyicidir** — geçici anormallik.
5. **Kontratlar bağımsız denetimden geçmemiştir** (pilot başlangıcında).

Bu liste, "sorun çıkınca söylemedin" itirazını baştan kapatır. Sistemin
sınırlarını gizlemek, pilotun kendisinden daha büyük bir itibar riskidir.

---

# Değişmezler

| # | Değişmez |
|---|---|
| **G1** | Barındırılan hizmetlerde imzalama anahtarı **asla** vakıfta olmaz. |
| **G2** | Hiçbir Tamga altyapısı IP adresi loglamaz. |
| **G3** | Vakıf barındırılmış indeksleyici hizmeti sunmaz. |
| **G4** | Şema istatistikleri kova boyutu < 50 ise yayınlanmaz. |
| **G5** | Alan adı gerçek kişi adına kayıtlı olamaz. |
| **G6** | Her yumuşak yetkinin ölçülebilir bir tripwire eşiği vardır. |
| **G7** | Faz 0 sınırları katılımcılara yazılı bildirilir. |
| **G8** | Şeffaflık raporu üç ayda bir, gecikmesiz yayınlanır. |

---

# Açık Konular

1. Vakfın hukuki formu ve yargı yeri seçilmedi. Alan adı halefiyeti (P5.d) ve
   konsey sözleşmesi buna bağlı.
2. Konseyin oy ağırlığı: her devlet bir oy mu, nüfus/kullanım ağırlıklı mı?
   [[ADR-0002]] 2/3 diyor ama tabanı tanımlamıyor.
3. P4.c'deki 50 eşiği tahminîdir; saha verisiyle kalibre edilmeli.
4. Bağımsız denetçi kim olacak ve kim öder? Vakıf öderse bağımsızlık sorusu
   doğar; konsey ödemesi Faz 1'i bekler.
5. Bir üye devlet bu politikaları ihlal ederse ne olur? [[ADR-0002]] çıkarma
   mekanizması var ama politika ihlali ile protokol ihlali aynı şey mi?
6. Şeffaflık raporunun ilk yayını hangi tarihte başlar — pilot öncesi mi
   sonrası mı?

---

# İlgili Dokümanlar

[[ADR-0002]] · [[ADR-0007]] · [[ADR-0008]] · [[PM-PH-0001]] · [[PM-TRUST-0001]] ·
[[PM-SCHEMA-0001]] · [[ARCH-0001]] · [[ARCH-0003]] · [[ARCH-0004]] ·
[[ARCH-0005]] · [[SPEC-SCHEMA-0001]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0002]]

---

# Durum

**Draft** — 2026-09-09. Beş birikmiş politika kararı (P1–P5) kapatıldı.
Vakfın hukuki formu ve konsey sözleşmesi açık; P5.d ve konsey yetki devri
bunlara bağlıdır. Tripwire eşikleri (P1.d %30, P4.c 50) tahminîdir ve saha
verisiyle kalibre edilmelidir.
