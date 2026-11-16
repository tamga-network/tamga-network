---
document_id: FW-RISK-0001
title: "Risk kaydı"
status: Active
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  Tamga Network'ün risk kaydı: AB'nin cüzdanlar için ortak risk kaydının (Uygulama Tüzüğü (AB) 2024/2981 Ek I; AB ARF Ek 6)
  14 üst düzey riski, 3 sistem riski, 5 teknik tehdit ailesi ve 133 tehdit senaryosu için Tamga'da kimin sorumlu olduğunu,
  hangi önlemin bulunduğunu ve durumunu gösterir. Bir öz değerlendirmedir; bağımsız denetim ya da sertifika değildir.
---

Bu belge, AB'nin cüzdan risk kaydındaki her risk ve tehdit için Tamga'nın önlemini ve durumunu gösterir; düzenleyiciler,
devletler, denetçiler ve katılımcılar içindir.

> **Öz değerlendirme.** Bu kayıt Tamga'nın kendi değerlendirmesidir; bağımsız denetim, uygunluk değerlendirmesi ya da
> sertifika değildir. "Karşılandı" yalnız bağlayıcı bir kuralı ve referans uygulamada karşılığı olan önlemler için yazıldı.

**Ne zaman okunur.** Önce ana belgenin güvenlik bölümü ([[FW-ARF-0001]] §7) ve Trust Framework'ün risk yaklaşımı
([[FW-TF-0001]] §1.5). Önlemlerin kuralları Tamga Rulebook'ta ([[FW-RB-0001]]) ve atıf verilen şartname ve kararlardadır.

# 1. Kaynak ve yöntem

