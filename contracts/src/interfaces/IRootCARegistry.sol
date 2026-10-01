// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/// @title IRootCARegistry — SPEC-BC-0001 §2
/// @dev   Sertifikanın kendisi zincirde DEĞİLDİR; yalnızca parmak izi + URI.
interface IRootCARegistry is ITamgaErrors {
    /// @dev RETIRED (review bulgusu R2): planlı rotasyon. Yeni issuer bağlanamaz,
    ///      mevcut zincirler DOĞRULANMAYA DEVAM EDER. REVOKED = ele geçirilme, sert.
    enum CAStatus {NONE, ACTIVE, SUSPENDED, RETIRED, REVOKED}

    struct RootCA {
        bytes32 caId;
        bytes2 stateCode;
        bytes32 certFingerprint;
        bytes32 subjectHash;
        string certURI;
        string crlURI;
        CAStatus status;
        uint64 validFrom;
        uint64 validUntil;
        uint64 registeredAt;
    }

    event RootCARegistered(bytes32 indexed caId, bytes2 indexed stateCode, bytes32 certFingerprint);
    event RootCASuspended(bytes32 indexed caId);
    event RootCAReinstated(bytes32 indexed caId);
    event RootCARevoked(bytes32 indexed caId, string reason);
    event RootCARetired(bytes32 indexed caId, bytes32 successorCA);
    event RootCACrlUpdated(bytes32 indexed caId, string crlURI);

    error CAExists(bytes32 caId);
    error UnknownCA(bytes32 caId);
    error EmptyFingerprint();

    function caIdOf(bytes2 stateCode, bytes32 certFingerprint) external pure returns (bytes32);
    function registerRootCA(RootCA calldata data) external;
    function suspendRootCA(bytes32 caId) external;
    function reinstateRootCA(bytes32 caId) external;
    function revokeRootCA(bytes32 caId, string calldata reason) external;
    /// @notice Planlı rotasyon. Zincirler geçerli kalır; yeni issuer bağlanamaz.
    function retireRootCA(bytes32 caId, bytes32 successorCA) external;
    function updateCrlURI(bytes32 caId, string calldata crlURI) external;

    /// @notice "Bu CA'ya YENİ issuer bağlanabilir mi?" — yalnızca ACTIVE.
    function isValidRootCA(bytes32 caId) external view returns (bool);
    /// @notice "Bu CA'ya bağlı bir sertifika zinciri kabul edilebilir mi?" — ACTIVE veya RETIRED.
    function isChainAcceptable(bytes32 caId) external view returns (bool);
    function exists(bytes32 caId) external view returns (bool);
    function getRootCA(bytes32 caId) external view returns (RootCA memory);
    function getRootCAsByState(bytes2 stateCode) external view returns (bytes32[] memory);
}
