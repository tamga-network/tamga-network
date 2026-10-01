// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IRootCARegistry} from "../interfaces/IRootCARegistry.sol";

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
 */
contract RootCARegistry is TamgaRegistryBase, IRootCARegistry {
    mapping(bytes32 => RootCA) private _cas;
    mapping(bytes2 => bytes32[]) private _byState;

    uint256[47] private __gap;

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
        if (data.validUntil <= data.validFrom) revert InvalidValidity(data.validFrom, data.validUntil);

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
        c.validFrom = data.validFrom == 0 ? uint64(block.timestamp) : data.validFrom;
        c.validUntil = data.validUntil;
        c.registeredAt = uint64(block.timestamp);

        _byState[data.stateCode].push(caId);
        emit RootCARegistered(caId, data.stateCode, data.certFingerprint);
    }

    function suspendRootCA(bytes32 caId) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.ACTIVE) revert UnknownCA(caId);
        c.status = CAStatus.SUSPENDED;
        emit RootCASuspended(caId);
    }

    function reinstateRootCA(bytes32 caId) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.SUSPENDED) revert UnknownCA(caId);
        c.status = CAStatus.ACTIVE;
        emit RootCAReinstated(caId);
    }

    function revokeRootCA(bytes32 caId, string calldata reason) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status == CAStatus.REVOKED) revert AlreadyRevoked(caId);
        c.status = CAStatus.REVOKED;
        emit RootCARevoked(caId, reason);
    }

    /// @notice Planlı rotasyon (review R2). Mevcut issuer'lar çalışmaya devam eder.
    function retireRootCA(bytes32 caId, bytes32 successorCA) external {
        RootCA storage c = _require(caId);
        _requireOwner(c.stateCode);
        if (c.status != CAStatus.ACTIVE) revert UnknownCA(caId);
        if (successorCA != bytes32(0) && _cas[successorCA].status != CAStatus.ACTIVE) {
            revert UnknownCA(successorCA);
        }
        c.status = CAStatus.RETIRED;
        emit RootCARetired(caId, successorCA);
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

    function _requireOwner(bytes2 stateCode) private view {
        if (!sovereignty.isDelegateOf(msg.sender, stateCode)) revert NotOwnerState(stateCode, msg.sender);
    }
}
