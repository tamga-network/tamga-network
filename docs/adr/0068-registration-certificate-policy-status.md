---
document_id: ADR-0068
title: "Kayıt sertifikası politikası ve durum listesi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Kayıt sertifikaları (WRPRC, ETSI TS 119 475) üç alanı taşır: `policy_id` (Tamga'nın kendi politika OID'i; ETSI'nin AB OID'i
  kullanılmaz), `certificate_policy` (politika belgesinin adresi) ve `status` (kayıt kurumunun durum listesindeki girdi). Kayıt
  kurumu IETF Token Status List biçiminde, kayıt sertifikalarını imzalayan anahtarla imzalı, 1 bitlik bir durum listesi tutar;
  kayıt ya da kullanım sona erince, askıya alınınca veya içerik değişince eski sertifika otomatik iptal edilir, elle iptal de
  yapılabilir. Cüzdan çekirdeği iptal edilmiş sertifikalı isteği reddeder, durum denetlenemezse uyarır. Politika belgesi Tamga
  ARF'ın politikalarına eklenir (FW-POL-0003). Bugün yalnız sandbox'ta açıktır; gerçek ağın politika kimliği ve adresleri ad
  onayından sonra kayıt defterine girer. Kabul: 2026-10-29.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0038]]", "[[ADR-0048]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[FW-POL-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-TRUST-0001]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Kayıt sertifikası, bir doğrulayıcının ya da belge verenin ağda neyi istemeye veya vermeye kayıtlı olduğunu söyleyen imzalı
belgedir. Bugüne kadar iki eksiği vardı: hangi kurallara göre verildiğini söylemiyordu ve iptal edilemiyordu. Sıkı çalışan bir
AB cüzdanı bu yüzden Tamga doğrulayıcısının bütün isteklerini reddediyordu. Bu kararla her kayıt sertifikası kendi politikasının
kimliğini ve adresini taşır, kayıt kurumu da bir iptal listesi yayımlar. Cüzdan iptal edilmiş sertifikayı kabul etmez.

# Bağlam

- **Standart.** ETSI TS 119 475 V1.2.1 Tablo 7 her kayıt sertifikasında `policy_id`, `certificate_policy` ve `status` ister.
  §6.1.3 politikanın makine okunur ve insan okunur biçimde gösterilmesini ister (OVR-6.1.3-01/02); §6.1.4 PKI hiyerarşisinin ve
  güven çapasının açıkça tarif edilmesini (OVR-6.1.4-02). §6.2.3.9–10 ve §6.2.6 iptali bir durum listesiyle ister: kayıt
  silinince, askıya alınınca, değişince ya da içerik artık doğru değilse sertifika gecikmeden iptal edilir; liste herkese açık,
  imzalı ve sıkıştırılmış bit dizisidir; anlamlar "geçerli" ve "iptal" (REV-6.2.6.2-04); `status` alanı `idx` ve `uri` taşır
  (GEN-6.2.6.1-04). ETSI'nin kendi politika OID'i `0.4.0.19475.3.1` "revize eIDAS'a göre AB cüzdanına güvenen taraflara
  verilen" sertifika anlamındadır.
- **ARF.** RPRC_01a kayıt sertifikası sağlayıcısının 24 saatten uzun geçerli sertifikayı iptal edebilmesini, RPRC_01b iptal
  koşullarını gösteren bir politikası olmasını ister. RPACANot_03b iptal listelerinin bildirilen güven çapalarıyla doğrulanmasını
  ister. RPRC_17'ye göre cüzdan sertifikanın biçimini, gerçekliğini ve geçerliliğini denetler; denetim başarısızsa kişiyi uyarır,
  paylaşıma izin verilip verilmeyeceğine cüzdan sağlayıcı karar verir. §6.6.3.3: belge veren için "iptal edilmemiş" koşulu
  sağlanmazsa belge istenmez.
- **Bugün.** [[ADR-0026]] sertifikaları kayıttan üretir ve kayıt kurumu anahtarıyla imzalar; geçerlilik en çok 12 aydır, ama
  iptal yolu yoktur (yalnız kısa geçerlilik ve listenin yeniden yayını). Bağımsız bir AB test cüzdanıyla sandbox denemesinde
  (2026-10-29) sıkı kip, doğrulayıcının 13 politikasının 13'ünü yalnız bu üç alan yüzünden reddetti.
- **Proje yönetiminin yönü.** Eksik kapatılır; politika kimliği ve adresler kamuya açık yeni ad olduğu için önce sandbox'ta
  uygulanır, gerçek ağ adları ayrıca onaylanır.

# Karar

## K1 — Politika kimliği (`policy_id`) ve adresi (`certificate_policy`)

- Her kayıt sertifikası `policy_id` (OID dizisi, nokta ayrımlı metin; ETSI Ek C örneğindeki biçim) ve `certificate_policy`
  (politika belgesinin HTTPS adresi) taşır. Tamga ETSI'nin AB OID'ini (`0.4.0.19475.3.1`) **kullanmaz**: Tamga bir AB kayıt
  kurumu değildir ve o OID bu iddiayı taşır. Yayıncı bu değeri ayarda görürse yayını durdurur.
- OID seçenekleri:

  | Seçenek | Kayıt | Değerlendirme |
  |---|---|---|
  | IANA özel kuruluş numarası (PEN) altında: `1.3.6.1.4.1.<PEN>.1.1` | Ücretsiz başvuru, birkaç hafta | **Gerçek ağ için önerilen.** Kısa, kurumun kendi dalı; erişim sertifikası politikası ve sonraki politikalar aynı dalda |
  | UUID tabanlı OID `2.25.<UUID>` (ITU-T X.667) | Gerekmez | Hemen benzersiz ama uzun ve kuruma bağlı değil. **Sandbox için kullanılır** |
  | Yalnız adres (OID yok) | — | Ret: ETSI örneği ve X.509 alışkanlığı OID; AB cüzdanları OID bekleyebilir |
  | ETSI'nin AB OID'i | — | Ret: yanlış iddia |

- **Sandbox (bugün):** `policy_id` = `2.25.220506472418443381081254370400837050484` (yalnız sandbox; gerçek ağda geçmez),
  `certificate_policy` = `https://arf.tamga.network/policies/registration-certificate`.
- **Gerçek ağ:** OID (PEN başvurusu kuruluş adına yapılır) ve adres onaylanınca kayıt defterine girer; kod değişmez.
- Değerler kayıt defterinin kayıt kurumu rolü ayarındadır (`roles.registrar.wrprc`); ayar yoksa sertifikaya bu alanlar ve
  `status` girmez. Ayar LOTL'e yazılmaz.

## K2 — Politika belgesi (FW-POL-0003)

- İnsan okunur politika Tamga ARF'ın politikalarındadır: **Kayıt Sertifikası Politikası** ([[FW-POL-0003]],
  `arf.tamga.network/policies/registration-certificate`). Belge karar üretmez, bu kararı ve [[ADR-0024]], [[ADR-0026]],
  [[ADR-0058]]'i derler: kapsam, sertifikanın içeriği ve kaynağı, PKI hiyerarşisi ve güven çapası (OVR-6.1.4-02), geçerlilik,
  iptal koşulları, iptal isteği, durum listesi, cüzdanın denetimi, politika kimlikleri.
