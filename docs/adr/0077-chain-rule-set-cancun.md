---
document_id: ADR-0077
title: "Zincir Cancun kural setiyle kurulur"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Zincir bugüne kadar Shanghai kural setiyle tasarlanmıştı; kontratlar da o hedefle derleniyordu. Shanghai'de `SELFDESTRUCT` kodu
  siler: `CREATE2` ile dağıtılmış bir implementasyon oylamadan sonra silinip aynı adrese başka kodla yeniden dağıtılabilirdi
  (kontrat denetimi 2026-11-11). Karar: zincir Cancun kural setiyle kurulur (genesis `cancunTime: 0`), kontratlar `cancun` hedefiyle
  derlenir, testler aynı kural setinde koşar. Cancun'da `SELFDESTRUCT` kodu silmez (EIP-6780); yükseltme önerisindeki kod özeti
  denetimi ikinci savunma hattı olarak kalır. Çalışan zincir olmadığı için geçiş (çatal) gerekmez.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
---

# Kısaca

Bir blok zinciri hangi kuralların geçerli olduğunu "kural seti" (hard fork) adıyla belirler. Tamga zinciri Shanghai kural setiyle
tasarlanmıştı. O kural setinde bir kontrat kendini silebilir ve aynı adrese başka bir kod konabilir; bu, oylanmış bir yükseltmenin
arkasından kodun değiştirilmesine kapı aralıyordu. Bir sonraki kural seti olan Cancun bu yolu kapatır. Zincir henüz çalışmadığı
için kural seti bugün bedelsiz seçilir: zincir Cancun ile kurulur.

# Bağlam

- Kontrat denetimi (2026-11-11): yükseltme önerisi bir **adresi** oyluyordu. Shanghai'de `SELFDESTRUCT` hesabın kodunu siler;
  `CREATE2` ile dağıtılmış bir implementasyon 7 günlük bekleme süresinde ([[ADR-0055]] GE1) kendini silip aynı adrese başka kodla
  yeniden dağıtılabilirdi. Düzeltme aynı gün yapıldı: öneri yeni implementasyonun kod özetini sabitler, yürütme karşılaştırır
  (`UpgradeImplementationChanged`, [[SPEC-BC-0001]] §9).
- Aynı sınıfı kökten kapatmanın yolu kural setidir: Cancun'daki EIP-6780 ile `SELFDESTRUCT`, kontrat aynı işlemde oluşturulmadıysa
  kodu ve depolamayı silmez; yalnız bakiyeyi aktarır. Bu soru açık konu olarak kayda geçmişti ([[SPEC-BC-0001]] §14 madde 10).
- Çalışan bir zincir yoktur ([[ADR-0009]] K4); genesis ve kontratlar serbestçe değişebilir. Kural setini zincir kurulduktan sonra
  değiştirmek bütün doğrulayıcı işletmecilerin eşgüdümlü çatalını gerektirirdi.
- Derleme hedefi zincirin kural setini aşamaz: `cancun` hedefiyle derlenen kod Cancun işlem kodlarını (`MCOPY`, geçici depolama)
  kullanabilir ve Shanghai zincirinde çalışmaz. İkisi birlikte değişir.

# Karar

- **K1 — Kural seti.** Zincir Cancun kural setiyle kurulur: genesis `config` içinde `shanghaiTime: 0` ve `cancunTime: 0` (ilk
  bloktan açık). Yerel geliştirme zinciri, test ağı ve gerçek ağ aynı kural setini kullanır.
- **K2 — Derleme ve test.** Kontratlar `evmVersion: cancun` ile derlenir (solc 0.8.24). Kontrat testlerinin koştuğu süreç içi
  ağ da `cancun` kural setindedir; araç varsayılanı daha yeni bir kural seti olsa bile testler zincirle aynı kurallarda koşar.
- **K3 — Blob işlemleri kullanılmaz.** Cancun'un getirdiği blob işlemleri (EIP-4844) bir katman-2 veri yoludur; ağın
  kullanımında yoktur. Ağ blob işlemi göndermez, kontratlar blob'a dayanmaz. Düğüm yazılımı blob alanlarını blok başlığında
  taşır (sıfır değerle); ek yapılandırma gerekmez.
