// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IRelyingPartyRegistry} from "../interfaces/IRelyingPartyRegistry.sol";

/**
 * @title  RelyingPartyRegistry
 * @notice Katman 2 — doğrulayıcı (verifier) kayıtları ve aşırı-talep koruması.
 * @dev    SPEC-BC-0001 §6.
 *
 *         Cüzdan, credential sunmadan ÖNCE (1) RP kayıtlı ve aktif mi,
 *         (2) talep edilen scope'a yetkili mi kontrol eder. Yetkisiz talepte
 *         kullanıcı uyarılır — protokol seviyesinde veri minimizasyonu.
 *
 *         AÇIK KONU (SPEC-BC-0001 §14.3): scope'lar kaba granülaritede
 *         ("education"). schemaId kümesine bağlamak daha kesin olurdu ama her
 *         yeni şemada her RP'nin güncellenmesini gerektirirdi.
 */
contract RelyingPartyRegistry is TamgaRegistryBase, IRelyingPartyRegistry {
    uint256 public constant MAX_SCOPES = 32;

    mapping(bytes32 => RelyingParty) private _rps;
    mapping(bytes32 => mapping(bytes32 => bool)) private _scopeSet;
    mapping(bytes2 => bytes32[]) private _byState;

    uint256[46] private __gap;

    function initialize(address sovereignty_, address governance_) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
    }

    function registerRelyingParty(RelyingParty calldata data) external onlyOwnerState(data.stateCode) {
        if (data.status != RPStatus.ACTIVE) revert MustRegisterAsActive();
        if (data.allowedScopes.length > MAX_SCOPES) {
            revert TooManyScopes(data.allowedScopes.length, MAX_SCOPES);
        }
        bytes32 rpId = keccak256(abi.encodePacked(data.stateCode, data.accessCertFingerprint));
        if (_rps[rpId].status != RPStatus.NONE) revert RPExists(rpId);

        RelyingParty storage r = _rps[rpId];
        r.rpId = rpId;
        r.stateCode = data.stateCode;
        r.nameHash = data.nameHash;
        r.accessCertFingerprint = data.accessCertFingerprint;
        r.status = RPStatus.ACTIVE;
        r.registeredAt = uint64(block.timestamp);
        for (uint256 i = 0; i < data.allowedScopes.length; i++) {
            r.allowedScopes.push(data.allowedScopes[i]);
            _scopeSet[rpId][data.allowedScopes[i]] = true;
        }

        _byState[data.stateCode].push(rpId);
        emit RelyingPartyRegistered(rpId, data.stateCode);
    }

    function updateScope(bytes32 rpId, bytes32[] calldata newScopes) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (newScopes.length > MAX_SCOPES) revert TooManyScopes(newScopes.length, MAX_SCOPES);

        for (uint256 i = 0; i < r.allowedScopes.length; i++) _scopeSet[rpId][r.allowedScopes[i]] = false;
        delete r.allowedScopes;
        for (uint256 i = 0; i < newScopes.length; i++) {
            r.allowedScopes.push(newScopes[i]);
            _scopeSet[rpId][newScopes[i]] = true;
        }
        emit ScopeUpdated(rpId, newScopes.length);
    }

    function suspendRelyingParty(bytes32 rpId) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        r.status = RPStatus.SUSPENDED;
        emit RelyingPartySuspended(rpId);
    }

    function revokeRelyingParty(bytes32 rpId) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        r.status = RPStatus.REVOKED;
        emit RelyingPartyRevoked(rpId);
    }

    function isValidRelyingParty(bytes32 rpId) external view returns (bool) {
        return _rps[rpId].status == RPStatus.ACTIVE;
    }

    function hasScope(bytes32 rpId, bytes32 scope) external view returns (bool) {
        if (_rps[rpId].status != RPStatus.ACTIVE) return false;
        return _scopeSet[rpId][scope];
    }

    function getRelyingParty(bytes32 rpId) external view returns (RelyingParty memory) {
        RelyingParty memory r = _rps[rpId];
        if (r.status == RPStatus.NONE) revert UnknownRP(rpId);
        return r;
    }

    function _require(bytes32 rpId) private view returns (RelyingParty storage r) {
        r = _rps[rpId];
        if (r.status == RPStatus.NONE) revert UnknownRP(rpId);
    }

    function _requireOwner(bytes2 stateCode) private view {
        if (!sovereignty.isDelegateOf(msg.sender, stateCode)) revert NotOwnerState(stateCode, msg.sender);
    }
}
