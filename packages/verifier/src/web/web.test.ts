/** @tamga-network/verifier/web — DOM gerektirmeyen parçalar (AP2 / S14 sonuç metni). */
import { describe, it, expect } from "vitest";
import { outcomeMessage, resolveLang } from "./index.js";

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
});
