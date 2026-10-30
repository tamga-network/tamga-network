---
document_id: ADR-0070
title: "Geçici işletmeci zinciri: vakıf kurulana kadar ağın kendi hizmetleri Tamga Network adına geçici işletmecide"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  Tamga Network'ün tüzel kişiliği yoktur; kurulacak kâr amacı gütmeyen vakıf tüzel kişilik kazanana kadar ağın kendi hizmetlerini
  (liste yayını, kimlik servisi, Tamga Verify, siteler) Tamga Network adına geçici işletmeci BROS İNŞAAT SANAYİ VE DIŞ TİCARET
  LİMİTED ŞİRKETİ işletir; tüzel kişilik gerektiren her kayıt, sertifika ve sözleşme onun adıyla ve "Tamga Network adına"
  ibaresiyle yapılır. Liste işletmecisi ve şema sahibi adı "Tamga Network" kalır. Geçici işletmecinin adı, kimlik numarası ve
  adresi tek bir yapılandırma değerinden gelir; liste yayıncısı her yayında denetler. Devir mevcut devir aracı ve runbook'la
  yapılır; vakıf kurulana kadar katılım sözleşmelerini geçici işletmeci imzalar. Kabul: 2026-10-30.
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0033]]", "[[ADR-0037]]", "[[ADR-0042]]", "[[ADR-0058]]", "[[ADR-0066]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]"]
---

# Kısaca

Tamga Network bir vakıf olacak, ama vakıf henüz kurulmadı. O güne kadar ağın kendi hizmetlerini bir şirket, ağ adına ve geçici
olarak işletir: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. Güven listelerinde işletmeci adı yine "Tamga Network" yazar;
şirketin adı yalnız bir tüzel kişinin gerektiği yerlerde (vergi numarası, sertifika, sözleşme, kişisel veri kaydı) görünür. Bu
bilgi tek bir yerde tutulur ve vakıf kurulunca tek seferde değiştirilir.

# Bağlam

- [[ADR-0009]] K5 ve D-GOV-5: listeler `operator {name, status: provisional, on_behalf_of}` taşır; devir yalnız işletmeci alanını
  değiştirir. [[ADR-0037]]: ağ yalnız ağdır, hizmet satmaz; [[ADR-0042]]: ağ cüzdan işletmez.
- Ağın tüzel kişiliği yoktur. Kayıt verisi ([[ADR-0024]]), kurum sertifikasının `organizationIdentifier`'ı ve erişim sertifikası
  ([[ADR-0058]]), KVKK veri sorumlusu kaydı, alan adı ve katılım sözleşmeleri bir tüzel kişi ister. Bugün bu yerler tek tek
  doldurulmuştu (kimlik servisi ve Tamga Verify kayıtları, çerçeve belgeleri, aydınlatma metinleri); yazılı bir karar ve tek bir
  kaynak yoktu. Mağaza inceleme imzacısının bekleyen kaydı ([[ADR-0033]]) bu yüzden eksik kalmıştı.
- Proje yönetiminin yönü: ağ, işletmeci şirketten tamamen ayrı, kâr amacı gütmeyen bir vakıf olacak; vakıf kurulana kadar
  işletmeci zinciri yazılı olarak sabitlensin ve her yerde aynı olsun.

# Karar

## K1 — Zincir
Tamga Network (kurulacak vakıf) ← geçici işletmeci **BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ** (VKN 1870632151;
Harbiye Mah. Bostan Sk. No: 15 İç Kapı No: 5, Şişli / İstanbul). Geçici işletmeci ağın kendi hizmetlerini (liste yayını, kayıt
kurumu rolünün devlet adına yürütülmesi, kimlik servisi, Tamga Verify, siteler ve alan adları) Tamga Network adına işletir. Tüzel
kişilik gerektiren her işlem (kayıt kimlik numarası, sertifika konu alanı, KVKK kaydı, alan adı, sözleşme) onun adıyla ve
"Tamga Network adına" ibaresiyle yapılır.

