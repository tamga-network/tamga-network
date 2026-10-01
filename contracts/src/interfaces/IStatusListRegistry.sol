// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/**
 * @title IStatusListRegistry — SPEC-BC-0001 §7 / ADR-0008
 * @dev   isRevoked() BİLEREK YOKTUR. Zincir bu soruyu cevaplayamaz; iptal
 *        durumu off-chain Status List Token'dan okunur (SPEC-CRED-0003 §7).
 *        Cevaplanamayacak bir soruyu soran arayüz bırakmak, `false` dönüşünün
 *        "iptal edilmemiş" sanılmasına yol açardı.
 */
interface IStatusListRegistry is ITamgaErrors {
    enum ListStatus {NONE, ACTIVE, RETIRED}

    struct ListAnchor {
        bytes32 issuerId;
        string listURI;
        bytes32 contentHash;
        uint32 listSize;
        uint8 bitsPerEntry;
        uint64 version;
        uint64 publishedAt;
        ListStatus status;
    }

    event ListRegistered(bytes32 indexed listId, bytes32 indexed issuerId, string listURI, uint32 listSize);
    event ListPublished(bytes32 indexed listId, uint64 version, bytes32 contentHash, uint64 publishedAt);
    event ListRetired(bytes32 indexed listId, string reason);

    error ListExists(bytes32 listId);
    error UnknownList(bytes32 listId);
    error NotIssuerDelegate(bytes32 issuerId, address caller);
    error IssuerNotActive(bytes32 issuerId);
    error ListNotActive(bytes32 listId);
    error VersionNotMonotonic(uint64 current, uint64 submitted);
    error ListSizeTooSmall(uint32 submitted, uint32 minimum);
    error InvalidBitsPerEntry(uint8 submitted);
    error EmptyListURI();
    error PublishedAtInFuture(uint64 publishedAt);
    error PublishedAtNotMonotonic(uint64 current, uint64 submitted);
    error PublishQuotaExceeded(bytes32 listId, uint32 limit);

    function listIdOf(bytes32 issuerId, string calldata listURI) external pure returns (bytes32);
    function registerList(bytes32 issuerId, string calldata listURI, uint32 listSize, uint8 bitsPerEntry)
        external returns (bytes32);
    function publishList(bytes32 listId, bytes32 contentHash, uint64 version, uint64 publishedAt) external;
    function retireList(bytes32 listId, string calldata reason) external;

    function getListAnchor(bytes32 listId) external view returns (ListAnchor memory);
    function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
    function getListsByIssuer(bytes32 issuerId) external view returns (bytes32[] memory);
    function publishCountToday(bytes32 listId) external view returns (uint32);
}
