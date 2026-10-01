# Documentation Lifecycle

**Standard Version:** 1.0.0
**Status:** Active
**Owner:** Tamga Network Engineering
**Applies To:** Tamga Network Engineering Workspace içindeki tüm dokümantasyon

---

# Amaç

Bu doküman, workspace içindeki her dokümanın resmi yaşam döngüsünü tanımlar.

Amaç, dokümantasyonun yapısal ve öngörülebilir biçimde evrilmesini sağlamaktır. Tanımlı bir yaşam döngüsü olmadan dokümantasyon çoğu zaman tutarsızlaşır, tekrarlanır veya terk edilir. Bu standart, sonu gelmeyen yeniden yazımları önlerken sürekli iyileştirmeye izin verir.

---

# Yol Gösterici İlkeler

1. Dokümantasyon bir üründür.
2. Dokümantasyon evrilir.
3. Dokümantasyon sonsuza dek yeniden yazılmamalıdır.
4. Önemli her doküman sonunda kararlı hâle gelmelidir.
5. Tarihsel mühendislik bilgisi asla kaybedilmemelidir.

---

# Yaşam Döngüsü

```text
Draft → Completed → In Review → Reviewed → Frozen → (Deprecated) → (Archived)
```

---

# Durumlar

## Draft
Doküman hâlâ yazılıyor. Yapı değişebilir, içerik eksik olabilir, çapraz referanslar henüz olmayabilir.
```yaml
review_status: Draft
```

## Completed
İlk tam sürüm mevcut. İçerik yazıldı, metadata tam, çapraz referanslar var. Henüz kalite incelemesinden geçmedi.
```yaml
review_status: Completed
```

## In Review
Doküman inceleniyor: teknik doğruluk, terminoloji tutarlılığı, tekrar, kırık referanslar, metadata doğrulama, yapı, yazım kalitesi.
```yaml
review_status: In Review
```

## Reviewed
İncelemeyi geçti. Teknik olarak tutarlı, terminoloji doğrulanmış, referanslar kontrol edilmiş. Küçük iyileştirmeler hâlâ olabilir.
```yaml
review_status: Reviewed
```

## Frozen
Kararlı kabul edilir. Projenin resmi mühendislik bilgisini temsil eder. Değişiklik nadirdir ve gerekçe ister; mimari bu dokümanlardan kolayca sapmamalıdır.
```yaml
review_status: Frozen
```

## Deprecated
Artık birincil referans olarak önerilmez (mimari/terminoloji değişti veya yenisiyle değiştirildi). Aranabilir kalır.
```yaml
review_status: Deprecated
```

## Archived
Tarihsel doküman. Aktif bakım yapılmaz, yalnızca tarihsel amaçla korunur.
```yaml
review_status: Archived
```

---

# Önerilen İş Akışı

```text
Research → Authoring → Completed → Directory Review → Reviewed → Frozen
```

Dokümanlar mümkünse **klasör bazında** incelenir, tek tek değil. Örnek: `docs/project-memory/identity/` klasörünün tamamı incelemeye girmeden önce `Completed` olmalıdır.

---

# İnceleme Kontrol Listesi

**Teknik:** Bilgi doğru mu? Terminoloji tutarlı mı? Varsayımlar açık mı?
**Yapısal:** Başlıklar tutarlı mı? Gezinmek kolay mı? Bölümler mantıklı sırada mı?
**Metadata:** Front matter tam mı? Etiketler/anahtar kelimeler anlamlı mı? Özet doğru mu? review_status doğru mu?
**Referanslar:** İlgili dokümanlar listelenmiş mi? İç bağlantılar doğru mu? ADR/RFC uygun yerde referanslanmış mı?
**Mühendislik:** Başka bir dokümanı tekrar ediyor mu? İçerik başka yere mi taşınmalı? Kapsam uygun mu?

---

# Versiyonlama

Dokümanlar bağımsız evrilir. Semantic Versioning izlenir:
- Küçük iyileştirme → minor artışı (`1.0.0` → `1.1.0`)
- Büyük yapısal değişiklik → major artışı (`1.x.x` → `2.0.0`)

---

# Güncel Workspace Politikası

- Yeni dokümanlar **Draft** olarak başlar.
- Yazım bitince **Completed** olur.
- Klasörün tamamı sonra incelenir.
- Başarılı incelemeden sonra **Reviewed** olur.
- Temel dokümanlar sonunda **Frozen** olur.

Bu, tamamlanmış işi sürekli yeniden yazmadan projenin büyümesini sağlar.

---

# İlgili Standartlar

Bu doküman şunlarla birlikte kullanılmalıdır:
- `DOCUMENTATION-STANDARD.md`
- `CONTRIBUTING.md`
- `README.md`
