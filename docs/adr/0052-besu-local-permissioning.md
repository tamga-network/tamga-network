---
document_id: ADR-0052
title: "Besu yerel izinlendirme"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Hyperledger Besu 25.6.0 zincir üstü izinlendirmeyi ve Tessera tabanlı gizliliği kaldırdı (24.12'de kullanımdan kalkmıştı).
  Zincir açıldığında hangi düğümün bağlanabileceği ve hangi hesabın işlem gönderebileceği her validator ve RPC düğümündeki yerel
  `permissions_config.toml` dosyasıyla (düğüm ve hesap izin listesi) belirlenir. Liste elle yazılmaz: zincirdeki kontrat durumundan
  (Governance, IssuerRegistry, TrustListAnchorRegistry) türetilir; her işletmeci dosyayı kendisi üretir ve uygular, bütün
  validator'lar aynı listeyi taşır, fark denetlenir (`trust:chain-permissions`). Yazma yetkisinin asıl denetimi kontratlarda kalır
  (namespace, delege, yazıcı eşiği). Düğümün JSON-RPC ucu internete açılmaz; dış erişim mTLS'li ters vekil arkasından. SPEC-BC-0001
  §12.1 ile ARCH-0001 ve ARCH-0002'deki zincir üstü izin kontratı varsayımının yerine geçer; hiçbir ADR kararı değişmez.
  Kabul: 2026-10-19.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[ARCH-0001]]", "[[ARCH-0002]]", "[[PM-BC-0001]]", "[[PM-TRUST-0001]]"]
---

# Kısaca

Zincir izinli bir ağdır: yalnız onaylı düğümler bağlanır, yalnız onaylı hesaplar işlem gönderir. Belgelerimiz bunu Besu'nun
zincir üstü izin kontratıyla yapmayı öngörüyordu; Besu bu özelliği 25.6.0'da kaldırdı. Bu karar yerine Besu'nun kalan yolunu
seçer: her düğümde aynı izin dosyası. Dosyayı kimse elle yazmaz; zincirin kendi kaydından üretilir, böylece "kim izinli" sorusunun
tek cevabı yine zincirdeki yönetişimdir.

# Bağlam

- [[ADR-0001]] ağı **izinli**, bağımsız bir Besu/QBFT ağı olarak kurar; izin mekanizmasını seçmez. Mekanizma yalnız şartname ve
  mimari belgelerinde yazılıydı: [[SPEC-BC-0001]] §12.1 ("Hesap izni — Besu onchain permissioning — yalnızca kayıtlı delegate
  anahtarları işlem gönderebilir"), [[ARCH-0001]] §6 ("Node/hesap permissioning (allowlist kontratı)"), [[ARCH-0002]] §6
  ("on-chain permissioning kontratı tercih edilir"), güvenlik notu ("permissioning kontratının yönetim anahtarı çoklu imza") ve
  açık konu 3 ("öneri: on-chain, yönetilebilir"). Bunu bağlayan bir ADR yoktur.
- Besu 24.12'de zincir üstü izinlendirmeyi ve Tessera tabanlı gizliliği kullanımdan kaldırdı; **25.6.0'da ikisi de kaldırıldı**
  (sürüm notu, "Sunset features"). Kalan mekanizma **yerel izinlendirme**dir: her düğümün veri klasöründe `permissions_config.toml`,
  içinde `nodes-allowlist` (enode adresleri) ve `accounts-allowlist` (hesap adresleri); açılış bayrakları
  `--permissions-nodes-config-file-enabled` ve `--permissions-accounts-config-file-enabled`; çalışırken `perm_*` JSON-RPC
  yöntemleriyle ya da dosya düzenlenip `perm_reloadPermissionsFromFile` ile güncellenir.
- Besu belgesine göre yerel hesap kuralları **başka düğümlerin ürettiği bloklarda uygulanmaz** ve listelerin bütün düğümlerde aynı
  olması önerilir ama zorlanmaz. Bir validator listesi farklıysa, onun ürettiği blok diğerlerinin reddedeceği hesaptan işlem
  taşıyabilir. Yani tutarlılık işletmecilerin işidir.
- Zincir bugün yoktur ([[ADR-0009]] K4); zincir imzalı listelerin projeksiyonudur ([[ADR-0051]]). Karar, Faz 0 hazırlığından önce
  belgelerin gerçek Besu'ya uyması içindir. Gizlilik grupları (Tessera) tasarımda hiç kullanılmadı ve gerekmez: zincire kişisel
  veri, belge ya da belge özeti girmez ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1).
