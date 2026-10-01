// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {ICrossRecognition} from "../interfaces/ICrossRecognition.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

/**
 * @title  CrossRecognition
 * @notice Katman 3 — her devlet kendi tanıma politikasını TEK TARAFLI belirler.
 * @dev    SPEC-BC-0001 §5, ADR-0002 #3.
 *         Varsayılan: sonradan katılan devlet için tüm ilişkiler NONE (opt-in).
 *         Kurucular arası FULL, kurulumda `bootstrapFounders` ile yazılır.
 */
contract CrossRecognition is TamgaRegistryBase, ICrossRecognition {
    IIssuerRegistry public issuerRegistry;

    mapping(bytes2 => mapping(bytes2 => RecognitionPolicy)) private _policies;
    mapping(bytes2 => mapping(bytes32 => bool)) private _blocklist;

    uint256[46] private __gap;

    function initialize(address sovereignty_, address governance_, address issuerRegistry_)
        external
        initializer
    {
        __TamgaRegistryBase_init(sovereignty_, governance_);
        if (issuerRegistry_ == address(0)) revert ZeroAddress();
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
    }

    /// @notice Kurucular arası FULL tanıma — yalnızca Governance, bir kez.
    function bootstrapFounders(bytes2[] calldata founders) external onlyGovernance {
        for (uint256 i = 0; i < founders.length; i++) {
            for (uint256 j = 0; j < founders.length; j++) {
                if (i == j) continue;
                RecognitionPolicy storage p = _policies[founders[i]][founders[j]];
                p.recognizingState = founders[i];
                p.recognizedState = founders[j];
                p.mode = RecognitionMode.FULL;
                p.updatedAt = uint64(block.timestamp);
                emit RecognitionSet(founders[i], founders[j], RecognitionMode.FULL);
            }
        }
    }

    /**
     * @inheritdoc ICrossRecognition
     * @dev Çağıranın o devlet adına yazdığını `onlyOwnerState` garanti eder.
     */
    function setRecognition(
        bytes2 recognizingState,
        bytes2 recognizedState,
        RecognitionMode mode,
        IIssuerRegistry.IssuerCategory[] calldata categories
    ) external onlyOwnerState(recognizingState) {
        if (recognizingState == recognizedState) revert SelfRecognition();
        if (mode == RecognitionMode.CATEGORY_LIMITED && categories.length == 0) revert CategoriesRequired();
        if (mode != RecognitionMode.CATEGORY_LIMITED && categories.length != 0) revert CategoriesNotAllowed();

        RecognitionPolicy storage p = _policies[recognizingState][recognizedState];
        p.recognizingState = recognizingState;
        p.recognizedState = recognizedState;
        p.mode = mode;
        delete p.categories;
        for (uint256 i = 0; i < categories.length; i++) p.categories.push(categories[i]);
        p.updatedAt = uint64(block.timestamp);

        emit RecognitionSet(recognizingState, recognizedState, mode);
    }

    /// @inheritdoc ICrossRecognition
    function setIssuerBlocklist(bytes2 byState, bytes32 issuerId, bool blocked)
        external
        onlyOwnerState(byState)
    {
        _blocklist[byState][issuerId] = blocked;
        emit IssuerBlocklisted(byState, issuerId, blocked);
    }

    /// @inheritdoc ICrossRecognition
    function isRecognizedBy(bytes2 verifierState, bytes32 issuerId) external view returns (bool) {
        bytes2 issuerState = issuerRegistry.stateOf(issuerId);
        if (issuerState == bytes2(0)) return false;

        // Kendi devletinin issuer'ı her zaman tanınır.
        if (issuerState == verifierState) return !_blocklist[verifierState][issuerId];

        if (_blocklist[verifierState][issuerId]) return false;

        RecognitionPolicy storage p = _policies[verifierState][issuerState];
        if (p.mode == RecognitionMode.FULL) return true;
        if (p.mode == RecognitionMode.NONE) return false;

        IIssuerRegistry.IssuerCategory cat = issuerRegistry.getIssuer(issuerId).category;
        for (uint256 i = 0; i < p.categories.length; i++) {
            if (p.categories[i] == cat) return true;
        }
        return false;
    }

    function getPolicy(bytes2 recognizingState, bytes2 recognizedState)
        external view returns (RecognitionPolicy memory)
    {
        return _policies[recognizingState][recognizedState];
    }
}
