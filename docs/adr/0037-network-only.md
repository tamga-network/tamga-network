---
document_id: ADR-0037
title: "Tamga Network yalnızca bir ağdır"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-02
summary: >
  Tamga Network bir ağdır: kuralları, güven listelerini, şema kataloğunu, açık paketleri ve ağın çalışması için gereken referans
  hizmetleri işletir; hizmet satmaz. Ticari hizmetler (entegrasyon, destek, sözleşmeli barındırma, danışmanlık, connector)
  ağın dışındaki şirketlerin işidir. Tamga Wallet ağın ilk cüzdanıdır ama ayrı bir üründür. ADR-0035'in üçüncü katmanı
  ("ürün ve hizmetler") bu kararla değişir.
domain: Governance
---

# Kısaca

Tamga Network bir ağdır, bir şirket değildir. Ağ kuralları yazar, güven listelerini yayınlar ve herkesin kullanabileceği açık
kodu ve referans hizmetleri işletir. Bunların hiçbiri satılmaz. Kurumlara ücretli entegrasyon, destek ya da danışmanlık sunmak
isteyen her şirket bunu ağın dışında, kendi adıyla yapar; ağın kuralları onlar için de aynıdır.

# Bağlam

[[ADR-0035]] Tamga'yı üç katmanda konumladı: AB uyumu taban, Tamga Network hafif bir [[t:federation]], üçüncü katmanda da
"ürün ve hizmetler" (Tamga Wallet ve kurumlara hizmetler). Aynı kayıt bilinen bir gerilimi de not etti: AB modelinde listeyi
yöneten kurumun hizmet satması çıkar çatışması sayılır ve ağ yönetişimi ile hizmet şirketi zamanla ayrışmalıdır.

Bu ayrışma artık yapıldı. Çalışma üç ayrı yapıya bölündü: Tamga Network (ağ), Tamga Wallet (cüzdan ürünü) ve ağın dışında,
AB–TR uyumu için hizmet veren bir şirket. Ağın kendi belgelerinde hizmet satışı anlatımı kalmamalıdır.

# Karar

**K1 — Tamga Network yalnızca ağdır.** Ağın işi:

- kurallar: Tamga ARF, Trust Framework, Tamga Rulebook ve belge türü rulebook'ları;
- güven: ülke [[t:trust-list|güven listeleri]], [[t:LOTL]], kayıt ve onay süreci, federasyon (dış listeler);
- ortak veri: şema kataloğu;
- açık kod: `@tamga-network/*` paketleri ve uyum testleri;
- referans hizmetler: güven listesi yayıncısı, kayıt aracı, barındırılan belge verme ve Kurum Konsolu, Tamga Verify, geçici
  kimlik servisi. Bunlar ağın çalışması, denenmesi ve kurumların katılması içindir; satılmaz.

**K2 — Ağ hizmet satmaz.** Entegrasyon, destek, sözleşmeli barındırma ve hizmet seviyesi taahhüdü, danışmanlık, connector ve
benzeri ticari hizmetler ağın dışındaki şirketlerce, kendi adlarıyla sunulur. Bu şirketlerden biri Tamga ekibinin kurduğu
şirkettir; ağ onu diğerlerinden ayırmaz.

**K3 — ADR-0035'in üçüncü katmanı değişir.** "Ürün ve hizmetler" yerine: **ağın üstündekiler** — ağın kurallarına uyan
cüzdanlar (ilki Tamga Wallet) ve hizmet sağlayıcılar. Bunlar ağın parçası değil, ağın katılımcıları ya da kullanıcılarıdır.

**K4 — Tamga Wallet ayrı bir üründür.** Ağın ilk ve referans cüzdanıdır; kendi deposunda, kendi karar dizisiyle gelişir ve
ağın kurallarına her cüzdan gibi uyar.

# Değişmezler

| Kod | Kural |
|---|---|
| PO5 | Tamga Network hizmet satmaz; ağın belgelerinde ve sitelerinde fiyat, satış ya da ticari hizmet anlatımı bulunmaz. Ticari hizmetler sağlayıcısının adıyla, ağın dışında sunulur. |
| PO6 | Ağın referans hizmetleri ve kayıt süreci bütün katılımcılara aynı koşullarla açıktır; hiçbir hizmet sağlayıcıya, Tamga ekibinin şirketi dahil, öncelik ya da ayrıcalık tanınmaz. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Hizmetler ağın içinde kalır (ADR-0035 hâli) | ret | Listeyi yöneten tarafın hizmet satması AB modelinde çıkar çatışmasıdır; devletlerin ve diğer şirketlerin ağa güvenmesini zorlaştırır. |
| **Ağ yalnız ağ; hizmetler ağın dışında** | **kabul** | Ağ tarafsız kalır, vakfa ya da devletlere devri kolaylaşır; ticari iş aynı ekipçe ama ayrı bir şirketle yürür. |

# Sonuçlar

- [[ADR-0035]]'in üçüncü katmanı bu kararla değişir; PO1–PO4 geçerli kalır.
- Tamga ARF ana belgesinin konumlanma bölümü (§1.5) ve yönetişim bölümü (§8.3) buna göre güncellenir.
- tamga.network ağın sesiyle konuşur: "Ağa katıl" sayfası katılımı anlatır, satış dili taşımaz.
- Ticari hizmetler şirketin belgelerinde ve sitesinde anlatılır (şirketin kendi karar dizisi).

# Durum

**Accepted — 2026-10-02** (proje yönetimi onayı; birebir alıntı özel onay kaydında).
