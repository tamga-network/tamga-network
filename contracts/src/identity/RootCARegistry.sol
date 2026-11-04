// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IRootCARegistry} from "../interfaces/IRootCARegistry.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/**
 * @title  RootCARegistry
 * @notice Üye devletlerin ulusal Root CA çapaları. SERTİFİKA ZİNCİRDE DEĞİLDİR;
 *         yalnızca parmak izi + URI (SPEC-BC-0001 §2, SPEC-ID-0002).
 *
 * @dev    Değişmezler:
 *           CA1  certFingerprint bir kez yazılır. Yeni sertifika = yeni caId.
 *           CA2  Root CA iptali, ona bağlı issuer'ları OTOMATİK geçersiz kılmaz.
 *
 *         CA2 neden: bir sertifika rotasyonu, o CA'ya bağlı bütün diplomaları
 *         bir anda çöpe atardı. Yumuşak kural (ADR-0002 #4) burada da geçerli.
 *         `isValidRootCA` yalnızca "bu CA ile YENİ issuer kaydedilebilir mi"
 *         sorusunu cevaplar.
 *
 *         ADR-0073 K5: durum, yalnız eklenebilir pencerelerle tutulur; doğrulama
 *         (`isChainAcceptableAt`) belgenin `iat` anındaki duruma bakar.
 */
contract RootCARegistry is TamgaRegistryBase, IRootCARegistry {
    using StatusHistory for StatusHistory.Change[];

    mapping(bytes32 => RootCA) private _cas;
    mapping(bytes2 => bytes32[]) private _byState;
    /// @dev ADR-0073 K5: caId => durum pencereleri (yalnız eklenir).
    mapping(bytes32 => StatusHistory.Change[]) private _history;

    uint256[46] private __gap;

    function initialize(address sovereignty_, address governance_) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
    }

    /// @inheritdoc IRootCARegistry
    function caIdOf(bytes2 stateCode, bytes32 certFingerprint) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(stateCode, certFingerprint));
    }

    /// @inheritdoc IRootCARegistry
    function registerRootCA(RootCA calldata data) external onlyOwnerState(data.stateCode) {
        if (data.certFingerprint == bytes32(0)) revert EmptyFingerprint();
        if (data.status != CAStatus.ACTIVE) revert MustRegisterAsActive();
        uint64 validFrom = _validFrom(data.validFrom);
        if (data.validUntil <= validFrom) revert InvalidValidity(validFrom, data.validUntil);
        // ADR-0073 K1: kayıt anı göç kipinde açık tarihle; kip dışında blok zamanı (registeredAt verilmez)
        uint64 registeredAt = _effectiveDate(data.registeredAt);

        bytes32 caId = caIdOf(data.stateCode, data.certFingerprint);
        if (_cas[caId].status != CAStatus.NONE) revert CAExists(caId);

        RootCA storage c = _cas[caId];
        c.caId = caId;
        c.stateCode = data.stateCode;
        c.certFingerprint = data.certFingerprint;   // CA1 — bir daha yazılmaz
        c.subjectHash = data.subjectHash;
        c.certURI = data.certURI;
        c.crlURI = data.crlURI;
        c.status = CAStatus.ACTIVE;
        c.validFrom = validFrom;
        c.validUntil = data.validUntil;
        c.registeredAt = registeredAt;
        // Kip dışında ilk ACTIVE penceresi başlangıçsızdır (since = 0); göçte listedeki ilk durum anı.
        _history[caId].record(data.registeredAt == 0 ? 0 : registeredAt, uint8(CAStatus.ACTIVE));

        _byState[data.stateCode].push(caId);
        emit RootCARegistered(caId, data.stateCode, data.certFingerprint);
    }

    function suspendRootCA(bytes32 caId) external {
        _suspend(caId, 0);
    }

    function suspendRootCAAt(bytes32 caId, uint64 at) external {
        _suspend(caId, at);
    }

    function reinstateRootCA(bytes32 caId) external {
        _reinstate(caId, 0);
    }

    function reinstateRootCAAt(bytes32 caId, uint64 at) external {
        _reinstate(caId, at);
    }

    function revokeRootCA(bytes32 caId, bytes32 reasonHash) external {
        _revoke(caId, reasonHash, 0);
    }

    function revokeRootCAAt(bytes32 caId, bytes32 reasonHash, uint64 at) external {
        _revoke(caId, reasonHash, at);
    }

    /// @notice Planlı rotasyon (review R2). Mevcut issuer'lar çalışmaya devam eder.
    function retireRootCA(bytes32 caId, bytes32 successorCA) external {
        _retire(caId, successorCA, 0);
    }

    function retireRootCAAt(bytes32 caId, bytes32 successorCA, uint64 at) external {
        _retire(caId, successorCA, at);
    }

    /// @inheritdoc IRootCARegistry
    function announceRootCARollover(bytes32 caId, bytes32 successorCA) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.ACTIVE) revert UnknownCA(caId);
        if (successorCA == caId || _cas[successorCA].status != CAStatus.ACTIVE) revert UnknownCA(successorCA);
        emit RootCARollingOver(caId, successorCA);
    }

    function _suspend(bytes32 caId, uint64 at) private {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.ACTIVE) revert UnknownCA(caId);
        _setStatus(caId, c, CAStatus.SUSPENDED, at);
        emit RootCASuspended(caId);
    }

    function _reinstate(bytes32 caId, uint64 at) private {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.SUSPENDED) revert UnknownCA(caId);
        _setStatus(caId, c, CAStatus.ACTIVE, at);
        emit RootCAReinstated(caId);
    }

    function _revoke(bytes32 caId, bytes32 reasonHash, uint64 at) private {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status == CAStatus.REVOKED) revert AlreadyRevoked(caId);
        _setStatus(caId, c, CAStatus.REVOKED, at);
        emit RootCARevoked(caId, reasonHash);
    }

    function _retire(bytes32 caId, bytes32 successorCA, uint64 at) private {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.ACTIVE) revert UnknownCA(caId);
        if (successorCA != bytes32(0) && _cas[successorCA].status != CAStatus.ACTIVE) {
            revert UnknownCA(successorCA);
        }
        _setStatus(caId, c, CAStatus.RETIRED, at);
        emit RootCARetired(caId, successorCA);
    }

    /// @dev ADR-0073 K1/K5: durum değişikliği `since` anından itibaren geçerli; geçmiş sıralı ve yalnız eklenir.
    function _setStatus(bytes32 caId, RootCA storage c, CAStatus st, uint64 at) private {
        uint64 since = _effectiveDate(at);
        _history[caId].record(since, uint8(st));
        c.status = st;
        emit RootCAStatusChanged(caId, st, since);
    }

    /// @dev CRL adresi değişebilir; parmak izi değişemez (CA1).
    function updateCrlURI(bytes32 caId, string calldata crlURI) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        c.crlURI = crlURI;
        emit RootCACrlUpdated(caId, crlURI);
    }

    /// @notice "Bu CA ile YENİ issuer kaydedilebilir mi?" — CA2 gereği geçmişi etkilemez.
    function isValidRootCA(bytes32 caId) external view returns (bool) {
        RootCA storage c = _cas[caId];
        return c.status == CAStatus.ACTIVE
            && block.timestamp >= c.validFrom
            && block.timestamp <= c.validUntil;
    }

    /// @notice ACTIVE veya RETIRED zincirler kabul edilir; SUSPENDED/REVOKED edilmez.
    function isChainAcceptable(bytes32 caId) external view returns (bool) {
        CAStatus st = _cas[caId].status;
        return st == CAStatus.ACTIVE || st == CAStatus.RETIRED;
    }

    /// @inheritdoc IRootCARegistry
    function isChainAcceptableAt(bytes32 caId, uint64 iat) external view returns (bool) {
        StatusHistory.Change[] storage h = _history[caId];
        if (h.ever(uint8(CAStatus.REVOKED))) return false; // CA2: ele geçirilme bütün altını düşürür
        return h.statusAt(iat) == uint8(CAStatus.ACTIVE); // yarı açık: askı/emeklilik anı ve sonrası ret
    }

    function rootCAStatusAt(bytes32 caId, uint64 t) external view returns (CAStatus) {
        return CAStatus(_history[caId].statusAt(t));
    }

    function rootCAStatusHistoryOf(bytes32 caId) external view returns (StatusHistory.Change[] memory) {
        return _history[caId];
    }

    function exists(bytes32 caId) external view returns (bool) {
        return _cas[caId].status != CAStatus.NONE;
    }

    function getRootCA(bytes32 caId) external view returns (RootCA memory) {
        RootCA memory c = _cas[caId];
        if (c.status == CAStatus.NONE) revert UnknownCA(caId);
        return c;
    }

    function getRootCAsByState(bytes2 stateCode) external view returns (bytes32[] memory) {
        return _byState[stateCode];
    }

    function _require(bytes32 caId) private view returns (RootCA storage c) {
        c = _cas[caId];
        if (c.status == CAStatus.NONE) revert UnknownCA(caId);
    }

    /// @dev SPEC-BC-0001 §3.1/§2/§6 `onlyOwnerState(_stateOf(id))`: delege denetimi + günlük kota (§12.2).
    function _requireOwner(bytes2 stateCode) private {
        _requireOwnerAndCount(stateCode);
    }
}
