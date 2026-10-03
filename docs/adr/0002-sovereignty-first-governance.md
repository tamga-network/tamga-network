---
document_id: ADR-0002
title: "Egemenlik öncelikli yönetişim"
status: Active
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  Tamga Network yönetişimini EGEMENLİK-ÖNCELİKLİ üç katmana ayırır: (1) Ağa üyelik
  (yeni devletin validator olması) validator çoğunluğuyla (2/3) oylanır; (2) Ulusal
  kayıtlar (belge veren, relying party) YALNIZCA ilgili devletin yetkisindedir, hiçbir
  dış oy yoktur (kod seviyesinde onlyOwnerState); (3) Sınır-ötesi tanıma her devlet
  tarafından tek taraflı belirlenir. Devlet çıkarma vatandaş belgelerini
  geçersiz kılmaz; çıkış hakkı (withdraw) kod garantilidir. Model eIDAS LOTL
  emsalini izler. PM-BC-0001'in "kurucu konsorsiyum + on-chain oylama" ifadesini
  inceltir; SPEC-BC-0001 ile uygulanır.
domain: Governance
---

# ADR-0002 — Egemenlik-Öncelikli Yönetişim

**Durum:** Accepted
**Tarih:** 2026-08-05
**Karar veren:** Tamga Network proje yönetimi
**Kaynak:** `docs/tamga-network-guven-katmani-kontratlari-v2.md` (mimari karar taslağı) — bu ADR o taslağın yönetişim bölümünü resmileştirir.

---

# Bağlam

[[PM-BC-0001]] yönetişimi geniş biçimde "kurucu konsorsiyum + on-chain oylama"
olarak bırakmıştı. Ancak kritik bir soru bunu inceltmeyi gerektirdi:

> **Türkiye kendi kurumunu (ör. MEB) [[t:issuer]] yaparken neden Kazakistan'ın oyunu beklesin?**

Beklememeli. Aksi, kabul edilemez bir **egemenlik ihlali** ve benimsenmenin önündeki
en büyük engel olurdu. Emsal nettir: [[t:eIDAS]]'ta her üye devlet kendi Trusted
List'ini bağımsız yayınlar; AB yalnızca listeleri toplar ([[t:LOTL]]). Hiçbir devlet
başkasının hangi kurumu belge veren yapacağına oy vermez. Karşılıklı tanıma bir
**anlaşma/tercih**tir, kurum-kurum oylanan bir şey değil.

---

# Karar

Yönetişim üç katmana ayrılır; her katmanda karar **farklı** aktördedir:

| Katman | Konu | Karar kimde | Eşik |
|--------|------|-------------|------|
| **1 — Ağa üyelik** | Yeni devletin validator olması / çıkarılması / protokol yükseltme | Validator çoğunluğu (mevcut devletler) | **2/3** |
| **2 — Ulusal kayıtlar** | Kendi belge verenleri, kendi relying party'leri | **Yalnızca ilgili devlet** | Oy YOK (`onlyOwnerState`) |
| **3 — Sınır-ötesi tanıma** | "X ülkesinin belgelerini kabul ediyor muyum?" | Her devlet, kendi adına | Tek taraflı |

## Alt kararlar
1. **Katman 1 eşikleri:** yeni devlet kabulü **2/3**; devlet çıkarma **2/3** (çıkarılanın
   oyu sayılmaz); protokol yükseltme **2/3**. (Oybirliği yerine 2/3 seçildi: tek
   devletin büyümeyi veto etme/kilitleme riskini önler; yine de ağır bir karardır.)
2. **Katman 2 — kod seviyesinde egemenlik:** her devletin bir **namespace**'i vardır
   (`TR:issuer:*`, `KZ:rp:*` …) ve o namespace'e **yalnızca o devletin yetkili
   anahtarı** yazabilir. Kontratta `onlyOwnerState(stateCode)` modifier'ıyla zorlanır;
   iyi niyete bağlı değildir.
3. **Katman 3 — varsayılan tanıma politikası:** **kurucu üyeler arasında FULL**
   (birbirini baştan tam tanır); **sonradan katılanlar için NONE** (opt-in) — devletler
   kendi mevzuat hızında açar. Bu, "hepsi ya da hiçbiri" tuzağını önler.