- Proje yönetimi 2026-10-19'da yönü verdi: bulgu bütün belgelere işlenir, eski varsayım yaşayan belgelerden kaldırılır.

# Karar

## K1 — Yerel izinlendirme

Her validator ve her RPC/full düğümü düğüm ve hesap izinlendirmesini yerel `permissions_config.toml` ile açar (iki bayrak da
açık). Zincir üstü izin kontratı yazılmaz ve kullanılmaz. Tessera ve gizlilik grupları kullanılmaz (Besu'da yok; tasarımda gerek
yok).

## K2 — Tek doğruluk kaynağı: zincirin kendi durumu

İzin listeleri elle yazılmaz; zincirdeki kontrat durumundan türetilir:

| Liste | İçerik | Kaynak |
|---|---|---|
| Hesap | Aktif üye devletlerin validator adresleri | `Governance` (kabul, çıkarma, çekilme) |
| Hesap | Aktif üye devletlerin delege anahtarları | `Governance.delegateKeysOf` |
| Hesap | Çalışır durumdaki kurumların delege anahtarları (iptal listesi çapası yayını) | `IssuerRegistry` |
| Hesap | Liste çapası yazıcıları | `TrustListAnchorRegistry` ([[ADR-0051]] K3) |
| Düğüm | Validator düğümleri: enode kimliğinden türeyen adres `Governance`'ta aktif bir validator adresidir | `Governance` + işletmecinin düğüm bildirimi (yalnız `host:port`) |
| Düğüm | İşletmecinin kendi RPC/full düğümleri | Yalnız o işletmecinin düğümlerinin dosyasında; diğer işletmecilerin listesine girmez |