AB, cüzdanların her mimaride ele alması gereken riskleri ortak bir risk kaydında toplar: Uygulama Tüzüğü (AB) 2024/2981
Ek I (AB ARF'de Ek 6). Kayıt dört bölümdür: üst düzey riskler (R1–R14), sistem riskleri (SR1–SR3), teknik tehditler
(TT1–TT5 ve alt başlıkları) ve doğrudan tehdit senaryoları (TR1–TR133). Bu belge aynı iskeleti izler; kod ve adlar tüzükteki
gibidir, Türkçe metin çeviridir.

Tamga Network cüzdan işletmez ([[ADR-0042]]); cüzdan tarafındaki satırlarda önlem, listedeki [[t:wallet-provider|cüzdan
sağlayıcılarına]] Tamga Rulebook'un yüklediği kurallar (RB-WP) ve açık kaynak Tamga cüzdan çekirdeğidir.

| Sütun | Anlamı |
|---|---|
| Kim | Önlemden sorumlu rol: işletmeci (ağın geçici işletmecisi), kimlik servisi (Tamga'nın geçici kimlik belgesi hizmeti; PID değildir), belge veren, doğrulayıcı, cüzdan sağlayıcısı |
| Tamga'daki önlem | Kısa açıklama ve kuralın kaynağı (`DOC-ID/KOD` ya da Tamga Rulebook kural kodu) |
| Durum | **Karşılandı**: bağlayıcı kural ve referans uygulamada karşılığı var · **Kısmen**: önlem var ama eksik, telefonda doğrulanmadı ya da sertifikası yok · **Açık**: önlem yok · **Uygulanmaz**: tehdidin dayandığı işlev Tamga'da yok |

PID'e ilişkin tehditler, Tamga'nın geçici kimlik belgesine uygulanarak okundu (Tamga PID vermez — [[SPEC-TRUST-0001]]/TL8).

# 2. Sayım

| Bölüm | Karşılandı | Kısmen | Açık | Uygulanmaz |
|---|---:|---:|---:|---:|
| Üst düzey riskler (14) | 0 | 14 | 0 | 0 |
| Sistem riskleri (3) | 0 | 3 | 0 | 0 |
| Teknik tehdit alt başlıkları (18) | 2 | 16 | 0 | 0 |
| Tehdit senaryoları (133) | 32 | 89 | 3 | 9 |

Hiçbir üst düzey risk tümüyle karşılanmış sayılmadı: her birinde en az bir senaryo kısmen ya da açıktır. Açık senaryolar:
TR49, TR63, TR132 (cüzdan günlüğünün bütünlüğü ve cihaz arızasında günlüğün kaybı). Uygulanmaz: TR7, TR11, TR45, TR48, TR54, TR64, TR97, TR100, TR101 (Tamga'da bulunmayan yollar:
nitelikli sertifika ve eID ile kimlik doğrulama, elektronik imza, nitelikli güven hizmeti, cüzdan yedeği, kullanıcı hesabı).

# 3. Üst düzey riskler

| Kod | Risk | Tamga'daki başlıca önlemler | Durum |
|---|---|---|---|
| R1 | Var olan bir elektronik kimliğin oluşturulması ya da kullanılması | Kimlik belgesi yalnız lisanslı uzaktan kimlik doğrulamadan ve akışı başlatan cüzdanda kişinin son onayından sonra verilir; kopyalar cüzdanın kanıtladığı anahtarlara bağlanır. Bağımsız denetim yok. | Kısmen |
| R2 | Sahte bir elektronik kimliğin oluşturulması ya da kullanılması | Tamga PID vermez; kimlik servisi belge türü yetkisiyle ve güven listesinde kayıtlıdır; yetkisiz tür doğrulamada reddedilir. Liste imzası bugün tek işletmecidedir. | Kısmen |
| R3 | Sahte özniteliklerin oluşturulması ya da kullanılması | Her belge imzalı, imzacı güven listesinde, tür yetkisi atlanamaz; holder binding zorunludur. Kurum içi sahtecilik kurumun kendi denetimindedir. | Kısmen |
| R4 | Kimlik hırsızlığı | Anahtarlar cihazın güvenli bölgesinde, her gösterim kullanıcı doğrulamasıyla; telefonsuz birim iptali. Sertifikalı güvenli donanım (W3) yok. | Kısmen |
| R5 | Veri hırsızlığı | Ortak kayıtlarda kişisel veri yok; yanıtlar şifreli; günlük cihazda ve yalnız kişinin şifreli dışa aktarmasıyla çıkar; cüzdan yedeği yok. | Kısmen |
| R6 | Veri ifşası | Seçici açıklama, alan alan onay, kapsam denetimi, kayıt sertifikası zorunlu; aynı belge verenin belgeleri birleştirilirse eşleştirme riski kalır (FW-ARF-0001 §7.4 L3). | Kısmen |
| R7 | Verinin değiştirilmesi | Belgeler imzalı; kabul kararı doğrulayıcının kendi doğrulama hattında. Cüzdan günlüğünün bütünlük koruması yok. | Kısmen |
| R8 | Veri kaybı | Cüzdan yedeği bilinçli olarak yok; cihaz değişiminde belgeler yeniden alınır, günlük yalnız taşıma dosyasıyla taşınır. | Kısmen |
| R9 | Yetkisiz işlem | İmzalı istek, kayıt sertifikası, tek kullanımlık nonce, her gösterimde kullanıcı doğrulaması; oltalama tümüyle önlenemez. | Kısmen |
| R10 | İşlemin değiştirilmesi | İstek, yanıt ve belge imzalı ve şifreli; açık kalan: çok belgeli sunumda belgelerin aynı kişiye ait olduğunun kanıtı (TR86). | Kısmen |
| R11 | İnkâr | KB-JWT ve cihaz imzası sunumun kanıtıdır; doğrulayıcının denetim kaydı ret durumunda da tutulur. Cihaz arızasında günlük kaybolur. | Kısmen |
| R12 | İşlem verisinin ifşası | Sunum günlüğü cihazda kalır; doğrulayıcı sonucu ve günlükleri alan değeri ve iptal listesi konumu taşımaz; IP adresi günlüğe yazılmaz. | Kısmen |
| R13 | Hizmet kesintisi | Bayat ya da erişilemez güven kaynağı "doğrulanamadı" verir, asla kabul; iptal listeleri statik ve toplu çekilir; yük ve kesinti testleri yapılmadı. | Kısmen |
| R14 | Gözetim | Küresel tanımlayıcı yok; doğrulayıcı başına kopya, site başına takma ad, sıfır bilgi ispatı; iptal listeleri sabit aralıkla ve toplu. | Kısmen |

# 4. Sistem riskleri

Tüzüğe göre bu riskler birden çok tehdidin sistem düzeyindeki sonucudur; tehdit senaryolarına bağlanmazlar.

| Kod | Risk | Tamga'daki başlıca önlemler | Durum |
|---|---|---|---|
| SR1 | Toplu gözetim | Hiçbir merkezî hizmet işlemleri görmez: listeler ve iptal listeleri toplu çekilir, sunum günlüğü cihazda, ortak kayıtlarda kişisel veri yok. Birden çok doğrulayıcının birleşmesine karşı sıfır bilgi ispatı yalnız kimlik belgesinde. | Kısmen |
| SR2 | İtibar kaybı | Olay bildirim süreleri, herkese açık değişiklik günlüğü ve üç ayda bir şeffaflık raporu; bağımsız denetim ve sertifika yok. | Kısmen |
| SR3 | Hukuka aykırılık | Ağ AB hukukuna bağlı değil, AB modelini izler; kişisel veri kuralları değişmezlerle korunur; çerçevenin hukuki incelemesi pilot öncesinde yapılacak. | Kısmen |

# 5. Teknik tehditler

Teknik tehditler tek bir riske bağlı değildir; birçok saldırının aracıdır.

| Kod | Tehdit | Tamga'daki önlem | Durum |
|---|---|---|---|
| TT1 1.1 | Hırsızlık | Her gösterimde kullanıcı doğrulaması; telefonsuz birim iptali (RB-WP-15). | Kısmen |
| TT1 1.2 | Bilgi sızıntısı | Veri cihazda; platformun şifreli depolaması; değer günlüğe yazılmaz (RB-GEN-06). | Kısmen |
| TT1 1.3 | Kurcalama | Cihaz kanıtı ve sürüm bazında cüzdan kanıtı iptali (RB-WP-11, RB-WP-17). | Kısmen |
| TT2 2.1 | BT sistemi yönetiminde hatalar | Yayın öncesi zorunlu testler (RB-ENF-01), sapma kaydı (RB-ENF-04); işletim politikaları. | Kısmen |
| TT2 2.2 | Uygulama ya da kullanım hataları | "Geçersiz" ile "doğrulanamadı" ayrı gösterilir (RB-WP-12); üç değerli sonuç (RB-RP-05). | Kısmen |
| TT2 2.3 | Geliştirme hataları ve yanlış yapılandırma | Açık uyum vektörleri, güvenli varsayılanlar ([[ADR-0056]]), açık kaynak; bağımsız kod denetimi yok. | Kısmen |
| TT3 3.1 | Cüzdan bileşenlerinin yanlış kullanımı ya da yapılandırılması | Paketlerde yayın kaynağı kanıtı (RB-GEN-07); bilinmeyen liste biçiminde durma (RB-GEN-04). | Kısmen |
| TT4 4.1 | Donanım, cihaz ya da sistem arızası | Bayat kaynakta "doğrulanamadı" (RB-GEN-03); cihaz arızasında belgeler yeniden alınır (RB-H-04). | Kısmen |
| TT4 4.2 | Kaynak kaybı | Statik liste ve iptal listesi yayını; tek işletmeci (FW-ARF-0001 §7.4 L1). | Kısmen |
| TT4 4.3 | Destek hizmetlerinin kaybı | Doğrulayıcı listeleri önceden toplu çeker (RB-RP-06); yakın alanda internetsiz gösterim. | Kısmen |
| TT5 5.1 | Bilginin ele geçirilmesi | TLS, şifreli yanıt ([[SPEC-PROTO-0002]]/PV3), yakın alanda oturum şifrelemesi. | Karşılandı |
| TT5 5.2 | Oltalama ve sahtecilik | Kayıt sertifikası zorunlu (RB-WP-19), kayıtlı adın gösterimi (RB-WP-13), bağlantı iletimine karşı son onay ([[ADR-0080]]/VL1). | Kısmen |
| TT5 5.3 | İletilerin tekrar oynatılması | Tek kullanımlık nonce ([[SPEC-PROTO-0002]]/PV10), KB-JWT `iat` penceresi ([[SPEC-CRED-0002]]/C17), tek kullanımlık `c_nonce` ([[SPEC-PROTO-0001]]/PR4). | Karşılandı |
| TT5 5.4 | Kaba kuvvet saldırısı | İşlem kodunda üç deneme sınırı ([[SPEC-PROTO-0001]]/PR12), salt ≥ 128 bit ([[SPEC-CRED-0002]]/C3); hizmetlerde istek sınırı. | Kısmen |
| TT5 5.5 | Yazılım açıkları | Açık kaynak, sorumlu bildirim yolu, sürüm bazında iptal (RB-WP-11); bağımsız denetim yok. | Kısmen |
| TT5 5.6 | Tedarik zinciri saldırıları | Paketlerde yayın kaynağı kanıtı (RB-GEN-07); bağımlılık denetimi. | Kısmen |
| TT5 5.7 | Kötü amaçlı yazılım | Anahtarlar güvenli bölgede ([[SPEC-WALLET-0001]]/WL1); cihaz kanıtı. | Kısmen |
| TT5 5.8 | Rastgele sayı tahmini | Platformun kriptografik üreteci; iptal konumu rastgele ([[SPEC-CRED-0003]]/S7). | Kısmen |

# 6. Tehdit senaryoları

"İlgili risk" sütunu tüzükteki eşlemedir; TR106–TR133 tüzükte "çeşitli risklere etki" olarak işaretlidir.

| Kod | Tehdit senaryosu | İlgili risk | Kim | Tamga'daki önlem | Durum |
|---|---|---|---|---|---|
| TR1 | Takma adları haklı neden olmadan iptal etmek. | R2 | Kimlik servisi, Cüzdan sağlayıcısı | Site takma adı cihazda tohumdan türetilir, merkezî bir takma ad iptal listesi yoktur; tohum kimlik servisinde saklanmaz ([[ADR-0031]]/PS2). | Karşılandı |
| TR2 | Var olmayan, uydurma elektronik kimlikler vermek. | R2 | Kimlik servisi | Kimlik belgesi türün seviyesi sağlanmadan verilmez ([[SPEC-ID-0003]]/IDP2, RB-AP-11); bağımsız denetim yok. | Kısmen |
| TR3 | Yetkisiz PID vermeye başlamak. | R2 | İşletmeci | Tamga PID vermez ([[SPEC-TRUST-0001]]/TL8); tür yetkisi izin listesiyle, varsayılan kapalı (RB-REG-04) ve doğrulamada atlanamaz ([[SPEC-API-0001]]/AP8). | Karşılandı |
| TR4 | Bir yöneticiye yanlış bir sağlayıcıyı güven listesine ekletmek. | R2 | İşletmeci | Listeye giriş katılım incelemesiyle ([[FW-ONB-0001]]); her değişiklik herkese açık değişiklik günlüğünde (RB-OP-07). Liste imzası tek işletmecide, anahtar töreni ve donanım güvenlik modülü bekliyor (FW-ARF-0001 §7.4 L1). | Kısmen |
| TR5 | Uzaktan kimlik doğrulama hizmetini atlatmak. | R1 / R2 | Kimlik servisi | Lisanslı sağlayıcıyla belge, canlılık ve yüz denetimi; sağlayıcı kararı imzalı bildirim ve karar sorgusuyla teyit edilir ([[SPEC-ID-0003]]/IDP5); bağlantı iletimine karşı son onay ([[ADR-0080]]/VL1–VL3). | Kısmen |
| TR6 | Yüz yüze kimlik doğrulama hizmetini atlatmak. | R1 / R2 | Kimlik servisi | Yüz yüze yol kimlik kural kitabında T2 seviyesi olarak tanımlıdır ([[FW-RB-0003]]); yüz yüze doğrulamanın usulü ayrıca yazılmadı. | Kısmen |
| TR7 | Uzaktan (nitelikli) sertifika kullanımına dayanan kimlik doğrulamayı atlatmak. | R1 / R2 | Kimlik servisi | Bu yol sunulmuyor; nitelikli imzaya dayanan T3 seviyesi bugün verilmiyor ([[SPEC-ID-0003]]/IDP7). | Uygulanmaz |
| TR8 | Bir kişiye bağlı olmayan cüzdana erişmek. | R1 / R2 | Cüzdan sağlayıcısı | Her gösterim kullanıcı doğrulaması ister ([[SPEC-WALLET-0001]]/WL11, RB-WP-03); belgeler kişinin kimlik doğrulamasından sonra verilir. Cüzdanın kişiye bağlanması cihazın kullanıcı doğrulamasına dayanır. | Kısmen |
| TR9 | Teknik ve usule ilişkin denetimleri aşıp yanlış PID üretmek. | R1 / R2 | Kimlik servisi | Eşleme tablosunda karşılığı olmayan değerde belge verme durur (RB-AP-13); belge verenin denetim kaydı; bağımsız denetim yok. | Kısmen |
| TR10 | Geçersiz bir WSCD üzerinde yeni cüzdan etkinleştirmek. | R1 / R2 | Cüzdan sağlayıcısı | Yazılım anahtarlı cüzdan desteklenmez ([[SPEC-WALLET-0001]]/WL3); anahtar kanıtı depo seviyesini doğru söyler ([[ADR-0025]]/WIA3); W3 beyanı cihaz kanıtı ister (RB-WP-17). Sertifikalı WSCD yok. | Kısmen |
| TR11 | Mevcut eID araçlarına dayanan kimlik doğrulamayı atlatmak. | R1 / R2 | Kimlik servisi | eID aracıyla kimlik doğrulama yolu yok; kimlik belgesi çipinin okunması kapalı ([[ADR-0083]]/CV7). | Uygulanmaz |
| TR12 | Cüzdanın kişinin denetiminde olduğu denetimini atlatıp ele geçirilmiş cüzdana belge aldırmak. | R1 / R4 / R9 | Kimlik servisi, Cüzdan sağlayıcısı | Belge vermeden önce WIA ve anahtar kanıtı denetlenir (RB-AP-10, [[SPEC-PROTO-0001]]/PR11, PR19); kişi akışı başlatan cüzdanda maskeli özeti onaylar ([[ADR-0080]]/VL1). W2'de cihaz kanıtı isteğe bağlı. | Kısmen |
| TR13 | Geçerli bir PID'i geçersiz bir cüzdan birimine almak. | R1 / R4 / R9 | Kimlik servisi, Cüzdan sağlayıcısı | WIA ömrü 24 saatten kısa, her işlemde yeni ([[ADR-0025]]/WIA1); iptal edilmiş WIA ya da anahtar kanıtıyla belge verilmez ([[ADR-0025]]/WIA4, [[SPEC-PROTO-0001]]/PR19). | Karşılandı |
| TR14 | PID sağlayıcısının var olan bir kişiyle ilişkili uydurma kimlikler vermesi. | R1 / R4 / R9 | Kimlik servisi | Kimlik bilgileri sağlayıcının teyit edilmiş kararından gelir ([[SPEC-ID-0003]]/IDP5); kişiye "belgeniz bir cüzdana eklendi" bildirimi (RB-AP-15). Kurum içi kötüye kullanıma karşı bağımsız denetim yok; ağ tek işletmeciye dayanır (RB-GEN-10). | Kısmen |
| TR15 | PID sağlayıcısının PID'i doğru cüzdana bağlayamaması yüzünden PID'i yanlış cüzdana bağlamak. | R1 / R4 / R9 | Kimlik servisi | Her kopya cüzdanın sahipliğini kanıtladığı ayrı anahtara bağlanır ([[SPEC-PROTO-0001]]/PR6); son onay yalnız akışı başlatan cüzdana, onun anahtarına bağlı ([[ADR-0080]]/VL2). | Karşılandı |
| TR16 | Kişiye saldırganın denetimindeki yeni bir birimin etkinleştirilmesini onaylatmak. | R1 / R2 / R4 / R9 | Cüzdan sağlayıcısı | Doğrulama başlamadan uyarı: bu doğrulama hangi cüzdan için ([[ADR-0080]]/VL3); "belgeniz bir cüzdana eklendi" bildirimi ve itiraz (RB-AP-15, RB-H-05); telefonsuz birim iptali ([[ADR-0047]]/WR3). | Kısmen |
| TR17 | Hedef vatandaşların verisine erişmek için başka bir devletin PID'ini vermek. | R1 / R4 / R9 | İşletmeci | Kurum yalnız kendi devletinin kök sertifikasına bağlanır ([[SPEC-ID-0002]]/XC1, RB-REG-03); ulusal listeyi o devletin anahtarı imzalar ([[SPEC-TRUST-0001]]/TL7) — bugün bütün listeleri geçici işletmeci imzalar; tanıma denetimi doğrulayıcıda (RB-RP-03). | Kısmen |
| TR18 | Teknik ve usule ilişkin denetimleri aşıp sahte (Q)EAA üretmek. | R3 | Belge veren | İmza anahtarı kurumda ([[ADR-0057]]/RS1, RB-AP-02); veriler imza anında yetkili kaynaktan okunur ([[ADR-0020]]/AS1); karşılığı olmayan kayıtta belge verilmez (RB-AS-02). Kurumun iç denetimi kurumdadır. | Kısmen |
| TR19 | Kendisine geçerli olarak verilmemiş (Q)EAA'ları sunmak. | R3 | Doğrulayıcı | KB-JWT istisnasız zorunlu ([[SPEC-CRED-0002]]/C8), `cnf` olmayan belge reddedilir (C16); mdoc'ta cihaz imzası oturuma bağlı ([[SPEC-PROTO-0002]]/PV11); anahtar güvenli bölgeden çıkmaz ([[SPEC-WALLET-0001]]/WL1). | Karşılandı |
| TR20 | Cüzdanın PID ile kendisine verilmemesi gereken bir (Q)EAA arasındaki kriptografik bağlama mekanizmasına saldırmak. | R3 | Belge veren, Doğrulayıcı | Kurum belgesi kimliğe bağlı teklifle ([[ADR-0020]]/AS2) ya da kimlik belgesi sunumuyla ([[SPEC-PROTO-0001]]/PR14) verilir; ama verilen belge kimlik belgesinin anahtarına kriptografik olarak bağlanmaz (her kopya kendi anahtarında, PR6). Bir sunumdaki belgelerin aynı cüzdandan geldiği doğrulayıcının aynı yanıt denetimine dayanır (bkz. TR86). | Kısmen |
| TR21 | Fiziksel karşılığı süresi dolmuş ya da geçersiz olan (Q)EAA'yı cüzdanda kullanmak. | R3 | Belge veren | Belgede `exp`, kurumun iptal listesi ([[SPEC-CRED-0003]]); yenilemede veriler yetkili kaynaktan yeniden okunur ([[ADR-0023]]/AR3); iptal koşulları politikada ([[FW-POL-0001]]). Kaynakta değişikliğin iptale dönüşmesi kurumun işleyişine bağlı. | Kısmen |
| TR22 | (Q)EAA sağlayıcısının cüzdanın kişinin denetiminde olduğu denetimini atlatıp ele geçirilmiş cüzdana (Q)EAA aldırmak. | R3 | Belge veren, Cüzdan sağlayıcısı | Belge veren WIA ve anahtar kanıtını belge vermeden önce denetler (RB-AP-10, [[SPEC-PROTO-0001]]/PR19); W2'de cihaz kanıtı isteğe bağlı. | Kısmen |
| TR23 | Elektronik öznitelik belgelerinde sahtecilik yapmak. | R3 | Doğrulayıcı | Yalnız ES256 imza ([[SPEC-CRED-0002]]/C1), zincir güven listesindeki köke bağlanır, kurum `iat` anında kabul edilebilir olmalı ve tür yetkisi atlanamaz ([[SPEC-API-0001]]/AP8). | Karşılandı |
| TR24 | Sahte öznitelik belgelerini cüzdana enjekte etmek. | R3 | Cüzdan sağlayıcısı | Tamga cüzdan çekirdeği belgeyi alırken imzayı, kurumun listede olduğunu ve tür özetini denetler (RB-GEN-02); sahte belge doğrulayıcıda yine reddedilir. Başka cüzdanların alma denetimi sağlayıcının işidir. | Kısmen |
| TR25 | Cüzdanın öznitelikleri kişinin onayı olmadan doğrulayıcıya sunabilmesi. | R6 | Cüzdan sağlayıcısı | Her gösterim kullanıcı doğrulaması ve alan alan onay ister ([[SPEC-WALLET-0001]]/WL11, RB-WP-03, RB-H-02); cihaz üzerindeki doğrulama sürüyor. | Kısmen |
| TR26 | PID, (Q)EAA ya da takma adların yanlış doğrulayıcıya sunulması. | R6 | Doğrulayıcı, Cüzdan sağlayıcısı | İstemci kimliği erişim sertifikasından ([[ADR-0034]]/CI1, CI2); kayıt sertifikasız istek reddedilir ([[ADR-0056]]/MR5); KB-JWT `aud` istemci kimliğinin tamamı ([[SPEC-PROTO-0002]]/PV7); takma ad site başına ([[ADR-0031]]/PS1). | Karşılandı |
| TR27 | EAA'nın kötü niyetli yenilenmesini başlatmak. | R6 | Belge veren | Yenileme belirteci ilk ihraçtaki istemci örneği anahtarına bağlı ([[ADR-0060]]/RT1), DPoP zorunlu (RT2), tek kullanımlık ([[SPEC-PROTO-0001]]/PR18); sessiz yenileme yalnız tanımlı koşullarda ([[SPEC-WALLET-0001]]/WL7). | Karşılandı |
| TR28 | Kişiye bir öznitelik isteğini yanlışlıkla onaylatmak (oltalama ya da başka yolla). | R6 | Cüzdan sağlayıcısı | Alan alan onay, aşırı talepte ayrı uyarı ([[SPEC-WALLET-0001]]/WL8, RB-WP-04), doğrulayıcının kayıtlı adı (RB-WP-13), paylaşım kuralı uyarısı ([[ADR-0046]]/EP3). Oltalama tümüyle önlenemez. | Kısmen |
| TR29 | Kimliğin gerekmediği ya da izin verilmediği yerde cüzdandan öznitelik sızdırıp kişiyi tanımlamak. | R6 | Cüzdan sağlayıcısı, Doğrulayıcı | Seçici açıklama, yaş alanları ([[ADR-0064]]/YE2), site başına takma ad (RB-RP-13), sıfır bilgi ispatı ([[ADR-0032]]), kapsam denetimi ([[SPEC-API-0001]]/AP6). Artık risk FW-ARF-0001 §7.4 L3. | Kısmen |
| TR30 | Teknik ve usule ilişkin denetimleri aşıp veri çıkarmak. | R6 | İşletmeci, Cüzdan sağlayıcısı | Ortak kayıtlarda kişisel veri yok (RB-GEN-01, [[SPEC-TRUST-0001]]/TL11); günlüklerde değer yok (RB-GEN-06); cüzdanda veri cihazda. Bağımsız sızma testi yok. | Kısmen |
| TR31 | Bir isteğin saldırgana sızması. | R6 | Doğrulayıcı | İstek imzalı; `request_uri`'nin her çekimi taze `state`, `nonce` ve şifreleme anahtarlı ayrı dal ([[ADR-0067]]/RQ1); yanıt şifreli ([[SPEC-PROTO-0002]]/PV3). İstenen alan adları istek nesnesini çeken herkese görünür. | Kısmen |
| TR32 | Gömülü açıklama politikasını öğrenip mevcut istekteki öznitelikleri cüzdan birimleri adına sunmak. | R6 | Belge veren, Cüzdan sağlayıcısı | Politika imzalı metadata'da herkese açıktır (bilinçli; [[ADR-0046]]/EP1); politika kişinin onayını kaldırmaz, sunumu cüzdan kişinin onayıyla yapar (EP3, [[SPEC-WALLET-0001]]/WL11). | Kısmen |
| TR33 | Günlükleri ya da bir kısmını çıkarmak. | R6 | Cüzdan sağlayıcısı | Günlük cihazda kalır; yalnız kişinin başlattığı, parolayla şifreli dışa aktarmada çıkar ([[SPEC-WALLET-0001]]/WL4, [[ADR-0027]]/LX1, LX2). Cihaz düzeyindeki koruma platforma dayanır. | Kısmen |
| TR34 | Bir cüzdanın aynı ya da başka bir cihazda kurulu olduğunu öğrenip onun hakkında bilgi edinmek. | R6 | Cüzdan sağlayıcısı | WIA'nın `sub`'ı aynı cüzdan çözümünün bütün örneklerinde ortaktır ([[ADR-0034]]/CI6); cüzdanı ele veren bir uç yok. İşletim sistemi düzeyinde uygulama tespiti platformun alanında. | Kısmen |
| TR35 | WSCA'ya kullanıcı kimlik doğrulamasında kullanılan bilgi faktörünü elde etmek. | R6 | Cüzdan sağlayıcısı | Kullanıcı doğrulaması cihazın biyometrisi ya da parolasıyla ([[SPEC-WALLET-0001]]/WL11); deneme sınırı platformda; sertifikalı WSCA yok. | Kısmen |
| TR36 | Bir kişiye ait öznitelik belgesinin aynı doğrulayıcıyla ya da farklı doğrulayıcılarla birden çok işlemde sunulmasının işlemleri istemeden o kişiye bağlaması. | R6 | Cüzdan sağlayıcısı, Belge veren | Toplu verilen 10 kopya (RB-AP-09), her doğrulayıcıya ayrı kopya ([[SPEC-WALLET-0001]]/WL5, RB-WP-05), site başına takma ad ([[ADR-0031]]/PS1), kimlik belgesinde sıfır bilgi ispatı ([[ADR-0032]]). Aynı doğrulayıcıda aynı kopya bilinçli; artık risk FW-ARF-0001 §7.4 L3. | Kısmen |
| TR37 | Herkese açık bir belge ya da doğrulayıcı iptal listesinin kişinin belgesini kullanımına ilişkin bilgi (konum, IP adresi …) taşıması. | R6 | Belge veren, İşletmeci | İptal listeleri sabit aralıkla yayınlanır ([[SPEC-CRED-0003]]/S5), doğrulayıcı toplu ön çeker (S12), konum rastgele (S7); IP adresi günlüğe yazılmaz (RB-GEN-05). | Karşılandı |
| TR38 | Paylaşılan öznitelikler için kişinin rızası kanıtlanamazsa doğrulayıcıların günlüklerin bütünlüğünü etkileyebilmesi. | R6 | Doğrulayıcı, Cüzdan sağlayıcısı | Sunum KB-JWT ya da cihaz imzasıyla kişinin anahtarına bağlı; doğrulayıcının denetim kaydı reddedilenlerde de tutulur ([[SPEC-API-0001]]/AP9). Cüzdan günlüğünün bütünlük koruması yok. | Kısmen |
| TR39 | Benzersiz ya da izlenebilir tanımlayıcılarla kişileri hukuka aykırı biçimde izlemek. | R6 / R14 | Cüzdan sağlayıcısı, Doğrulayıcı | Küresel tanımlayıcı yok ([[SPEC-ID-0002]]/XC4, RB-H-06); site başına takma ad ([[ADR-0031]]/PS1); giriş politikaları kimlik numarası istemez (PS4); WIA `sub` ortak ([[ADR-0034]]/CI6). Kimlik numarası açıklanırsa kişi izlenebilir. | Kısmen |
| TR40 | Her biri farklı kapsamda olan birden çok birimden oluşan bir doğrulayıcının hukuki dayanağı olmayan veriyi istemesi ve işlemesi. | R6 / R9 | Doğrulayıcı, İşletmeci | Kayıt bir kapsamla (RB-REG-08), her kullanımın tek kayıt sertifikası (RB-RP-14), kapsam denetimi ([[SPEC-API-0001]]/AP6), aracı ilişkisi iki kayıtta ([[SPEC-PROTO-0002]]/PV14). Doğrulayıcı başına tek erişim sertifikası; AB'deki doğrulayıcı sistemi (RP Instance) ayrımı yok. | Kısmen |
| TR41 | Cüzdanın PID bütünlük ve özgünlük denetimlerini her zaman başarı döndürecek biçimde bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | Kabul kararı cüzdanda değil, doğrulayıcının kendi doğrulama hattındadır (RB-RP-03); cüzdandaki denetimin bozulması sahte belgeyi kabul ettirmez. | Karşılandı |
| TR42 | Cüzdanın istenen özniteliklerin bütünlük ve özgünlük denetimlerini atlatmak ya da bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | Doğrulayıcı imzayı, özetleri ve `sd_hash`'i kendisi denetler (RB-RP-03, [[SPEC-CRED-0002]]/C9, C10). | Karşılandı |
| TR43 | Cüzdanın istenen bütün özniteliklerin aynı kişiye ait olduğu denetimini atlatmak ya da bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | Doğrulayıcı aynı yanıttaki her belgenin holder binding'ini aynı `aud` ve `nonce`'a göre ayrı ayrı denetler ([[SPEC-PROTO-0002]]/PV7, PV10, PV11); belgelerin aynı cüzdan birimine ait olduğunu gösteren kriptografik bir bağ yok (bkz. TR86). | Kısmen |
| TR44 | Cüzdanın PID'in geçerli olduğu ve güvenilir bir sağlayıcıdan geldiği denetimini atlatmak ya da bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | Doğrulayıcı kurumun `iat` anında kabul edilebilir olduğunu ve tür yetkisini imzalı listeden kendisi sorar (RB-RP-03, [[SPEC-API-0001]]/AP8). | Karşılandı |
| TR45 | Cüzdanın bir QEAA'nın geçerli olduğu ve onu vermeye kayıtlı nitelikli bir güven hizmeti sağlayıcısından geldiği denetimini atlatmak ya da bozmak. | R7 | Doğrulayıcı | Ağda nitelikli güven hizmeti sağlayıcısı yok; nitelikli sınıf bağımsız uygunluk değerlendirmesi olmadan yazılmaz ([[ADR-0022]]/IDC1). | Uygulanmaz |
| TR46 | Cüzdanın PID'in sağlayıcısınca iptal edilip edilmediği denetimini atlatmak ya da bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | Doğrulayıcı iptal durumunu kendisi denetler ([[SPEC-CRED-0003]]); iptal listesi gereken türde iptal girişi olmayan belge reddedilir ([[ADR-0056]]/MR8). | Karşılandı |
| TR47 | Cüzdanın (Q)EAA'nın sağlayıcısınca iptal edilip edilmediği denetimini atlatmak ya da bozmak. | R7 | Cüzdan sağlayıcısı, Doğrulayıcı | TR46 ile aynı: doğrulayıcı iptali kendisi denetler ([[SPEC-CRED-0003]], [[ADR-0056]]/MR8). | Karşılandı |
| TR48 | Yalnız kişinin denetiminde olması gereken yedek ve kurtarma verisinin içeriğini değiştirmek. | R7 / R8 | Cüzdan sağlayıcısı | Cüzdan yedeği yok ([[SPEC-WALLET-0001]]/WL2, RB-WP-07); taşıma dosyası parolayla şifrelidir, belge değeri ve anahtar içermez ([[ADR-0027]]/LX2, [[ADR-0078]]). | Uygulanmaz |
| TR49 | Bir cüzdan örneğinin işlem geçmişini etkinlik günlüklerinde değiştirmek. | R7 / R8 | Cüzdan sağlayıcısı | Günlük cihazda tutulur; günlüğe imza ya da özet zinciri gibi bir bütünlük koruması yok. | Açık |
| TR50 | Cüzdanla doğrulayıcı arasındaki bağlantıyı dinlemek. | R5 / R6 | Doğrulayıcı, Cüzdan sağlayıcısı | TLS ve şifreli yanıt ([[SPEC-PROTO-0002]]/PV3, RB-RP-02); yakın alanda oturum şifrelemesi. | Karşılandı |
| TR51 | Kişiyi kişisel verisini (PID, EAA, takma ad, e-imza, günlük …) saldırganla ya da istemediği üçüncü bir tarafla paylaşmaya ikna etmek. | R5 / R6 | Cüzdan sağlayıcısı | Kayıt sertifikası zorunlu (RB-WP-19), kayıtlı ad (RB-WP-13), alan alan onay ve aşırı talep uyarısı (RB-WP-04); askıdaki ya da kayıtsız doğrulayıcıya sunum yok. İkna tümüyle önlenemez. | Kısmen |
| TR52 | Bir cüzdan örneğinin işlem geçmişini etkinlik günlüklerinden okumak. | R5 / R6 | Cüzdan sağlayıcısı | Günlük cihazda ve sunucuya gitmez ([[SPEC-WALLET-0001]]/WL4, [[SPEC-PROTO-0002]]/PV8); dışa aktarma şifreli ([[ADR-0027]]/LX1). | Kısmen |
| TR53 | Kriptografik anahtar malzemesini WSCD dışına çıkarmak. | R5 / R6 / R9 | Cüzdan sağlayıcısı | Anahtarlar güvenli bölgede üretilir ve çıkmaz ([[SPEC-WALLET-0001]]/WL1, RB-WP-01); anahtar kanıtı depo seviyesini doğru söyler ([[ADR-0025]]/WIA3). Sertifikalı WSCD (W3) yok. | Kısmen |
| TR54 | Yalnız kişinin denetiminde olması gereken yedek ve kurtarma verisinin içeriğini okumak. | R5 / R6 | Cüzdan sağlayıcısı | Cüzdan yedeği yok ([[SPEC-WALLET-0001]]/WL2); taşıma dosyası parolayla şifreli ([[ADR-0027]]/LX1). | Uygulanmaz |
| TR55 | Bir cüzdan biriminin ürettiği takma adı kullanmak için kullanıcı doğrulamasını atlatmak. | R4 | Cüzdan sağlayıcısı | Takma ad sunumu takma ad anahtarıyla imzalı ve iptal edilmemiş birim kanıtı taşır ([[ADR-0031]]/PS5); kullanıcı doğrulaması ([[SPEC-WALLET-0001]]/WL11). | Kısmen |
| TR56 | Kişilere belirli bir meşru cüzdanı taklit eden bir uygulama önermek. | R4 | Cüzdan sağlayıcısı, Belge veren | Belge veren yalnız listedeki sağlayıcının imzaladığı WIA'yı kabul eder ([[SPEC-PROTO-0001]]/PR11); "Tamga Network'te listeli" göstergesi imzalı listeden ([[ADR-0049]]/LI1–LI3). Kişinin taklit uygulamayı kurması önlenemez. | Kısmen |
| TR57 | PID, (Q)EAA ya da günlük dahil cüzdan verisini dışa aktarmak. | R4 | Cüzdan sağlayıcısı | Dışa aktarma yalnız kişinin başlattığı ve parolayla şifreli; dosyada belge değeri, kopya ve anahtar yok ([[ADR-0027]]/LX1, LX2). | Kısmen |
| TR58 | Kriptografik bağlama malzemesini dışa aktarmak. | R4 | Cüzdan sağlayıcısı | Anahtarlar güvenli bölgeden çıkmaz ([[SPEC-WALLET-0001]]/WL1); sertifikalı WSCD yok. | Kısmen |
| TR59 | Cüzdanın kriptografik anahtarları üzerinden kimlikleri ele geçirmek. | R4 | Cüzdan sağlayıcısı | Anahtar kullanımı kullanıcı doğrulamasına bağlı ([[SPEC-WALLET-0001]]/WL1, WL11); birim iptal edilince WIA girişleri iptal olur ([[ADR-0025]]/WIA2). | Kısmen |
| TR60 | Başka bir kişinin cüzdan birimini kendi cihazına kopyalayıp kullanmak. | R4 / R1 | Cüzdan sağlayıcısı | Anahtarlar cihaza bağlı ve taşınmaz ([[SPEC-WALLET-0001]]/WL1, WL2); cihaz kanıtı W3'te zorunlu, W2'de isteğe bağlı (RB-WP-17). | Kısmen |
| TR61 | Başka bir devletin makamlarının, örneğin sınırda, yakın alanda kişiden bütün cüzdan verisini göstermesini ya da paylaşmasını istemesi. | R4 / R14 | Cüzdan sağlayıcısı | Her gösterimde alan alan onay (RB-H-02) ve seçici açıklama; yakın alanda okuyucu kaydı ve kapı grupları ([[ADR-0069]]). Hukuki zorlamaya karşı teknik önlem sınırlıdır. | Kısmen |
| TR62 | Kişilerin cihaz arızasından sonra işlem günlüklerini yeni cüzdana aktaramaması. | R11 | Cüzdan sağlayıcısı | Günlük, cihaz çalışırken kişinin şifreli taşıma dosyasıyla taşınır ([[ADR-0078]], [[ADR-0027]]/LX1); arızalı cihazdan aktarım yolu yok. | Kısmen |
| TR63 | Kişilerin cihaz arızasından sonra işlem günlüklerini kurtaramaması. | R11 | Cüzdan sağlayıcısı | Sunucu tarafı yedek bilinçli olarak yok ([[SPEC-WALLET-0001]]/WL2, WL4); arızada günlük kaybolur. | Açık |
| TR64 | Doğrulayıcıların uzaktan elektronik imza için rızayı kanıtlamakta zorlanması. | R11 | Doğrulayıcı | Ağda elektronik imza işlevi bugün yok. | Uygulanmaz |
| TR65 | Doğrulayıcıyla bağlantı sırasında bağlantıyı isteklerle boğmak. | R13 | Doğrulayıcı | Referans doğrulayıcıda istek sınırı; `request_uri` dallarında bellek sınırı ([[ADR-0067]]/RQ5). Yük testi yapılmadı. | Kısmen |
| TR66 | Durum sağlama hizmetini doğrulayıcı bağlantılarıyla boğmak. | R13 | Belge veren, İşletmeci | İptal listeleri statik dosya olarak içerik dağıtım ağından yayınlanır; doğrulayıcı doğrulama başına çekmez, toplu ön çeker ([[SPEC-CRED-0003]]/S12). Yük testi yapılmadı. | Kısmen |
| TR67 | Öznitelik sunumunu, geçerli olduğu hâlde itiraz edilmiş ya da reddedilmiş gibi göstermek. | R13 | Doğrulayıcı | Sonuç üç değerli; "doğrulanamadı" reddedilmiş sayılmaz ([[SPEC-API-0001]]/AP2, RB-RP-05) ve kişiye ayrı gösterilir ([[SPEC-CRED-0003]]/S14); sonuç yapılan ve atlanan adımları taşır. | Kısmen |
| TR68 | Bir PID'i haklı neden olmadan iptal etmek. | R13 | Kimlik servisi | İptal koşulları politikada ([[FW-POL-0001]]); iptali yalnız belge veren yapar; kişinin itiraz yolu (RB-H-05). İptal anahtarının korunması belge verende. | Kısmen |
| TR69 | Bir PID'i kişinin rızası olmadan iptal etmek. | R13 | Kimlik servisi | TR68 ile aynı; kişinin isteğiyle iptal yolları politikada ([[FW-POL-0001]]). | Kısmen |
| TR70 | Bir (Q)EAA'yı haklı neden olmadan iptal etmek. | R13 | Belge veren | İptal koşulları ortak politikada; kurum yalnız koşul ekleyebilir, daraltamaz ([[ADR-0047]]/WR2); iptal anahtarı belge anahtarından ayrı ([[SPEC-CRED-0003]]/S11). | Kısmen |
| TR71 | Bir (Q)EAA'yı kişinin rızası olmadan iptal etmek. | R13 | Belge veren | TR70 ile aynı ([[FW-POL-0001]]). | Kısmen |
| TR72 | Kasıtlı yetim istekler olarak tanınmayan çok sayıda kimlik isteği tetiklemek. | R13 | Doğrulayıcı, Cüzdan sağlayıcısı | İstek nesnesi süreli ([[SPEC-PROTO-0002]]/PV13), `nonce` tek kullanımlık (PV10), dallar bellek sınırlı ([[ADR-0067]]/RQ5); cüzdan kayıt sertifikasız isteği kişiye sormadan reddeder (RB-WP-19). | Kısmen |
| TR73 | Ardından işlem gelmeyen çok sayıda istek göndermek. | R13 | Doğrulayıcı | TR72 ile aynı; referans doğrulayıcıda istek sınırı. | Kısmen |
| TR74 | Doğrulayıcıya eşleşen bir yanıt ve tam denetim olmadan kimlik isteme imkânı vermek. | R13 | Doğrulayıcı | Her istek imzalı ve kayıtlı doğrulayıcıya bağlı ([[SPEC-PROTO-0002]]/PV6, RB-RP-01); yanıt yalnız kendi dalını kapatır ([[ADR-0067]]/RQ2). | Kısmen |
| TR75 | Zaman aşımından sonra bir isteğe yanıt göndermek ya da benzer yollarla hizmeti kesintiye uğratmak. | R13 | Doğrulayıcı | İstek nesnesi süreli ([[SPEC-PROTO-0002]]/PV13), `nonce` tek kullanımlık (PV10); çözülemeyen yanıt sunuma dokunmaz ve deneme sayılmaz ([[ADR-0067]]/RQ4). | Karşılandı |
| TR76 | Bir doğrulayıcının çok sayıda geçersiz istek göndermesi. | R13 | Doğrulayıcı, Cüzdan sağlayıcısı | Cüzdan imzasız ya da kayıt sertifikasız isteği kişiye sormadan reddeder ([[SPEC-PROTO-0002]]/PV6, RB-WP-19); kötüye kullanan doğrulayıcıya yaptırım merdiveni (RB-ENF-02). | Kısmen |
| TR77 | Bir cüzdan sağlayıcısına çok sayıda geçersiz istek göndermek. | R13 | Cüzdan sağlayıcısı | Ağ kuralı yok; sağlayıcının işletme önlemi. Birim istekleri birim anahtarıyla imzalı ([[ADR-0025]]). | Kısmen |
| TR78 | Bir devleti güvenilmez bir PID sağlayıcısını güven listesinden çıkaramaz hâle getirmek. | R13 | İşletmeci | Liste en çok 90 günde yeniden imzalanır, değişiklik hızla yayınlanır (RB-OP-03); bayat liste "doğrulanamadı" verir (RB-GEN-03). Liste imzası tek işletmecide (FW-ARF-0001 §7.4 L1). | Kısmen |
| TR79 | Bir cüzdanın askıya alınmasını ya da iptalini engellemek. | R13 | Cüzdan sağlayıcısı, Kimlik servisi | Telefonsuz ve hesapsız birim iptali ([[ADR-0047]]/WR3); WIA ömrü 24 saatten kısa ([[ADR-0025]]/WIA1); kimlik servisi iptal edilen birimdeki belgelerini en geç 24 saatte iptal eder ([[ADR-0047]]/WR1). | Karşılandı |
| TR80 | Doğrulayıcıların, kişilerin ya da PID sağlayıcısının işlemlerini engellemek. | R13 | İşletmeci, Doğrulayıcı | Yakın alanda internetsiz gösterim; doğrulayıcı listeleri önceden çeker (RB-RP-06); bayat kaynakta "doğrulanamadı" (RB-GEN-03). Kesinti testleri yapılmadı. | Kısmen |
| TR81 | Bir WSCD'yi devre dışı bırakmak ya da kullanılamaz hâle getirmek. | R13 | Cüzdan sağlayıcısı | Platformun güvenli bölgesi; cihaz kaybında ya da arızasında belgeler yeniden alınır (RB-H-04). | Kısmen |
| TR82 | PID sağlayıcısını PID'leri iptal edemez ya da askıya alamaz hâle getirmek. | R13 / R9 | Kimlik servisi | İptal listesi değişiklik olmasa da sabit aralıkla yayınlanır; servis yeniden başlayınca yayımlı belirteç yoksa hemen yayın ([[SPEC-CRED-0003]]/S5, S6); belirtecin süresi dolarsa doğrulayıcı "doğrulanamadı" verir. | Kısmen |
| TR83 | Bir doğrulayıcının kendisiyle paylaşılanın ötesinde kişinin kimlik verisini çıkarması. | R14 | Doğrulayıcı | Kapsam denetimi ([[SPEC-API-0001]]/AP6), veri azaltma incelemesi (RB-REG-08), seçici açıklama ve yaş alanları ([[ADR-0064]]/YE2). | Kısmen |
| TR84 | Gizlice işbirliği yapan doğrulayıcıların ya da PID sağlayıcılarının bildiklerinin ötesinde kişinin kimlik verisini çıkarması. | R14 | Doğrulayıcı, Belge veren | Doğrulayıcı başına ayrı kopya ve takma ad; kimlik belgesinde sıfır bilgi ispatı ([[ADR-0032]]). Aynı belge verenin belgeleri birleştirilirse eşleştirme riski kalır (FW-ARF-0001 §7.4 L3). | Kısmen |
| TR85 | Kimlik gerekmediği yerde kişinin kimlik verisini kullanarak onu izlemek. | R14 | Doğrulayıcı | Giriş politikaları kimlik numarası istemez ([[ADR-0031]]/PS4); site başına takma ad (RB-RP-13); kapsam denetimi ([[SPEC-API-0001]]/AP6). | Kısmen |
| TR86 | (Q)EAA birleşimlerinin "sahte" bir sunumunu oluşturmak. | R10 | Doğrulayıcı | Aynı yanıttaki her belgenin holder binding'i aynı `aud` ve `nonce`'a göre ayrı ayrı denetlenir ([[SPEC-PROTO-0002]]/PV7, PV10, PV11); iki kişinin cüzdanı birlikte çalışırsa belgelerin aynı cüzdan birimine ait olduğunu gösteren kriptografik bir bağ yok. AB tartışması sürüyor. | Kısmen |
| TR87 | Cüzdanı, kişinin açık rızası ya da tek denetimi olmadan, kişinin farkında olmadığı (ör. uyurken) ya da doğrulayıcıyı göremediği durumlarda uzaktan etkinleştirmek ya da ele geçirmek. | R10 | Cüzdan sağlayıcısı | Her gösterim kullanıcı doğrulaması ister ([[SPEC-WALLET-0001]]/WL11); onay ekranı doğrulayıcının kayıtlı adını gösterir (RB-WP-13). | Kısmen |
| TR88 | Bir isteğin meta verisini (hizmet adı, kullanımlar …) değiştirmek. | R10 | Doğrulayıcı, Cüzdan sağlayıcısı | İstek nesnesi imzalı ([[SPEC-PROTO-0002]]/PV6); kayıt sertifikası imzalı ve erişim sertifikasına bağlı ([[ADR-0026]]/WRC4). | Karşılandı |
| TR89 | Yanıt bilgisini (hizmet durumu, `nonce` …) değiştirmek. | R10 | Doğrulayıcı | Yanıt şifreli ([[SPEC-PROTO-0002]]/PV3); KB-JWT `nonce` ve `aud`'u imzalar (PV7), `sd_hash` sunulan seti bağlar ([[SPEC-CRED-0002]]/C9). | Karşılandı |
| TR90 | Bir isteğin öznitelik bilgisini değiştirmek (aşırı isteme …). | R10 | Doğrulayıcı, Cüzdan sağlayıcısı | İstek imzalı; cüzdan istenenleri kayıtlı kapsamla karşılaştırır ve aşırı talepte uyarır ([[SPEC-WALLET-0001]]/WL8); doğrulayıcıda kapsam denetimi ([[SPEC-API-0001]]/AP6). | Karşılandı |
| TR91 | Bir doğrulayıcının önceki bir oturumun öğelerini başka bir oturumda tekrar kullanması. | R10 | Doğrulayıcı | `nonce` tek kullanımlık ([[SPEC-PROTO-0002]]/PV10); her çekim taze dal (PV15); KB-JWT `iat` penceresi ([[SPEC-CRED-0002]]/C17). | Karşılandı |
| TR92 | PID'i sağlayıcıdan cüzdan birimine aktarılırken değiştirmek ya da başkasıyla değiştirmek. | R10 | Kimlik servisi, Cüzdan sağlayıcısı | Belge imzalı ve TLS üzerinden; erişim belirteci DPoP'a bağlı ([[SPEC-PROTO-0001]]/PR17); cüzdan alırken imzayı ve kendi anahtarına bağlılığı denetler. | Karşılandı |
| TR93 | PID'i cüzdan biriminden çevrim içi doğrulayıcıya aktarılırken değiştirmek ya da başkasıyla değiştirmek. | R10 | Doğrulayıcı | Belge imzası, KB-JWT ve şifreli yanıt ([[SPEC-CRED-0002]]/C8, [[SPEC-PROTO-0002]]/PV3). | Karşılandı |
| TR94 | PID'i cüzdan biriminden çevrim dışı doğrulayıcıya aktarılırken değiştirmek ya da başkasıyla değiştirmek. | R10 | Doğrulayıcı | mdoc'ta belge verenin imzası ve oturuma bağlı cihaz imzası ([[ADR-0013]]/MD3, [[SPEC-PROTO-0002]]/PV11); yakın alanda oturum şifrelemesi. | Karşılandı |
| TR95 | Kişinin rızası olmadan PID vermek. | R9 | Kimlik servisi | Kimlik belgesinden önce aydınlatma ve açık rıza ([[SPEC-ID-0003]]/IDP11); kişinin akışı başlatan cüzdanda son onayı ([[ADR-0080]]/VL1); "belgeniz bir cüzdana eklendi" bildirimi (RB-AP-15). | Karşılandı |
| TR96 | İptal edilmiş ya da geçersiz gömülü açıklama politikalarını, belki doğrulayıcıların bilgisi olmadan kullanmak. | R9 | Belge veren, Cüzdan sağlayıcısı | Politika yalnız imzalı metadata'da ([[ADR-0046]]/EP1); politikası değişen yapılandırmanın belgeleri iptal edilir (EP4); cüzdan politikayı ağsız değerlendirir (EP2). | Karşılandı |
| TR97 | Cüzdanı yanlış elektronik imzaları doğrulamaya kandırmak. | R9 | Cüzdan sağlayıcısı | Ağda elektronik imza işlevi bugün yok. | Uygulanmaz |
| TR98 | Cüzdanı kişinin denetimi dışında kullanmak. | R9 | Cüzdan sağlayıcısı | Her gösterimde kullanıcı doğrulaması ([[SPEC-WALLET-0001]]/WL11); telefonsuz birim iptali ([[ADR-0047]]/WR3). | Kısmen |
| TR99 | Kişiyi saldırganla ya da yetkisiz bir üçüncü tarafla kimlik doğrulamaya ve işlem onaylamaya ikna etmek. | R9 | Cüzdan sağlayıcısı | Kayıt sertifikası zorunlu (RB-WP-19), kayıtlı ad (RB-WP-13); askıdaki ya da iptal edilmiş doğrulayıcıya sunum yok. İkna tümüyle önlenemez. | Kısmen |
| TR100 | Kişiye içeriği göstermeden ya da yanlış içerik göstererek elektronik imza attırmak. | R9 | Cüzdan sağlayıcısı | Ağda elektronik imza işlevi bugün yok. | Uygulanmaz |
| TR101 | Kişinin cüzdan sağlayıcısındaki hesabının erişim denetimini atlatmak. | R9 | Cüzdan sağlayıcısı | Cüzdan sağlayıcısı kullanıcı hesabı istemez ([[ADR-0047]]/WR3); birim kaydında kişisel veri yok ([[ADR-0025]]/WIA2). | Uygulanmaz |
| TR102 | Bağlantı sırasında doğrulayıcıları taklit etmek. | R9 / R6 | Doğrulayıcı, Cüzdan sağlayıcısı | İstemci kimliği erişim sertifikasından ve yaprakla eşleşmeli ([[ADR-0034]]/CI1, CI2); kayıt sertifikası zorunlu ([[ADR-0056]]/MR5); imzalı istek ([[SPEC-PROTO-0002]]/PV6). | Karşılandı |
| TR103 | Doğrulayıcı–tarayıcı bağlantısının arkasındaki kişinin doğrulayıcı–cüzdan bağlantısının arkasındaki kişiden farklı olabilmesi. | R9 / R6 / R4 | Doğrulayıcı | Digital Credentials API yolunda yanıt sayfa kökenine bağlı ([[SPEC-PROTO-0002]]/PV7); cihazlar arası (QR) yolda tarayıcı oturumu ile cüzdan arasında ayrı bir bağ yok. | Kısmen |
| TR104 | Kişiyi cüzdanını sebepsiz iptal etmeye ikna etmek. | R9 / R13 | Cüzdan sağlayıcısı | İptal kişinin kapatma koduyla ya da cüzdanın içinden yapılır ([[ADR-0047]]/WR3); kişi iptali cüzdan dışından öğrenebilir (WR4). İkna tümüyle önlenemez. | Kısmen |
| TR105 | Ortadaki adam saldırısı yapmak. | R9 / R6 / R14 | Doğrulayıcı, Cüzdan sağlayıcısı | TLS, imzalı istek, şifreli yanıt ([[SPEC-PROTO-0002]]/PV3, PV6); yakın alanda oturum şifrelemesi; erişim sertifikası istemci kimliğine bağlı ([[ADR-0034]]/CI2). | Karşılandı |
| TR106 | Ağa düzenli bağlanmayan bir cüzdandan geçersiz ya da iptal edilmiş öznitelikler sunmak. | çeşitli | Doğrulayıcı | Doğrulayıcı iptal durumunu ve süreyi kendisi denetler ([[SPEC-CRED-0003]]); sıfır bilgi ispatı yalnız en çok 24 saatlik kopyalarla ([[ADR-0044]]/ZC1). | Karşılandı |
| TR107 | Bir cüzdanı taklit ederek kişiden bilgi çalmak. | çeşitli | Cüzdan sağlayıcısı | Belge veren yalnız listedeki sağlayıcının WIA'sını kabul eder ([[SPEC-PROTO-0001]]/PR11); "listeli" göstergesi ([[ADR-0049]]/LI1–LI3). Kişinin sahte uygulamaya veri girmesi önlenemez. | Kısmen |
| TR108 | Bir veri isteğini (ör. kimlik doğrulama) tekrar oynatarak ya da taklit ederek geçerli görünen biçimde kişiyi taklit etmek. | çeşitli | Doğrulayıcı | `nonce` tek kullanımlık ([[SPEC-PROTO-0002]]/PV10), KB-JWT `aud` ve `iat` penceresi (PV7, [[SPEC-CRED-0002]]/C17). | Karşılandı |
| TR109 | Onaylanmış bir isteği taklit etmek için gömülü açıklama politikasını kişiye karşı tekrar oynatmak. | çeşitli | Cüzdan sağlayıcısı | Politika belgeyle birlikte imzalı metadata'dan saklanır ([[ADR-0046]]/EP2); politika kişinin onayının yerini almaz, her gösterim onay ister (EP3). | Kısmen |
| TR110 | Bir güvenlik ihlali ya da ele geçirilmeden sonra kişilerin bilgisizliğinden ya da gecikmeden yararlanmak. | çeşitli | İşletmeci, Cüzdan sağlayıcısı | Olay bildirim süreleri (RB-GEN-09), kişinin birim iptalini cüzdan dışından öğrenme yolu ([[ADR-0047]]/WR4), üç ayda bir şeffaflık raporu (RB-OP-12). Kişiye doğrudan uyarı kanalı yalnız cüzdanın kendi bildirimleri. | Kısmen |
| TR111 | Daha önce kurulmuş meşru bir cüzdan örneğine kötü amaçlı özellikler eklemek. | çeşitli | Cüzdan sağlayıcısı | Cihaz kanıtı W3'te zorunlu (RB-WP-17); açık bulunursa sürüm bazında cüzdan kanıtı iptali (RB-WP-11). | Kısmen |
| TR112 | Meşru bir cüzdan örneğini değiştirip kişilere meşru diye önermek. | çeşitli | Cüzdan sağlayıcısı | TR111 ile aynı; belge veren yalnız listedeki sağlayıcının WIA'sını kabul eder ([[SPEC-PROTO-0001]]/PR11). | Kısmen |
| TR113 | Kullanıcı doğrulama mekanizmasının kendisini aşıp kişinin kimlik doğrulamasını atlatmak. | çeşitli | Cüzdan sağlayıcısı | Kullanıcı doğrulaması platformun biyometrisi ya da parolasıyla ([[SPEC-WALLET-0001]]/WL11); sertifikasyon yok. | Kısmen |
| TR114 | Cüzdan kodunun kullanıcı cihazına dağıtımı sırasında kötü amaçlı kod ya da arka kapı eklemek. | çeşitli | Cüzdan sağlayıcısı | Uygulama mağazası imzası; paketlerde yayın kaynağı kanıtı (RB-GEN-07). | Kısmen |
| TR115 | Cüzdan kodunun geliştirilmesi sırasında kötü amaçlı kod ya da arka kapı eklemek. | çeşitli | Cüzdan sağlayıcısı | Açık kaynak çekirdek, yayın kaynağı kanıtı (RB-GEN-07), yayın öncesi zorunlu testler (RB-ENF-01); bağımsız kod denetimi yok. | Kısmen |
| TR116 | Rastgele sayı üretimini saldırıya imkân verecek ölçüde entropisini düşürecek biçimde kurcalamak. | çeşitli | Cüzdan sağlayıcısı, Belge veren | Platformun kriptografik üreteci; salt ≥ 128 bit ([[SPEC-CRED-0002]]/C3); iptal konumu rastgele ([[SPEC-CRED-0003]]/S7). | Kısmen |
| TR117 | Tedarik zincirinde kullanıcı cihazlarına cüzdanın kullanım koşullarını karşılamayan kod ya da yapılandırma eklemek. | çeşitli | Cüzdan sağlayıcısı | Cihaz kanıtı W3'te zorunlu, W2'de isteğe bağlı (RB-WP-17). | Kısmen |
| TR118 | Saldırganın denetimindeki sahte bir WSCD ile cüzdan birimi etkinleştirmek. | çeşitli | Cüzdan sağlayıcısı | Anahtar kanıtı depo seviyesini doğru söyler ([[ADR-0025]]/WIA3); W3 beyanı yalnız cihaz kanıtı doğrulanmış birime ([[ADR-0047]]/WR5). | Kısmen |
| TR119 | WSCA'ya ve/veya WSCD'ye gönderilen bilgiyi okumak. | çeşitli | Cüzdan sağlayıcısı | WSCA ve WSCD platformun güvenli bölgesidir; ayrı bir sertifikalı bileşen yok (FW-ARF-0001 §7.1). | Kısmen |
| TR120 | WSCA'ya keyfi bilgi göndermek. | çeşitli | Cüzdan sağlayıcısı | TR119 ile aynı. | Kısmen |
| TR121 | WSCA ile WSCD arasındaki alışverişi dinleyerek bilgi çalmak. | çeşitli | Cüzdan sağlayıcısı | TR119 ile aynı. | Kısmen |
| TR122 | WSCD'ye keyfi bilgi göndermek. | çeşitli | Cüzdan sağlayıcısı | TR119 ile aynı. | Kısmen |
| TR123 | WSCA'yı atlayarak WSCD'ye bilgi göndermek. | çeşitli | Cüzdan sağlayıcısı | TR119 ile aynı. | Kısmen |
| TR124 | Oltalamayla kişileri sahte bir cüzdan ve PID yönetim web uygulamasına yönlendirmek. | çeşitli | Kimlik servisi, Cüzdan sağlayıcısı | Kimlik doğrulama yalnız cüzdanın başlattığı akışta ve son onay o cüzdanda ([[ADR-0080]]/VL1, VL2); doğrulama öncesi uyarı (VL3). Sahte sayfaya veri girilmesi önlenemez. | Kısmen |
| TR125 | Başka bir saldırıda kullanılacak iletiler üretmek için cüzdanın anahtarlarını başka anahtarlarla değiştirmek. | çeşitli | Cüzdan sağlayıcısı, Belge veren | Belge vermeden önce anahtar kanıtı anahtarların güvenli donanımda olduğunu gösterir (RB-AP-10); her kopya kanıtlanan anahtara bağlı ([[SPEC-PROTO-0001]]/PR6). | Kısmen |
| TR126 | Cüzdanın anahtarlarını değiştirip yok ederek bazı işlevleri kullanılamaz hâle getirmek. | çeşitli | Cüzdan sağlayıcısı | Belgeler yeniden alınır (RB-H-04); anahtar silme sırası belirli (önce kayıt, sonra anahtar). | Kısmen |
| TR127 | Bir kötü amaçlı yazılımı yöneterek cüzdanda saklanan veriye erişmek. | çeşitli | Cüzdan sağlayıcısı | Anahtarlar güvenli bölgede ([[SPEC-WALLET-0001]]/WL1); veriler platformun uygulama alanında; cihaz kanıtı. | Kısmen |
| TR128 | Cüzdanda üretilen kanıtlara erişmek. | çeşitli | Cüzdan sağlayıcısı | Günlük cihazda ve yalnız şifreli dışa aktarmada çıkar ([[SPEC-WALLET-0001]]/WL4). | Kısmen |
| TR129 | Cüzdan sağlayıcılarının cüzdandaki nesnelere erişebilmesi. | çeşitli | Cüzdan sağlayıcısı | Sağlayıcı belge değerlerini görmez; birim kaydında kişisel veri yok ([[ADR-0025]]/WIA2); sağlayıcı kurtarma anahtarı tutmaz ([[SPEC-WALLET-0001]]/WL10) ve yedek almaz (WL2). | Karşılandı |
| TR130 | Cüzdan sağlayıcılarının cüzdanda üretilen kanıtlara erişebilmesi. | çeşitli | Cüzdan sağlayıcısı | Sunum günlüğü sunucuya hiçbir koşulda gitmez ([[SPEC-WALLET-0001]]/WL4, [[SPEC-PROTO-0002]]/PV8). | Karşılandı |
| TR131 | Kilidi açık bir cüzdan cihazını çalmak. | çeşitli | Cüzdan sağlayıcısı | Her gösterimde yeniden kullanıcı doğrulaması ([[SPEC-WALLET-0001]]/WL11); telefonsuz birim iptali ([[ADR-0047]]/WR3). | Kısmen |
| TR132 | Bazı olayların günlüğe yazılmasını engellemek için sistemi manipüle etmek. | çeşitli | Cüzdan sağlayıcısı | Günlük kaydı cüzdan çekirdeğinde yapılır; günlüğün eksiksizliğini gösteren bir bütünlük koruması yok. | Açık |
| TR133 | Cüzdan örneğiyle WSCA arasındaki iletişimi dinlemek ya da kişiyi tekrar oynatmak/taklit etmek (ör. kimlik doğrulama mekanizmasını ele geçirerek). | çeşitli | Cüzdan sağlayıcısı | Anahtar kullanımı platformun kullanıcı doğrulamasına bağlı ([[SPEC-WALLET-0001]]/WL1, WL11); ayrı sertifikalı WSCA yok. | Kısmen |

# 7. Açık konular

1. **Çok belgeli sunumda aynı kişi** (TR20, TR43, TR86): doğrulayıcı aynı yanıttaki her belgenin holder binding'ini ayrı
   ayrı denetler; belgelerin aynı cüzdan birimine ait olduğunu gösteren kriptografik bir bağ yoktur. AB'de de konu tartışmadadır.
2. **Cüzdan günlüğünün bütünlüğü** (TR38, TR49, TR132): günlük cihazda kalır ama değiştirilmeye ya da eksik yazılmaya karşı
   korunmaz.
3. **Sertifikasyon ve bağımsız denetim**: sertifikalı güvenli donanım (W3), bağımsız kod denetimi ve sızma testi yoktur; cüzdan
   tarafı önlemlerin çoğu bu yüzden "Kısmen"dir.
4. **Tek işletmeci** (TR4, TR17, TR78): liste imzası tek işletmecidedir; anahtar töreni ve donanım güvenlik modülü
   beklenmektedir ([[FW-ARF-0001]] §7.4 L1).

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-11-16). Öz değerlendirmedir; bir risk ya da önlem değişince aynı çalışmada güncellenir.
