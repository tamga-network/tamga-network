---
document_id: ADR-0003
title: "Değer katmanı kancaları"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  [[PM-AUTH-0001]] stratejisi uyarınca, değer/ödeme/agent kapısını AÇIK tutmak için
  BUGÜN alınması gereken beş bağlayıcı mimari karar. Hepsi bugün neredeyse sıfır
  maliyetli, sonradan alınırsa tüm kullanıcı tabanının göçünü gerektirir. (1) Vatandaş/
  kurum zincir hesabı baştan AKILLI KONTRAT CÜZDANI (EOA değil); (2) anahtar alanları
  kesin ayrık — kimlik/varlık/agent — ve VARLIK kurtarması kimlik escrow'undan ayrı,
  KULLANICI-SEÇİMLİ kurtarıcılarla (zorunlu devlet değil); (3) delegasyon kayıt defteri
  kapsam-genel (scope-generic); (4) credential-gating genel bir kontrat primitifi;
  (5) kendi token yok, ama token standardı yasak değil — ihraç FINANCE belge veren izin
  listesine bağlı. Bu kararlar contracts/ implementasyonuna bağlayıcı kısıttır.
domain: Governance
---

# ADR-0003 — Değer Katmanı Kancaları

**Durum:** Accepted
**Tarih:** 2026-08-06
**Karar veren:** Tamga Network proje yönetimi
**Kaynak:** `docs/tamga-network-varlik-katmani-strateji.md` §4 +
`docs/tamga-network-cuzdan-odeme-agent.md` §2, §4 (stratejik girdi
taslakları). Strateji gerekçesi → [[PM-AUTH-0001]].

---

# Bağlam

[[PM-AUTH-0001]] kararı: Tamga bir **yetkilendirme katmanıdır**, mutabakat katmanı
değil; ve kısa vadede hiçbir ödeme özelliği inşa edilmez. Ancak değer/ödeme/agent
kapısını ileride açabilmek, **bugün alınacak birkaç mimari karara** bağlıdır. Bu
kararların ortak özelliği: **bugün neredeyse sıfır maliyetli, sonradan pratikte
imkânsız** (tüm kullanıcı tabanını yeni hesaplara göç ettirmek gerekir). Bu yüzden
`contracts/` Solidity yazılmadan **önce** sabitlenmeleri zorunludur.

Bu ADR, [[ADR-0001]] (Besu/EVM) ve [[ADR-0002]] (egemenlik-öncelikli yönetişim)
üzerine kurulur; değer katmanı, X.509 vs DID kararından ([[DECISIONS]] D-ID-1)
**bağımsızdır** (A katmanı = EVM adresi her hâlükârda vardır).

---

# Karar

## Karar 1 — Zincir hesabı baştan akıllı kontrat cüzdanı (EOA değil)

Vatandaşın/kurumun zincir hesabı, düz anahtar-adres eşlemesi (EOA) değil, bir **kontrat
hesabı** (account abstraction, ERC-4337 tarzı) olmalıdır — bugün yalnızca kimlik
işlemleri yapsa bile.

Bu tek karar şunları sonradan mümkün kılar: kurtarma, harcama limitleri, agent
delegasyonu, gas sponsorluğu, çoklu imza, politika kuralları. Ayrıca **gas
sponsorluğu** kamu hizmeti için zorunludur — vatandaşın "gas token" edinmesi
gerekmemelidir. EOA ile başlanırsa bunların hiçbiri sonradan eklenemez.

**Maliyet bugün:** Bir kontrat deploy etmek. ~sıfır.

## Karar 2 — Anahtar alanlarını kesin ayır + kurtarmayı ayır

Üç ayrı türetme yolu (derivation path), üç ayrı yaşam döngüsü:

```
Kimlik anahtarı  → credential sunumu, pseudonym türetme.   Kurtarılamaz*. Devredilemez.
Varlık anahtarı  → zincir işlemleri, değer transferi.       Kurtarılabilir. Sınırlı devredilebilir.
Agent anahtarı   → delegasyon kapsamında işlem.             Süreli. Anında iptal edilebilir.
```

**Kurtarma ayrımı (bağlayıcı):** Kurtarma mekanizması **yalnızca varlık anahtarına/
hesabına** uygulanır. Kimlik anahtarı ve [[t:credential|belgeler]] bu mekanizmaya **asla** dahil
edilmez — aksi halde "kurtarıcılar" kimliği ele geçirebilir. (*Kimlik/[[t:pseudonym|takma adlar]]
ana tohumdan deterministik yeniden üretilir; belgeler [[t:issuer|belge verenden]] yeniden
talep edilir — bunlar "kurtarma" değil, yeniden türetme/talep.)

**Kurtarıcı kompozisyonu (karar, 2026-08-06):** Varlık cüzdanı kurtarıcıları
**kullanıcı-seçimlidir** (aile/güvenilen kişiler + **isteğe bağlı** kurum), M-of-N
eşik + zaman kilidiyle. **Zorunlu devlet kurumu kurtarıcı DEĞİLDİR** — çünkü bu, tam
da [[PM-AUTH-0001]]'de kaçınılan sansür/kaldıraç paradoksunu paradan içeri geri
sokardı. Varlık kurtarması, kimlik escrow'undan ([[SPEC-BC-0002]] guardian) **ayrı ve
bağımsız** bir mekanizmadır. Somut M-of-N, zaman kilidi süresi ve kötüye-kullanım
senaryoları → PM-ID-0003.

**Maliyet bugün:** Cüzdanda üç türetme yolu. ~bir günlük iş.

## Karar 3 — Delegasyon kayıt defteri kapsam-genel (scope-generic)