- Bir hesabın eklenmesi ya da çıkarılması zincirdeki ilgili işlemdir (Governance oyu, devletin kendi namespace'i, yazıcı kümesi);
  izin dosyası onu izler. Governance'ta aktif olmayan validator ya da hiçbir kontratta yetkisi olmayan hesap listeye girmez.
- Validator düğümlerinin ağ adresi (`host:port`) zincire yazılmaz (altyapı bilgisi; kontrat ABI'sinde serbest metin yok). İşletmeci
  bildirimi ağ yapılandırmasında (`network/permissions/`) durur; araç her enode'un Governance'taki validator adresine denk
  geldiğini denetler, denk gelmeyeni reddeder. Yanlış adres yalnız bağlantıyı bozar, yetki vermez.
- Başlangıç: genesis'teki kurucu validator'lar (`extraData`) ve dağıtım hesabı ilk dosyayı oluşturur; kontratlar kurulup
  Governance başlatılınca dosya zincirden yeniden üretilir ve dağıtım hesabı listeden çıkar.

## K3 — Araç ve tutarlılık denetimi

- `trust:chain-permissions` (liste yayıncısında, zincir komutlarının yanında): `render` zincir durumunu okur, belirleyici
  (sıralı, tekrarsız) bir `permissions_config.toml` üretir ve dosyanın sha256 özetini basar; `check` bir düğümün yürürlükteki
  listelerini (`perm_getNodesAllowlist`, `perm_getAccountsAllowlist`; düğümün yerel yönetim ucundan) üretilen dosyayla karşılaştırır
  ve farkı raporlar.
- Her işletmeci dosyayı **kendisi** üretir ve kendi düğümlerine uygular; başkasının dosyasını kopyalamaz. İşletmeciler özetleri
  karşılaştırır; validator'lar arasında fark işletme olayıdır ve giderilene kadar raporlanır.
- Kontratlarda bugün bu kümeleri sayan okuma görünümleri yoktur (üye listesi, yazıcı listesi, kurum delege listesi); araçla birlikte
  eklenir ([[SPEC-BC-0001]] sürüm notuyla). Araç Faz 0 hazırlığı işidir; Besu geliştirme ağı ve indeksleyiciyle ([[ADR-0051]] açık
  konu 4) birlikte yazılır.

## K4 — Yetki kontratlarda kalır

Yazma yetkisinin asıl denetimi kontratlardadır: namespace (`onlyOwnerState`, [[SPEC-BC-0001]]/N1), devlet ve kurum delegeleri
(R1, R2), Governance 2/3 oyu, liste çapası yazıcı eşiği ([[ADR-0051]]/CH3). İzin listesi ikinci savunma hattıdır (bilinmeyen
hesap, spam, kaynak tüketimi; gaz ücretsizdir, GA1). İzin listesindeki bir hata kontrat yetkisini genişletmez.

## K5 — RPC dışarı açılmaz

- Düğümün JSON-RPC ve WebSocket uçları (8545/8546) yalnız düğümün iç ağında dinler. Dış erişim nginx (ya da eşdeğeri) ters vekil
  arkasından, **karşılıklı TLS (mTLS)** ile ve yalnız tanımlı istemcilere (liste yayıncısı, indeksleyici, doğrulayıcı okuma yolu)
  açılır; dışarıya yalnız okuma ve işlem gönderme ad alanları (`ETH`, `NET`, `WEB3`) verilir.
- `PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` ad alanları yalnız düğümün kendisinden (localhost) kullanılır.
- P2P portu (30303) güvenlik duvarında yalnız izin listesindeki eşlere açıktır; düğüm izin listesi ikinci katmandır.

## K6 — Yerine geçtiği

[[SPEC-BC-0001]] §12.1 "Besu onchain permissioning" satırı; [[ARCH-0001]] §6 "allowlist kontratı"; [[ARCH-0002]] §6 "on-chain
permissioning kontratı tercih edilir", güvenlik notundaki "permissioning kontratının yönetim anahtarı" ve açık konu 3. Bu ifadeler
yaşayan belgelerden kaldırılır. Hiçbir ADR kararı değişmez: [[ADR-0001]]'in izinli ağ kararı aynen geçerlidir, değişen yalnız
mekanizmadır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Besu'yu 25.6 öncesi bir sürümde sabitlemek | ret | Kaldırılmış özelliğe bağlanmak güvenlik güncellemelerini durdurur |
| Kendi izin kurallarımızı Besu eklentisiyle (plugin) yazmak | ret (şimdilik) | Ayrı bir Java kod tabanı, denetim ve sürüm yükü; yetki zaten kontratlarda. Devlet sayısı büyürse yeniden bakılır |
| Depoda elle tutulan ortak izin dosyası | ret | İkinci doğruluk kaynağı; Governance ile ayrışabilir |
| İşletmecilerin imzaladığı ayrı bir operatör listesi | ret | Onaylı küme zaten Governance'ta; aynı bilgiyi ikinci yerde tutmak ayrışma riski getirir |
| Hesap izni yok, yalnız kontrat yetkisi | ret | Gaz ücretsizken herkes işlem gönderebilir; spam ve kaynak tüketimi |
| Tessera gizlilik grupları | ret | Besu'dan kaldırıldı; zincirde kişisel veri yok (DP1) |

# Değişmezler

| Kod | Kural |
|---|---|
| LP1 | Zincir düğümlerinde izinlendirme yereldir (`permissions_config.toml`, düğüm ve hesap izin listesi açık); zincir üstü izin kontratı ve Tessera gizlilik grupları kullanılmaz. |
| LP2 | İzin listeleri zincirdeki kontrat durumundan türetilir; Governance'ta aktif olmayan validator ya da hiçbir kontratta yetkisi olmayan hesap listeye girmez; elle ekleme yoktur. |
| LP3 | Bütün validator'lar aynı hesap listesini ve aynı validator düğüm listesini taşır; fark işletme olayıdır ve giderilene kadar raporlanır. |
| LP4 | Yazma yetkisi kontratlarda denetlenir; izin listesi bu yetkiyi genişletmez ve onun yerine geçmez. |
| LP5 | Düğümün JSON-RPC ucu internete açılmaz; dış erişim yalnız mTLS'li ters vekil arkasından ve okuma/işlem ad alanlarıyla; `PERM`, `ADMIN`, `QBFT` yalnız yerelden. |

# Sonuçlar

- [[SPEC-BC-0001]] §12.1 ve §15 sürüm notu; [[ARCH-0001]] §6; [[ARCH-0002]] §6, güvenlik notları, açık konu 3 kapandı; `network/README.md`
  planlı yapı (`permissions/`).
- Faz 0 hazırlığı işleri: `trust:chain-permissions` (render + check), kontratlara küme okuma görünümleri, ters vekil + mTLS yapılandırması,
  Besu geliştirme ağında yerel izinlendirmenin denenmesi.
- Değişmeyen kararlar: D-BC-0 (Besu/QBFT), D-BC-6 (zincir eşiği), D-BC-7 (zincir projeksiyonu), D-TRUST-0, D-GOV-0.

# Durum

**Accepted — 2026-10-19.** Proje yönetimi onayıyla. DECISIONS: D-NET-6. Yerine geçtiği: [[SPEC-BC-0001]] §12.1, [[ARCH-0001]] §6,
[[ARCH-0002]] §6 ve açık konu 3 (zincir üstü izin kontratı varsayımı); hiçbir ADR'nin yerini almaz.
