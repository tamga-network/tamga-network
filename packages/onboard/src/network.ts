/**
 * Ağ ortamları: imzalı liste adresi, kök pinleri ve sandbox portalı. Pinler cüzdandaki gibi pakete GÖMÜLÜDÜR (S-13; denetlenen
 * kaynağın kendi pinine güvenilmez) — kaynak: tamga.network/trust-anchor (Güven Çerçevesi'ndeki değerlerle aynı). Pin değişirse
 * paket güncellenir; ara dönemde `--pin <hex>` bant dışı doğrulanmış değerle geçersiz kılar. ADR-0038: sandbox kümesi ayrıdır.
 */
export type Environment = "production" | "sandbox";

export const NETWORKS: Record<Environment, { trust: string; pins: string[]; portal?: string; docs: string }> = {
  production: {
    trust: "https://trust.tamga.network",
    pins: ["7fd176d58fd3fba3bdea137374d6ae3dc8ffc8dcb9b645c2b08566464764fdc1"],
    docs: "https://docs.tamga.network",
  },
  sandbox: {
    trust: "https://trust.sandbox.tamga.network",
    pins: ["49d1a7873996342f2ad4123789f48e5c1167b2c327774eba34278facffc29fee"],
    portal: "https://sandbox.tamga.network",
    docs: "https://docs.tamga.network",
  },
};

/**
 * `tamga-onboard sandbox` — sandbox'ta "Kurumunu dene" yolu. Bugün makine arayüzü yok (portal formu kendi kökeninden POST kabul
 * eder; test kurumu açan uç iç uçtur, ADR-0041) — araç yalnız adresi ve adımları verir; form kişinin tarayıcısında doldurulur.
 */
export function sandboxGuide(): { url: string; steps: string[]; notes: string[] } {
  const portal = NETWORKS.sandbox.portal!;
  return {
    url: `${portal}/institutions/new`,
    steps: [
      `Tarayıcıda açın: ${portal}/institutions/new ("Kurumunu dene")`,
      "Uydurma bir kurum adı yazın (gerçek kurum adı ve resmî sözcükler — Üniversitesi, Bakanlığı, T.C. … — kabul edilmez); iki onay kutusunu işaretleyin",
      "Gösterilen tek kullanımlık Konsol davetiyle passkey oluşturun (bağlantı bir kez gösterilir)",
      "Konsol → Kayıtlar: yalnız uydurma kayıt ekleyin (gerçek görünümlü kimlik numarası reddedilir)",
      "Masada ver → cüzdanla alın → portalda doğrulama sayfasında gösterin; Konsol'dan iptal edip yeniden doğrulayın (ret)",
      "Test kurumunun kısa adı (t-…) ile: tamga-onboard check --listing-only --env sandbox --slug t-…",
    ],
    notes: [
      "Her şey her gece silinir; kişi bilgisi istenmez. Sınırlar: aynı anda en çok 30 test kurumu, kurum başına 200 kayıt.",
      "Sandbox için başvuru dosyası, anahtar ya da CSR gerekmez (test kurumu sandbox'ın test anahtarıyla imzalar).",
      "Makinece test kurumu açma arayüzü bugün yoktur (yeni kamuya açık uç ayrı karar).",
    ],
  };
}
