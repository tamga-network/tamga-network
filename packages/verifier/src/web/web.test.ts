/** @tamga-network/verifier/web — DOM gerektirmeyen parçalar (AP2 / S14 sonuç metni). */
import { describe, it, expect } from "vitest";
import {
  MAX_POLL_DELAY_MS,
  chooseDcApiRequests,
  dcResponseTarget,
  isAppleWebKit,
  nextPollDelayMs,
  outcomeMessage,
  resolveLang,
} from "./index.js";

describe("verifier/web", () => {
  it("Y1 / AP2: REJECTED ile INDETERMINATE farklı metin; INDETERMINATE belgeyi suçlamaz", () => {
    expect(outcomeMessage({ outcome: "ACCEPTED" })).toBe("Verified.");
    const rej = outcomeMessage({ outcome: "REJECTED", failed_reason: "credential revoked" });
    const ind = outcomeMessage({ outcome: "INDETERMINATE", failed_reason: "status token age 9000s" });
    expect(rej).toContain("not accepted");
    expect(rej).toContain("credential revoked");
    expect(ind).toContain("Could not be verified right now");
    expect(ind).toContain("not invalid");
    expect(ind).not.toContain("9000"); // iç ayrıntı kullanıcıya gösterilmez
    expect(rej).not.toBe(ind);
  });

  it("dil: varsayılan İngilizce; tr / tk desteklenir, bilinmeyen dil İngilizceye düşer", () => {
    expect(resolveLang("tr-TR")).toBe("tr");
    expect(resolveLang("tk")).toBe("tk");
    expect(resolveLang("de")).toBe("en");
    expect(outcomeMessage({ outcome: "ACCEPTED" }, "tr")).toBe("Doğrulandı.");
    expect(outcomeMessage({ outcome: "INDETERMINATE" }, "tr")).toContain("geçersiz değil");
    expect(outcomeMessage({ outcome: "ACCEPTED" }, "tk")).toBe("Tassyklandy.");
  });

  it("yoklama 429'da geri çekilir: iki kat, Retry-After alt sınır, üst sınır", () => {
    expect(nextPollDelayMs(1500, 1500, null)).toBe(3000);
    expect(nextPollDelayMs(3000, 1500, null)).toBe(6000);
    expect(nextPollDelayMs(1500, 1500, "10")).toBe(10_000);
    expect(nextPollDelayMs(1500, 1500, "abc")).toBe(3000);
    expect(nextPollDelayMs(20_000, 1500, null)).toBe(MAX_POLL_DELAY_MS);
    expect(nextPollDelayMs(1500, 1500, "120")).toBe(MAX_POLL_DELAY_MS);
  });
});

describe("verifier/web — DC API protokol seçimi (0.6.0)", () => {
  const oid = { protocol: "openid4vp-v1-signed", data: { request: "x" } };
  const mdoc = { protocol: "org-iso-mdoc", data: { deviceRequest: "a", encryptionInfo: "b" } };
  const SAFARI_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const CHROME_WIN =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  it("Apple WebKit (iPhone, Mac Safari) yalnız org-iso-mdoc; Chrome OpenID4VP önce, Ek C sonra", () => {
    expect(isAppleWebKit(SAFARI_MAC)).toBe(true);
    expect(isAppleWebKit(IPHONE)).toBe(true);
    expect(isAppleWebKit(CHROME_MAC)).toBe(false);
    const p = { dc_api_requests: [oid, mdoc] };
    expect(chooseDcApiRequests(p, SAFARI_MAC)).toEqual([mdoc]);
    expect(chooseDcApiRequests(p, IPHONE)).toEqual([mdoc]);
    expect(chooseDcApiRequests(p, CHROME_WIN)).toEqual([oid, mdoc]);
    // mdoc isteği olmayan (SD-JWT) politika: Safari'de DC API yolu yok (QR kalır)
    expect(chooseDcApiRequests({ dc_api_request: oid }, SAFARI_MAC)).toEqual([]);
    expect(chooseDcApiRequests({ dc_api_request: oid }, CHROME_WIN)).toEqual([oid]);
  });
  it("yanıt protokolüne göre uç: OpenID4VP /vp/response, Ek C dc_mdoc_response_uri, bilinmeyen null", () => {
    const p = { dc_mdoc_response_uri: "https://v.example/vp/dc-mdoc/prs_1" };
    expect(dcResponseTarget("https://v.example", "openid4vp-v1-signed", p)).toBe("https://v.example/vp/response");
    expect(dcResponseTarget("https://v.example", "org-iso-mdoc", p)).toBe(p.dc_mdoc_response_uri);
    expect(dcResponseTarget("https://v.example", "org-iso-mdoc", {})).toBeNull();
    expect(dcResponseTarget("https://v.example", "other", p)).toBeNull();
  });
});
