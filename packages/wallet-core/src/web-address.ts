/**
 * Web adresi şema kuralı (iç yardımcı; paket dışına yalnız `isLocalDevHost` açılır — `oid4vp.ts`): cüzdanın açtığı ya da veri
 * gönderdiği adres `https` olmalıdır. `http` yalnız çağıran yerel geliştirmeyi açıkça istediğinde (`allowLocalDevHost`) ve yalnız
 * yerel geliştirme adresine kabul edilir (güvenlik turu S11 ile aynı kapı).
 */

/**
 * Yerel geliştirme ağı: localhost, genel DNS'te kayıt edilemeyen ayrılmış adlar (.localhost, .test — RFC 6761; .local — mDNS)
 * ya da özel IPv4 (10/8, 172.16/12, 192.168/16, 127/8). Bu adlar internette başkasına ait olamaz.
 */
export function isLocalDevHost(host: string): boolean {
  if (host === "localhost" || /\.(localhost|test|local)$/.test(host)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * `https://…` adresi; ya da `allowLocalDevHost` açıkken yerel geliştirme adresine `http://…`. Başka şema, boşluk, kullanıcı
 * bilgisi (`user@`) taşıyan ya da alan adı olmayan değer kabul edilmez. `URL` kullanılmaz (React Native uygulaması eksik).
 */
export function isAllowedWebAddress(value: unknown, allowLocalDevHost = false): value is string {
  if (typeof value !== "string") return false;
  const m = /^(https?):\/\/([^/?#\s]+)([/?#]\S*)?$/.exec(value);
  if (!m || m[2].includes("@")) return false;
  if (m[1] === "https") return true;
  const host = m[2].replace(/:\d+$/, "").toLowerCase();
  return allowLocalDevHost === true && isLocalDevHost(host);
}