- Politika belgesinin sürümü değişse de OID değişmez; politikanın anlamı değişirse yeni OID verilir.

## K3 — Durum listesi

- Kayıt kurumu IETF Token Status List biçiminde ([[SPEC-CRED-0003]] ile aynı biçim) bir liste yayımlar: `statuslist+jwt`,
  **1 bit** (0 geçerli, 1 iptal; askı yoktur — askıya alınan kayıt iptal edilir, REV-6.2.3.9-04), kapasite 100.000, zlib.
- Liste, kayıt sertifikalarını imzalayan **kayıt kurumu anahtarıyla** imzalanır (x5c). Böylece LOTL'deki kayıt kurumu anahtarı
  hem sertifikaların hem iptal listesinin güven çapasıdır (ARF RPACANot_02 madde 3 ve RPACANot_03b); ayrı anahtar ve ayrı
  bildirim gerekmez. ([[SPEC-CRED-0003]] S11'in "durum anahtarı belge anahtarından ayrı" kuralı belge verenler içindir: belge
  anahtarı çevrimiçi servistedir; kayıt kurumu anahtarı yalnız yayıncıda kullanılır.)
- Adres: yayın kökünde `/status/wrprc/<n>`; sandbox `https://trust.sandbox.tamga.network/status/wrprc/1`. Yanıt türü
  `application/statuslist+jwt`. `iss` = yayın kökü, `sub` = adres.