Agent delegasyon kontratı bugün yazılır, ama kapsamlar ödeme-dışı tutulur
(`logistics:verify`, `health:read`). `scope` alanı string yerine **genişletilebilir**
tasarlanır; ileride `pay:*` kapsamı eklemek tek satır olur. Ödemeye-özel bir delegasyon
sistemini sonradan yazmak, mevcut tüm delegasyonları geçersiz kılardı.

Delegasyonun değişmez ilkeleri (SPEC-AGENT-0001'de detaylanır): agent'ın kendi kimliği
yok, türetilmiş yetkisi var; **süresiz delegasyon yok** (`validUntil` zorunlu); **anında
[[t:revocation]] (kill switch)** koşulsuz; **sorumluluk velidedir**; her işlem delegasyon
referansıyla loglanır; agent kimlik belgesini **sunamaz** (yalnızca işlemsel yetki).

## Karar 4 — Credential-gating genel bir primitif olsun

"Bu işlemi yapmak için şu belge gerekir" kuralı ödemeye-özel değil, genel bir
kontrat kütüphanesi olmalı:

```solidity
modifier requiresCredential(bytes32 credentialType, bytes calldata proof) { ... }
```

Bugün belge doğrulamasında; yarın "bu transferi ancak KYC'li hesaplar yapabilir"
kuralında **aynı primitif** çalışır. [[SPEC-BC-0001]] StatusList/IssuerRegistry
doğrulamasıyla hizalıdır.

> **Daraltma (2026-09-10, [[SPEC-AGENT-0001]]):** Bu karar **daraltıldı**.
> [[ADR-0008]] ile iptal listesi zincir dışına çıktığından zincir bir
> belgenin geçerliliğini göremez; bu yüzden **Faz 0'da zincir üstü
> credential-gating yoktur** ve `requiresCredential` bir zincir primitifi
> olarak yazılmaz. Doğrulama off-chain'de ([[SPEC-API-0001]]) yapılır. Gelecek
> açılma yolu (kayıtlı [[t:verifier|doğrulayıcının]] imzalı beyanı + tazelik + [[t:nonce]]) tasarım
> olarak [[SPEC-AGENT-0001]] §4'te kayıtlıdır. Karar 3 (delegasyon) etkilenmez.

## Karar 5 — Kendi token'ını çıkarma, ama token standardını yasaklama

Yönetişim ve teknik mimaride Tamga'nın **kendi para birimi olmadığı** açıkça
belirtilir (merkez bankası ilişkisini baştan doğru kurar). Ama zincir seviyesinde
ERC-20 dağıtımı **yasaklanmaz** — ileride bir merkez bankası/lisanslı banka tokenize
mevduatını buraya ihraç etmek isteyebilir; o zaman Tamga **ihraççı değil, ev
sahibi** olur.

**Kısıt:** Token ihraç yetkisi bir **izin listesine** bağlanır — yalnızca Issuer
Registry'de `FINANCE` kategorisinde, ilgili devletin yetkilendirdiği kurumlar
([[ADR-0002]] `onlyOwnerState` + [[SPEC-BC-0001]] IssuerCategory). Bu, izinsiz token
spam'ini engeller ve düzenleyicilere güven verir.

---

# Gerekçe

- **Geri döndürülemezlik asimetrisi:** Beş kararın maliyeti bugün ~sıfır; sonradan
  alınması kullanıcı göçü gerektirir. Asimetri, "şimdi al" yönünde kesin.
- **Strateji ile tutarlılık:** Kancalar özellik değildir; hiçbiri bugün ödeme
  yeteneği açmaz. Odak-kaybı riskini ([[PM-AUTH-0001]]) artırmazlar.
- **Egemenlikle tutarlılık:** Karar 2 (kullanıcı-seçimli kurtarma) ve Karar 5
  (FINANCE izin listesi) sansür paradoksunu paradan uzak tutar.

---

# Sonuçlar (contracts/ için bağlayıcı)

1. `contracts/` cüzdanı **kontrat hesabı** olarak tasarlanır (Karar 1); EOA-varsayımı
   kabul edilmez.
2. Cüzdan/SDK **üç türetme yolu** üretir (Karar 2); kurtarma yalnızca varlık yoluna.
3. Delegasyon kontratı `scope`'u **genişletilebilir** yazılır (Karar 3).
4. `requiresCredential` **ortak kütüphane** olarak `shared/` veya `contracts/lib`'de
   (Karar 4).
5. Native token **yok**; ERC-20 dağıtımı FINANCE-issuer **izin listesine** kapılı
   (Karar 5).

---

# İlişkiler

- [[PM-AUTH-0001]] — bu ADR'ın strateji gerekçesi.
- [[ADR-0001]] — Besu/EVM (A katmanı hesap modeli).
- [[ADR-0002]] — egemenlik-öncelikli yönetişim (FINANCE izni, `onlyOwnerState`).
- [[SPEC-BC-0001]] — Issuer Registry / IssuerCategory / StatusList (credential-gating veri kaynağı).
- [[SPEC-BC-0002]] — accountable disclosure (varlık kurtarmasından ayrı kimlik escrow'u).
- PM-ID-0003 (planlı) — varlık cüzdanı kurtarma kompozisyonu detayı.
- [[SPEC-AGENT-0001]] — agent delegasyon yüzeyi (Karar 3) + credential-gating
  daraltması (Karar 4).

Beş kanca kararı sabitlendi (2026-08-06). `contracts/`
implementasyonu bu kısıtlara uyar. Kurtarma kompozisyonu ve agent delegasyon detayı
ayrı dokümanlara havale edildi. **2026-09-10:** Karar 4, [[SPEC-AGENT-0001]] ile
daraltıldı (Faz 0'da zincir üstü credential-gating yok; bkz. Karar 4 notu).
