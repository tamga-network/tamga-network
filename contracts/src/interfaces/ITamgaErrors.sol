// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title  ITamgaErrors
 * @notice Birden çok arayüzün paylaştığı hatalar tek yerde durur.
 * @dev    Aynı error'ü iki ayrı arayüzde tanımlarsan, ikisini birden kalıtan
 *         bir kontrat DERLENMEZ ("Identifier already declared"). Bu dosya o
 *         tuzağı kapatır — yeni bir paylaşılan hata buraya eklenir.
 */
interface ITamgaErrors {
    error ZeroAddress();
    error EmptyContentHash();
    error NotOwnerState(bytes2 stateCode, address caller);
    error QuotaExceeded(bytes2 stateCode, uint32 limit);
    error NotGovernance(address caller);

    // --- Birden çok registry'nin paylaştığı yaşam döngüsü hataları ---
    error MustRegisterAsActive();
    error AlreadyRevoked(bytes32 id);
    error SuccessorNotActive(bytes32 successorId);
    error InvalidValidity(uint64 validFrom, uint64 validUntil);
    error TooManyDelegates(uint256 count, uint256 max);
}
