// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title  VctNamespace
 * @notice Şema ad alanlarının ayrımı — ADR-0054 K1 / NS1 (ADR-0010 `vct` biçimi).
 *
 * @dev    Devlet-özel (ulusal) tür: `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>` — `<cc>` iki küçük harf (ISO 3166-1 alpha-2),
 *         ardından boş olmayan TAM üç bölüm. Ağ türü (`urn:tamga:<alan>:<Tür>:<ana sürüm>`) dört bölümlüdür; iki biçim ayrıktır.
 *         Ulusal kayıt bu biçimde ve kendi devlet koduyla olmak zorundadır; ağ kaydı bu biçimde olamaz. Böylece bir ulusal
 *         kayıt bir ağ şemasının adını (oylama sürerken bile) alamaz.
 */
library VctNamespace {
    /// @notice `vct` devlet-özel biçimdeyse devlet kodunu (büyük harf, ör. "TR") döndürür; değilse 0x0000.
    function nationalStateOf(string calldata vct) internal pure returns (bytes2) {
        bytes calldata b = bytes(vct);
        // en kısa biçim: "urn:tamga:" (10) + "xx:" (3) + "a:b:c" (5)
        if (b.length < 18) return bytes2(0);
        if (bytes10(b[0:10]) != bytes10("urn:tamga:")) return bytes2(0);
        bytes1 c0 = b[10];
        bytes1 c1 = b[11];
        if (!_isLower(c0) || !_isLower(c1) || b[12] != ":") return bytes2(0);

        uint256 colons = 0;
        uint256 segLen = 0;
        for (uint256 i = 13; i < b.length; i++) {
            if (b[i] == ":") {
                if (segLen == 0) return bytes2(0);
                colons++;
                segLen = 0;
            } else {
                segLen++;
            }
        }
        if (colons != 2 || segLen == 0) return bytes2(0);
        // küçük harf → büyük harf (ASCII: -0x20)
        return bytes2((uint16(uint8(c0) - 0x20) << 8) | uint16(uint8(c1) - 0x20));
    }

    function _isLower(bytes1 c) private pure returns (bool) {
        return c >= "a" && c <= "z";
    }
}