## K2 — Adlar
Liste işletmecisi (LOTL ve ulusal listelerin `operator.name`'i, ETSI XML ve LoTE görünümlerinin `SchemeOperatorName`'i) ve şema
sahibi adı **"Tamga Network"** kalır (`status: provisional`, `on_behalf_of`). Geçici işletmecinin adı yalnız ağın kendi hizmet
kayıtlarında (`operator` bloğu, `identifiers`, `postal_address`), bu kayıtların sertifikalarında ve tüzel kişi gerektiren
belgelerde görünür. Geçici işletmecinin başka ürünleri (ör. ağın listelediği bir cüzdan) ağda ayrı bir katılımcıdır ve ayrıcalık
edinmez ([[ADR-0037]], [[ADR-0042]]).

## K3 — Tek değer
Geçici işletmecinin adı, adına çalıştığı yapı, kimlik numarası ve adresi tek bir yapılandırma değerindedir
(`apps/trust-publisher/registry/provisional-operator.json`). Liste yayıncısı her yayından önce denetler: kimlik numarası notunda
"provisional operator" geçen her kendi kaydı bu değeri birebir taşır ve liste işletmecisi adı "Tamga Network"tür; fark varsa yayın
durur. JSON listeler, XML ve LoTE görünümleri ([[ADR-0066]]) bu kayıtlardan üretilir; sertifika konu alanları ve sözleşme
şablonları aynı değeri kullanır.

## K4 — Devir
Vakıf tüzel kişilik kazanınca devir, işletmecinin mevcut devir aracı (kuru prova) ve runbook'uyla yapılır: değer, ona bağlı
kayıtlar ve sertifikalar vakfın adı ve numarasıyla yenilenir ([[ADR-0058]] K5). Liste işletmecisi adı, `ca_id`, `vct` ve
kurumların kalıcı kimlikleri değişmez.

## K5 — Sözleşmeler
Vakıf kurulana kadar katılım sözleşmesi, barındırma eki ve veri işleme sözleşmesi geçici işletmeci tarafından Tamga Network adına
imzalanır; sözleşmeler halefiyet maddesi taşır: vakıf kurulunca haklar ve yükümlülükler vakfa geçer ([[FW-TF-0001]] §5.7).

## K6 — Bekleyen kayıtlar
Mağaza inceleme imzacısının kaydı ([[ADR-0033]]) ve sonraki bütün kendi kayıtları aynı değeri taşır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Listelerde işletmeci adı olarak şirketin adı | ret | Liste ve şema sahipliği ağındır; devirde liste kimliği değişirdi; ağın tarafsızlığı |
| Vakıf kurulana kadar tüzel kişi gerektiren her işi beklemek | ret | Kimlik servisi, doğrulayıcı kaydı ve mağaza incelemesi bugün tüzel kişi istiyor |
| Değerleri her kayıtta ayrı tutmak (bugünkü durum) | ret | Dağınık; devirde biri unutulabilir; denetlenemez |
| **Liste adı "Tamga Network", tüzel kişi geçici işletmeci, tek değer + yayın denetimi** | **seçildi** | Devir tek noktadan; liste kimliği sabit; tutarlılık her yayında sınanır |

# Değişmezler

| Kod | Kural |
|---|---|
| OP1 | Liste işletmecisi ve şema sahibi adı "Tamga Network"tür (`status: provisional` vakıf kurulana kadar); geçici işletmecinin adı yalnız ağın kendi hizmet kayıtlarında, onların sertifikalarında ve tüzel kişi gerektiren belgelerde yer alır. |
| OP2 | Geçici işletmecinin adı, kimlik numarası ve adresi tek yapılandırma değerinden gelir; liste yayıncısı bu değerden farklı bilgi taşıyan kendi kaydıyla ya da "Tamga Network" dışında bir liste işletmecisi adıyla yayın yapmaz. |
| OP3 | Vakfa devir yalnız bu değeri ve ona bağlı kayıtları ve sertifikaları değiştirir; liste işletmecisi adı, `ca_id`, `vct` ve kurumların kalıcı kimlikleri değişmez. |

# Sonuçlar

- Kod: liste yayıncısı `provisional-operator.ts` denetimi ve `registry/provisional-operator.json`; mağaza inceleme imzacısının
  bekleyen kaydı aynı değerle tamamlandı (kayıt ve yayın işletmecinin bilgisayarında).
- Belgeler: [[FW-TF-0001]], [[FW-RB-0001]] RB-OP-01 ve tanımlar aynı zinciri zaten yazıyor; değişiklik gerekmedi.

# Durum

**Accepted — 2026-10-30.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında). DECISIONS: D-GOV-10. OP1–OP3 bağlayıcıdır.
