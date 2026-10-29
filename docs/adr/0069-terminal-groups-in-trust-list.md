---
document_id: ADR-0069
title: "Kapı grupları güven listesinde: kurum, politika, sertifika; terminal anahtarı kurum adına"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  ADR-0012 K5'in öngördüğü `terminal_groups[]` alanı doğrulayıcı kaydında biçimlenir: her kapı grubu `group_id`, `institution_id`
  (kapıları işleten kurum), `label`, `allowed_policies[]`, isteğe bağlı `cert_fingerprints[]` ve `offline_allowed` ile geçerlilik
  aralığını taşır. Tamga Verify grubun kurumunu imzalı listeden okur: terminal anahtarını yalnız o kurum adına verir, kurum
  yalnız kendi gruplarının anahtarlarını görür ve iptal eder (Kurum Konsolu, kuruma daraltılmış belirteçle); listede geri
  çekilen grubun anahtarı kapıda geçmez. Sertifikalı kapı kimliği için alan ve okuyucu hazırdır, kapılar bugün terminal
  anahtarıyla gelir (ADR-0065). Kabul: 2026-10-29 (ADR-0065'i tamamlama genel onayı).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0038]]", "[[ADR-0065]]", "[[SPEC-TRUST-0001]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
---

# Kısaca

Bir kapı grubunun (ör. bir etkinlik firmasının bilet kapıları) hangi kuruma ait olduğu artık imzalı güven listesinde yazar.
Tamga Verify bu bilgiyle kapı anahtarlarını kurum kurum ayırır: her kurum Kurum Konsolu'ndan yalnız kendi kapılarının
anahtarlarını oluşturur, görür ve iptal eder. Liste bir grubu geri çekerse o grubun kapıları hemen durur. Kapı cihazının
sertifikayla kendini tanıtması için gereken alan da listede hazırdır; o yol kapı yazılımı hazır olunca açılır.

# Bağlam

- [[ADR-0012]] K5: terminal yalnız kayıtlı bir doğrulayıcının altında tanımlanır; `relying_parties[]` kaydına `terminal_groups[]`
  (grup kimliği, sertifika parmak izi, çevrim dışı izni) eklenir ([[SPEC-TRUST-0001]] küçük sürüm). Alan kayıt defterlerinde
  `group_id`, `label`, `offline_allowed`, `valid_from`, `valid_until` ile kullanılıyordu, ama yükleyicinin şemasında ve
  şartnamede yoktu ve grubun hangi kuruma ait olduğunu söylemiyordu.
- [[ADR-0065]]: kapılar Tamga Verify'a terminal anahtarıyla kimlik gösterir; anahtarları işletmeci yönetici ucundan verir. K2
  Kurum Konsolu ekranını, K5 `terminal_groups[]`'in liste şemasına girmesini sonraki adım sayar.
- Barındırılan Tamga Verify birçok kurumun kapısına hizmet eder: tek doğrulayıcı kaydının altında farklı kurumların grupları
  vardır (sandbox'ta kampüs turnikesi, bilet kapısı, sinema kapısı). Kurum kendi kapılarını yönetecekse doğrulayıcının grubun
  kurumunu güvenilir bir kaynaktan bilmesi gerekir; bu kaynak imzalı listedir.
- Proje yönetiminin yönü: ADR-0065'in açık bıraktığı iki iş tamamlanır; kapanmış bir şema kararı değişirse ADR ile.

# Karar

## K1 — Alan kümesi
Doğrulayıcı kaydının `terminal_groups[]` öğesi:

| Alan | Zorunlu | Anlamı |
|---|---|---|
| `group_id` | evet | Grup kimliği (`[a-z0-9-]{1,40}`); kapı politikasındaki `terminal_group` ile aynı. Bütün listede tektir. |
| `institution_id` | etkin grupta evet | Grubun kapılarını işleten kurum: aynı listedeki belge verenin `slug`'ı ya da bir doğrulayıcının `dns_name`'i (sertifika yenilemesinden etkilenmeyen kalıcı kimlikler). |
| `label` | hayır | İnsan için ad. |
| `allowed_policies[]` | etkin grupta evet (en az bir) | Grubun kapılarının hizmet ettiği kapı politikaları (`policy_id`). |
| `cert_fingerprints[]` | hayır | Kapı cihazı sertifikalarının SHA-256 parmak izleri (onaltılık, küçük harf); bir parmak izi tek grupta. |
| `offline_allowed` | hayır | Çevrim dışı kapı izni ([[ADR-0012]] K3 riski kabul edilmişse). |
| `valid_from`, `valid_until` | `valid_from` evet | Geçerlilik; `valid_until` geçmiş grup geri çekilmiştir ve tarih için listede kalır. |

ADR-0012 K5'teki "sertifika parmak izi" bir dizi olur (bir grupta birden çok cihaz); kurum, politika ve geçerlilik alanları eklenir.

## K2 — Yayıncı denetimi
Liste yayıncısı her yayında grupları denetler: biçim, bütün listede tek `group_id`, etkin grupta listede bulunan bir kurum ve en
az bir politika, iki grupta aynı sertifika parmak izi yok. Hata varsa yayın durur. Geri çekilmiş grup eski biçimiyle kalabilir
(gerçek ağdaki iki eski grup böyledir; değişmez).

## K3 — Doğrulayıcı listeyi okur
`TrustSource` grubu döndürür (`terminalGroup`): grup kaydı, bağlı olduğu doğrulayıcının `dns_name`'i ve şu an etkin olup
olmadığı (doğrulayıcı ACTIVE ve grup geçerlilik aralığında). Liste bayatsa cevap yoktur (BT5). Liste dosyasını başka bir yer
yorumlamaz (BT4).

## K4 — Terminal anahtarı kurum adına
- Tamga Verify anahtarı verirken grubun listedeki kurumunu kayda yazar; liste grubun politikalarından hiçbirine izin vermiyorsa
  ya da grup geri çekilmişse anahtar verilmez.
- Yönetici uçları iki çağıranı tanır: işletmeci (yönetici belirteci, bütün anahtarlar) ve **kurum** — kuruma daraltılmış belirteç
  `base64url(HMAC-SHA256(yönetici belirteci, "tamga-terminal-keys/v1:" + kurum))`, `x-tamga-institution` ve `x-institution-token`
  başlıklarıyla. Kurum yalnız listede kendisine bağlı etkin grubun anahtarını alır, yalnız kendi anahtarlarını görür ve iptal
  eder; başka kurumun anahtarı yokmuş gibi davranılır (404).
- Kurum Konsolu bu uçları sunucu tarafında, oturumdaki kurumun belirteciyle çağırır ("Kapı terminalleri" ekranı, yalnız yönetici):
  liste (etiket, grup, oluşturulma, son kullanım, durum), yeni anahtar (bir kez gösterilir, kopyala düğmesi) ve onaylı iptal.
  Konsolun denetim kaydına anahtar kimliği ve grup yazılır; anahtar hiçbir yere yazılmaz. Uçlar dışa kapalıdır (iç adres).
- Listede grup yoksa [[ADR-0065]] yolu aynen sürer: anahtarı yalnız işletmeci verir.

## K5 — Kapıda liste denetimi
`POST /terminal/verify`'da anahtar doğrulandıktan sonra grup listede geri çekilmişse ya da anahtarın kurumu listedeki kurumdan
farklıysa istek 403 alır ve jetona dokunulmaz. Böylece bir kurumun kaydı ya da kapı grubu listeden çıkınca kapıları da durur.

## K6 — Sertifikalı kapı hazırlığı
`cert_fingerprints[]` ve `TrustSource.terminalGroupByCertFingerprint` sertifikalı kapı kimliği (karşılıklı TLS ya da imzalı kapı
isteği) ve çevrim dışı kapılar içindir. Bugün hiçbir kapı sertifikayla gelmez; yol kapı yazılımı ve sertifika dağıtımı hazır
olunca ayrı bir değişiklikle açılır ([[ADR-0065]] K5 hedefi).

## K7 — Sandbox
Sandbox listesinde üç örnek kurumun grubu kurumu ve politikasıyla yayımlanır (`istanbul-bilgi-campus` → `istanbul-bilgi`,
`campus-access`; `bubilet-gate` → `bubilet`, `event-ticket`; `paribu-cineverse-gate` → `paribu-cineverse`, `event-ticket`).
Deneme kapısının herkese açık ortam anahtarları çalışmaya devam eder ([[ADR-0065]] K4).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Grubun kurumunu yalnız Kurum Konsolu'nun kiracı ayarında tutmak | ret | Doğrulayıcı kurumu bilmez; konsoldaki bir hata başka kurumun anahtarını açar; yayımlanmış, imzalı bir kaynak yok |
| Kurum başına ayrı, elle dağıtılan yönetici belirteci | ret | Her kurum için sunucuda ayrı sır; işletim yükü; aynı güvenliği türetilmiş belirteç verir |
| **Liste kurumu söyler; kuruma daraltılmış türetilmiş belirteç** | **seçildi** | Tek kaynak imzalı liste; doğrulayıcı da konsol da kurumu ayrı ayrı denetler; yeni sır yok |
| Grupları ayrı bir liste türüne taşımak | ret | Gereksiz yeni biçim; ADR-0012 K5 grubu doğrulayıcı kaydının altına koyar |

# Değişmezler

| Kod | Kural |
|---|---|
| TG1 | Kapı grubu doğrulayıcı kaydının `terminal_groups[]` öğesidir; `group_id` bütün listede tektir; etkin grup listede bulunan bir kuruma (`institution_id`) ve en az bir kapı politikasına bağlıdır; yayıncı bu koşulu sağlamayan grupla yayın yapmaz. |
| TG2 | Kurum adına terminal anahtarı yönetimi kuruma daraltılmış belirteçle yapılır: kurum yalnız imzalı listede kendisine bağlı etkin grubun anahtarını alır, yalnız kendi anahtarlarını görür ve iptal eder; anahtar kaydı grubun kurumunu taşır; anahtarın kendisi yalnız verildiği yanıtta görünür. |
| TG3 | Listede geri çekilmiş grubun ya da kurumu değişmiş grubun anahtarı kapıda geçmez (403, jetona dokunulmaz) ve bu gruba anahtar verilmez; grup listede yoksa [[ADR-0065]] TK1–TK3 geçerlidir. |

# Sonuçlar

- Kod: `@tamga-network/trust` (`TerminalGroup` şeması, `RelyingParty.terminal_groups`, `TrustSource.terminalGroup` /
  `terminalGroupByCertFingerprint`); liste yayıncısı (`terminal-groups.ts` denetimi; sandbox ve test kayıt defterleri);
  `apps/verify` (`terminal-keys.ts` kurum ve son kullanım, `institutionToken`; `routes/terminal.ts` kuruma daraltılmış uçlar ve
  kapıda liste denetimi); Kurum Konsolu "Kapı terminalleri" ekranı (operatör deposu).
- Belgeler: [[SPEC-TRUST-0001]] §4 (doğrulayıcı kaydı), [[SPEC-API-0001]] §6.4, güven listesi API tanımı, doğrulayıcı kayıt
  rehberi ve sandbox rehberi §6, [[FW-RB-0006]] §4.3; [[ADR-0065]] K2 ve K5 bu kararla tamamlandı.
- Paketler: kaynak 0.7.4 (yeni okuyucu isteğe bağlı; eski listeler yüklenmeye devam eder).
- **Uygulama notu (0.7.4, 2026-10-29):** TG3 kapalı kalacak biçimde uygulanır. "Liste bayat" ile "grup listede yok" ayrılır
  (`freshness().healthy`): kuruma bağlı anahtar ya da listede bir kez görülmüş grup listede doğrulanamazsa kapıda 403, yeni
  anahtar verilmez. Grup listesizken işletmecinin verdiği sahipsiz anahtar, grup listeye girince grubun kurumuna bağlanır.
  `allowed_policies` kapıda da denetlenir: geçiş kartı politikasının kimliğini taşır; izinli olmayan politikanın kartı tüketilmeden
  reddedilir.

# Durum

**Accepted — 2026-10-29.** Proje yönetiminin [[ADR-0065]]'i tamamlama genel onayıyla (birebir alıntı özel onay kaydında).
DECISIONS: D-PROX-3. TG1–TG3 bağlayıcıdır.
