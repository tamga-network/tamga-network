# apps/_shared — servislerin ortak yardımcıları

Yalnızca bu depodaki servislerin (`apps/verify`, `apps/wallet-provider`) kullandığı küçük yardımcılar. Yayımlanan
`@tamga-network/*` paketlerine girmez.

- `dotenv.ts` — `.env` okuyucu: `AD=değer` satırları, `#` sonrası yorum; ortamda zaten tanımlı değişkeni ezmez.