- Tazelik: `ttl` 1 saat, `exp` 24 saat; liste her saatlik heartbeat'te yeniden imzalanır, durum değişince hemen.
- **İndeks kuralı:** her sertifika içeriğine (yayın zamanı, bitiş ve `status` hariç) göre tanınır. Aynı yol ve aynı içerik
  yeniden yayımlandığında aynı indeksi korur (aynı sertifikanın yeniden imzalanması); içerik değişirse ya da bitiş kısalırsa
  yeni rastgele indeks alır ve eski indeks iptal edilir. İptal edilen indeks bir daha kullanılmaz. Durum kaydı yayın klasöründe
  kalıcıdır (`wrprc-status.json`; kurum ve kullanım yolları, indeks, durum, iptal nedeni — kişisel veri yok).
- Yakın alan biçimi (`rc-wrp+cwt`) aynı yükü, dolayısıyla aynı `status` girdisini taşır.

## K4 — İptal

- **Otomatik** (her yayında, REV-6.2.3.9-04/07): kayıt ya da kullanım sona erdi, askıya alındı, iptal edildi ya da listeden
  kalktı → `registration_ended`; içerik değişti → `superseded`.
- **Elle** (REV-6.2.3.9-05/06): yayıncı komutu `wrprc-revoke <sertifika yolu> --reason <gerekçe>`. Gerekçe zorunludur ve serbest
  metindir. Elle iptal edilen içerik, değişmeden yeniden verilmez. İptal isteği yalnız kayıt kurumundan, doğrulayıcının ya da
  belge verenin kendisinden (yetkili temsilcisi dâhil) veya yetkili bir kamu makamından (ör. veri koruma kurumu) kabul edilir
  (REG-6.2.2.3-05); istek, kaydı değiştirme yetkisiyle aynı yoldan doğrulanır (REG-6.2.2.3-06).
- Her iptal, yayıncının herkese açık değişiklik kaydına indeks, yol ve nedenle yazılır. İsteyenin kimliği ve doğrulama kaydı
  operatörün iç kayıtlarında tutulur (REG-6.2.2.3-07); herkese açık gerekçeye kişi adı yazılmaz.

## K5 — Cüzdan çekirdeği

- `wallet-core` sertifikadaki `status` girdisinin listesini çeker; listeyi imzalayan sertifika LOTL'deki kayıt kurumu
  anahtarlarından biri olmalıdır. Doğrulanan liste önbelleğe yazılır; ağ yoksa süresi (`exp`) dolmamış kopya kullanılır, süresi
  dolmuş kopya kullanılmaz.
- **İptal → ret.** İptal edilmiş kayıt sertifikası taşıyan istek geçersizdir; cüzdan veri göndermez ([[ADR-0026]] WRC4). Belge
  veren metadata'sındaki sertifika iptal edilmişse belge istenmez (ARF §6.6.3.3).
- **Denetlenemedi → uyarı.** Liste alınamadı, doğrulanamadı ya da durum verilmedi: sonuç geçerli kalır ama
  `registration_status_unknown` işareti taşır; onay ekranı uyarır (ARF RPRC_17). Güvenli varsayılan: durumlar verilmezse işaret
  konur.
- Bozuk `status` ya da bozuk `policy_id` taşıyan sertifika geçersizdir. `policy_id` kabul edilir ama belirli bir değer
  aranmaz (başka kayıt kurumları kendi politikalarını taşır). Durum alanı olmayan sertifika (durum listesi tutmayan kayıt kurumu)
  bugün uyarısız kabul edilir.

## K6 — Yayılım