- **K4 — Kod özeti denetimi kalır.** Yükseltme önerisindeki kod özeti denetimi kaldırılmaz: kural seti ileride değişirse ya da
  kod başka bir yoldan değişirse aynı güvenceyi verir. "Oylanan şey koddur" kuralı kural setinden bağımsızdır.
- **K5 — Sonraki kural setleri.** Cancun'dan sonraki bir kural setine geçiş (genesis'te ya da çalışan zincirde) ayrı bir karar
  kaydı ister; düğüm yazılımının varsayılanı izlenmez.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Shanghai'de kalmak, yalnız kod özeti denetimi | ret | Denetim yükseltme yolunu kapatır, ama aynı sınıf (kendini silen ve yeniden dağıtılan kod) başka bir bağlamda yeniden ortaya çıkabilir; kural seti bunu kökten kapatır ve bugün bedeli yoktur |
| **Cancun** | **kabul** | EIP-6780 metamorfik yeniden dağıtımı kapatır; düğüm yazılımı ve derleyici yıllardır destekliyor; yerelde tek doğrulayıcılı QBFT ağında denendi |
| Daha yeni bir kural seti (Prague ve sonrası) | şimdilik ret | Hesap kodu devri (EIP-7702) gibi yeni yüzeyler getirir; egemenlik denetimi adres temellidir, etkisi ayrıca incelenmeden açılmaz (K5) |

# Değişmezler

| Kod | Kural |
|---|---|
| CR1 | Zincirin kural seti genesis'te açıkça yazılır ve ilk bloktan Cancun'dur (`shanghaiTime: 0`, `cancunTime: 0`); yerel geliştirme zinciri, test ağı ve gerçek ağ aynı kural setini kullanır. Başka bir kural setine geçiş yeni bir karar kaydı ister. |
| CR2 | Kontratların derleme hedefi ve kontrat testlerinin koştuğu ağın kural seti, zincirin kural setiyle aynıdır (`cancun`). |
| CR3 | Yükseltme önerisi yeni implementasyonun kod özetini sabitler ve yürütmede karşılaştırır; bu denetim kural setinden bağımsız olarak kalır. |

# Sonuçlar

- Kod: `contracts/hardhat.config.ts` (`evmVersion: cancun`, süreç içi ağ `hardfork: cancun`), `contracts/scripts/export-abi.mjs`,
  `contracts/slither.config.json`; genesis üreticileri `scripts/besu-dev.ps1` (tek doğrulayıcılı ve izinli kip) ve
  `network/testnet/make-network.sh`. Daha önce üretilmiş yerel genesis dosyaları Shanghai'dir: yerel zincir yeniden kurulur
  (genesis silinir, yeniden üretilir, zincir verisi sıfırlanır).
- Testler: kod özeti denetimi Cancun'da test düğümünün kod değiştirme kancasıyla sınanır; ayrı bir test, kendini "silen"
  implementasyonun kodunun yerinde kaldığını ve aynı adrese yeniden dağıtımın düştüğünü gösterir
  (`contracts/test/review-2026-11-11-governance.test.ts`).
- Depolama düzeni değişmedi; çalışma kodu boyutları birkaç bayt oynadı, EIP-170 payı korunuyor (`contracts:check`).
- Doğrulama: yerelde tek doğrulayıcılı QBFT ağı (Besu 26.11.0) `cancunTime: 0` ile kuruldu, blok üretti, kontratlar dağıtıldı;
  Cancun işlem kodları (`MCOPY`, `TSTORE`/`TLOAD`, `BLOBBASEFEE`) çalıştı, blok başlığı blob alanlarını sıfır değerle taşıdı. KZG
  kurulumu için ek seçenek gerekmedi. Çok düğümlü ağ CI test ağı iş akışında (`testnet.yml`) doğrulanır.
- Belgeler: [[SPEC-BC-0001]] §9 ve §14 madde 10 (kapandı), [[ARCH-0002]], [[GUIDE-0018]].

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-NET-7. CR1–CR3 bağlayıcıdır.
