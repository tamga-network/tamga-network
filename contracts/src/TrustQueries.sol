// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITrustQueries} from "./interfaces/ITrustQueries.sol";
import {IIssuerRegistry} from "./interfaces/IIssuerRegistry.sol";
import {ISchemaRegistry} from "./interfaces/ISchemaRegistry.sol";
import {ICrossRecognition} from "./interfaces/ICrossRecognition.sol";
import {IStatusListRegistry} from "./interfaces/IStatusListRegistry.sol";

/**
 * @title  TrustQueries
 * @notice Doğrulayıcılar için tek adres — SPEC-BC-0001 §11.2'nin beş sorusu.
 * @dev    Yalnızca okuma. Durum tutmaz, yükseltilebilir değildir; registry
 *         adresleri sabittir. Registry yükseltilirse proxy adresi değişmediği
 *         için bu kontrat da etkilenmez.
 *
 *         UYARI: Beş sorunun hepsi sorulmalıdır. Dördünü sorup beşincisini
 *         atlamak sessizce yanlış cevap üretir.
 */
contract TrustQueries is ITrustQueries {
    IIssuerRegistry public immutable issuers;
    ISchemaRegistry public immutable schemas;
    ICrossRecognition public immutable recognition;
    IStatusListRegistry public immutable statusLists;

    // ZeroAddress ITamgaErrors'tan gelir (ITrustQueries is ITamgaErrors) — yerel tanım kaldırıldı.

    constructor(address issuers_, address schemas_, address recognition_, address statusLists_) {
        if (
            issuers_ == address(0) || schemas_ == address(0)
                || recognition_ == address(0) || statusLists_ == address(0)
        ) revert ZeroAddress();
        issuers = IIssuerRegistry(issuers_);
        schemas = ISchemaRegistry(schemas_);
        recognition = ICrossRecognition(recognition_);
        statusLists = IStatusListRegistry(statusLists_);
    }

    function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool) {
        return issuers.isCredentialAcceptable(issuerId, iat);
    }

    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool)
    {
        return issuers.isCredentialSchemaAcceptable(issuerId, schemaId, iat);
    }

    function schemaMatchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool) {
        return schemas.matchesContentHash(schemaId, hash);
    }

    function isRecognizedBy(bytes2 verifierState, bytes32 issuerId) external view returns (bool) {
        return recognition.isRecognizedBy(verifierState, issuerId);
    }

    function statusListMatchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool) {
        return statusLists.matchesContentHash(listId, hash);
    }

    /// @notice Beşini tek çağrıda — indeksleyici yoksa RPC turunu azaltır.
    function verifyAll(
        bytes32 issuerId,
        uint64 credentialIat,
        bytes32 schemaId,
        bytes32 schemaHash,
        bytes2 verifierState,
        bytes32 listId,
        bytes32 listHash
    ) external view returns (bool ok, bool[5] memory results) {
        results[0] = issuers.isCredentialAcceptable(issuerId, credentialIat);
        results[1] = issuers.isCredentialSchemaAcceptable(issuerId, schemaId, credentialIat);
        results[2] = schemas.matchesContentHash(schemaId, schemaHash);
        results[3] = recognition.isRecognizedBy(verifierState, issuerId);
        results[4] = statusLists.matchesContentHash(listId, listHash);
        ok = results[0] && results[1] && results[2] && results[3] && results[4];
    }
}
