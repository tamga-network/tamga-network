// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/**
 * @title  ITrustQueries
 * @dev    1.1.0 (review): isValidIssuer / isAuthorizedForSchema İHRAÇ sorularıdır ve
 *         doğrulamada KULLANILMAZ. Doğrulama, credential'ın iat'ı verilerek
 *         "o an kabul edilebilir miydi" diye sorar. Aksi hâlde REVOKED bir
 *         bakanlığın tüm diplomaları ve DEPRECATED şemayla verilmiş tüm eski
 *         belgeler reddedilirdi.
 *
 * @notice Doğrulayıcıların ihtiyaç duyduğu okuma seti — SPEC-BC-0001 §11.2.
 *
 * @dev    1.0.0'da bu arayüzde `IStatusList.isRevoked(...)` vardı. KALDIRILDI
 *         (ADR-0008). Zincir iptal durumunu bilmiyor; bilseydi iptal anını
 *         tüm validator'lara sızdırırdı. İptal, off-chain Status List
 *         Token'dan okunur (SPEC-CRED-0003 §7); zincir yalnızca çapayı verir.
 *
 *         UYARI: Bu arayüzü kullanan bir doğrulayıcı BEŞ sorunun hepsini
 *         sormak zorundadır. Dördünü sorup beşincisini atlamak, sessizce
 *         yanlış cevap üretir.
 */
interface ITrustQueries is ITamgaErrors {
    /// 1) iat anında verilmiş bu credential, issuer açısından kabul edilebilir mi?
    ///    (YUMUŞAK İPTAL: REVOKED issuer'ın revokedAt öncesi belgeleri kabul — review R1)
    function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool);

    /// 2) iat anında issuer BU şemaya yetkili miydi? (ADR-0007 K6; DEPRECATED şema engel değil — review R3)
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    /// 3) Doğrulayıcının elindeki Type Metadata hash'i zincirdekiyle aynı mı?
    function schemaMatchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);

    /// 4) Doğrulayıcının devleti bu issuer'ı tanıyor mu?
    function isRecognizedBy(bytes2 verifierState, bytes32 issuerId) external view returns (bool);

    /// 5) Status list çapası — doğrulayıcı indirdiği token'ın hash'ini karşılaştırır.
    function statusListMatchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
}
