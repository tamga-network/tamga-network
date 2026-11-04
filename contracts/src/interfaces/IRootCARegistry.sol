// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

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
    /// @dev Güvenlik turu 2026-11-04: gerekçe serbest metin değil, özetidir (ADR-0074 PJ2).
    event RootCARevoked(bytes32 indexed caId, bytes32 reasonHash);
    event RootCARetired(bytes32 indexed caId, bytes32 successorCA);
    event RootCACrlUpdated(bytes32 indexed caId, string crlURI);
    /// @dev ADR-0073 K5 eşlemesi: listedeki `ROLLING_OVER` = zincirde ACTIVE + bu halef olayı.
    event RootCARollingOver(bytes32 indexed caId, bytes32 successorCA);
    /// @dev Her durum değişikliğinin geçerlilik anı (göç kipinde açık tarih; aksi hâlde blok zamanı).
    event RootCAStatusChanged(bytes32 indexed caId, CAStatus status, uint64 since);

    error CAExists(bytes32 caId);
    error UnknownCA(bytes32 caId);
    error EmptyFingerprint();

    function caIdOf(bytes2 stateCode, bytes32 certFingerprint) external pure returns (bytes32);
    function registerRootCA(RootCA calldata data) external;
    function suspendRootCA(bytes32 caId) external;
    function reinstateRootCA(bytes32 caId) external;
    function revokeRootCA(bytes32 caId, bytes32 reasonHash) external;
    /// @notice Planlı rotasyon. Zincirler geçerli kalır; yeni issuer bağlanamaz.
    function retireRootCA(bytes32 caId, bytes32 successorCA) external;
    function updateCrlURI(bytes32 caId, string calldata crlURI) external;
    /// @notice ADR-0073 K1: `at` = 0 → blok zamanı; açık tarih yalnız göç kipinde.
    function suspendRootCAAt(bytes32 caId, uint64 at) external;
    function reinstateRootCAAt(bytes32 caId, uint64 at) external;
    function revokeRootCAAt(bytes32 caId, bytes32 reasonHash, uint64 at) external;
    function retireRootCAAt(bytes32 caId, bytes32 successorCA, uint64 at) external;
    /// @notice Listedeki `ROLLING_OVER`: durum ACTIVE kalır, halef olayla yayılır.
    function announceRootCARollover(bytes32 caId, bytes32 successorCA) external;

    /// @notice "Bu CA'ya YENİ issuer bağlanabilir mi?" — yalnızca ACTIVE.
    function isValidRootCA(bytes32 caId) external view returns (bool);
    /// @notice "Bu CA'ya bağlı bir sertifika zinciri BUGÜN kabul edilebilir mi?" — ACTIVE veya RETIRED.
    function isChainAcceptable(bytes32 caId) external view returns (bool);
    /// @notice Doğrulama C1'in kök adımı (ADR-0073 K5): CA `iat` anında ACTIVE ve hiç REVOKED değil.
    ///         Emekli kökün emeklilikten SONRA verilmiş belgeleri ret; öncekiler kabul (liste kuralı).
    function isChainAcceptableAt(bytes32 caId, uint64 iat) external view returns (bool);
    function rootCAStatusAt(bytes32 caId, uint64 t) external view returns (CAStatus);
    function rootCAStatusHistoryOf(bytes32 caId) external view returns (StatusHistory.Change[] memory);
    function exists(bytes32 caId) external view returns (bool);
    function getRootCA(bytes32 caId) external view returns (RootCA memory);
    function getRootCAsByState(bytes2 stateCode) external view returns (bytes32[] memory);
}