- Sandbox: bugün açık (kayıt defteri ayarı, durum listesi, nginx yanıt türü).
- Gerçek ağ: K1'deki adlar onaylanınca kayıt defteri ayarı eklenir. Değişiklik geriye dönük güvenlidir: eski cüzdanlar yeni
  alanları yok sayar; ayar eklenmeden gerçek ağın sertifikaları değişmez.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kısa geçerlilikle yetinmek, iptal listesi yok | ret | TS 119 475 ve ARF RPRC_01a iptali ister; sıkı AB cüzdanları `status`'suz sertifikayı reddeder |
| Ayrı durum listesi anahtarı | ret (bugün) | Yeni anahtar, yeni LOTL alanı ve ayrı bildirim; kazanç yok: iki anahtar da aynı yerde, yalnız yayıncıda |
| Her yayında her sertifikaya yeni indeks | ret | Liste her yayında büyür; aynı içeriğin iptali bir şey korumaz. İçerik değişince yeni indeks yeterli |
| 2 bitlik liste (askı) | ret | ETSI yalnız geçerli/iptal tanımlar; askıya alınan kayıt iptal edilir (REV-6.2.3.9-04) |
| Denetlenemeyen durumda ret | ret (bugün) | Çevrimdışı ve yakın alanda gereksiz ret; ARF uyarı ister. İptal kesin ret olarak kalır |
| Doğrulayıcı isteğine `registrar_dataset` | ret | AB Uygulama Tüzüğü 2026/1731 RO-02…RO-12'yi kaldırdı; [[ADR-0026]] 2026-10-13 değişikliği "kullanılmaz" der |
| **Kendi OID + politika belgesi + kayıt kurumu anahtarıyla 1 bitlik durum listesi** | **seçildi** | Standardın üç alanı, ek anahtar yok, cüzdanda iptal kesin ret |

# Değişmezler

| Kod | Kural |
|---|---|
| WRS1 | Kayıt sertifikası Tamga'nın kendi politika OID'ini ve politika belgesinin adresini taşır; ETSI'nin AB politika OID'i (`0.4.0.19475.3.1`) Tamga sertifikasına yazılmaz. |
| WRS2 | Kayıt kurumu kayıt sertifikaları için herkese açık, imzalı, 1 bitlik bir Token Status List yayımlar; liste LOTL'deki kayıt kurumu anahtarıyla imzalanır ve en geç 24 saatte bir yeniden imzalanır. |
| WRS3 | Kayıt ya da kullanım sona erince, askıya alınınca, iptal edilince veya sertifika içeriği değişince eski kayıt sertifikası aynı yayında iptal edilir; iptal edilen indeks yeniden kullanılmaz. |
| WRS4 | Cüzdan iptal edilmiş kayıt sertifikası taşıyan isteğe veri göndermez ve iptal edilmiş sertifikalı belge verenden belge istemez; durum denetlenemezse kişiyi uyarır. |

# Sonuçlar

- `apps/trust-publisher`: `src/wrprc-status.ts` (indeks, iptal, liste imzası), `build`, `heartbeat`, `wrprc-status`,
  `wrprc-revoke`; sandbox kayıt defteri ayarı.
- `@tamga-network/wallet-core`: `fetchRegistrationStatuses`, `registrationStatusRefs`, `MemoryRegistrationStatusCache`;
  `checkRegistrationCerts`, `checkIssuerRegistration`, `checkProximityRegistration`, `relevantRegistrationCerts` durumları
  isteğe bağlı son parametre olarak alır; yakın alanda `registrationStatuses` seçeneği. Paketlerin 0.7.4 sürümünde.
- Belgeler: [[FW-POL-0003]] (yeni), [[FW-TF-0001]] (kayıt sertifikası paragrafı), [[SPEC-TRUST-0001]] (yayın dosyaları).
- Operatör: sandbox nginx'inde `/status/` yanıt türü.
- Sonraki iş: gerçek ağ adları (K1) onaylanınca kayıt defteri ayarı; PEN başvurusu.

# Durum

**Accepted — 2026-10-29** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-REG-4. WRS1–WRS4 bağlayıcıdır.
Gerçek ağın politika kimliği ve adresleri ayrıca onaylanır (K1, K6).