4. **Çıkarma ≠ belge imhası:** bir devletin çıkarılması yalnızca "yeni kayıt
   yazamaz + blok üretemez" demektir. Vatandaşlarının cüzdanındaki [[t:credential|belgeler]]
   geçersiz olmaz; akıbetleri diğer devletlerin Katman 3 tanıma kararına kalır.
5. **Çıkış hakkı (exit):** bir devlet tek taraflı `withdraw()` ile çekilebilir; oy
   gerekmez. Kod seviyesinde garanti.
6. **Sınır-ötesi yargı (home-state egemenliği):** bir vatandaşın [[t:pseudonym|takma adını]]
   YALNIZCA kendi devletinin guardian eşiği + kendi mahkemesi açabilir; başka devlet
   açamaz. Detay [[PM-ID-0002]] (accountable disclosure) ile işlenir; [[PM-ID-0001]]
   "açıklama = home-state egemenliği" ilkesiyle tutarlıdır.

---

# Gerekçe

1. **Benimsenebilirlik.** Hiçbir devlet, "iç kurumsal kararlarım başkalarının oyuna
   bağlı" veya "bir gün atılırsam vatandaşlarımın kimliği çöp olur" riskiyle ağa girmez.
   Egemenlik güvenceleri katılımın önkoşuludur.
2. **Emsal (eIDAS/LOTL).** AB'nin çalışan modeli tam da budur; teorik değil kanıtlı.
3. **Kademeli entegrasyon.** Tek taraflı tanıma, her devletin kendi hızında açmasına
   izin verir; erken günlerde tam uyum zorunluluğunu kaldırır.
4. **Kod seviyesinde garanti.** `onlyOwnerState` + `withdraw`, egemenliği sözden
   çıkarıp mühendislik güvencesine dönüştürür.

---

# Sonuçlar

**Olumlu:**
- Güçlü benimsenme teşviki (egemenlik + çıkış + belge dayanıklılığı).
- Governance kontratının kapsamı daralır → daha basit, daha az saldırı yüzeyi.
- eIDAS ile kavramsal hizalı → interoperability kolaylığı.

**Maliyet / dikkat:**
- Cross-recognition matris yönetimi (her devlet × her devlet × kategori) operasyonel
  yük getirir; cüzdan/[[t:verifier]] UX'i bunu gizlemeli.
- "Kurucular FULL" varsayılanı, kurucu setin dikkatli seçilmesini gerektirir.
- Home-state yargı, sınır-ötesi suç senaryolarında sınırlı kalabilir (gelecekte
  devletler-arası anlaşma gerekebilir — [[PM-ID-0002]] açık konu).

---

# Değerlendirilen Alternatifler

- **Her şey ortak oy (tam konsorsiyum):** Reddedildi — Katman 2/3'te egemenlik ihlali;
  benimsenmez.
- **Hiç ortak oy (tamamen bağımsız):** Reddedildi — ağın bileşimi (kim validator)
  denetimsiz kalır; "kim masada oturur" ortak karar olmalı.
- **Oybirliği (Katman 1):** Reddedildi — tek devlet büyümeyi kilitleyebilir; 2/3 tercih.
- **Tanıma varsayılanı FULL (herkes):** Reddedildi — mevzuat/egemenlik riski; kurucular
  FULL + sonrakiler NONE tercih.

---

# İlgili Dokümanlar

- [[PM-BC-0001]] — "kurucu konsorsiyum + on-chain oylama" ifadesi bu ADR ile inceltilir.
- [[ADR-0001]] — Motor (Besu/QBFT); Katman 1 oyları QBFT validator setiyle örtüşür.
- [[SPEC-BC-0001]] — Bu modelin kontrat uygulaması (Governance, Registry, Recognition).
- [[ARCH-0001]] — Fazlı validator modeli (Faz 0'da namespace/oy işleyişi).
- [[PM-ID-0001]] / [[PM-ID-0002]] — Home-state egemenliği ve accountable disclosure.

---

# Durum

Yönetişim modeli karara bağlandı. Uygulama detayları
(kontrat arayüzleri, eşik parametreleri) [[SPEC-BC-0001]]'de; guardian kompozisyonu
ve sınır-ötesi yargı [[PM-ID-0002]] + [[PM-GOV-0001]] (planlı) ile derinleşecek.
