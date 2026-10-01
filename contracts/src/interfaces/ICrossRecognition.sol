// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {IIssuerRegistry} from "./IIssuerRegistry.sol";

/// @title ICrossRecognition — SPEC-BC-0001 §5
interface ICrossRecognition is ITamgaErrors {
    enum RecognitionMode {NONE, FULL, CATEGORY_LIMITED}

    struct RecognitionPolicy {
        bytes2 recognizingState;
        bytes2 recognizedState;
        RecognitionMode mode;
        IIssuerRegistry.IssuerCategory[] categories;
        uint64 updatedAt;
    }

    event RecognitionSet(bytes2 indexed recognizingState, bytes2 indexed recognizedState, RecognitionMode mode);
    event IssuerBlocklisted(bytes2 indexed byState, bytes32 indexed issuerId, bool blocked);

    error SelfRecognition();
    error CategoriesRequired();
    error CategoriesNotAllowed();

    /// @dev recognizingState AÇIKÇA parametredir: delege anahtarı hangi devlet
    ///      adına yazdığını beyan eder, `onlyOwnerState` de onu doğrular.
    function setRecognition(
        bytes2 recognizingState,
        bytes2 recognizedState,
        RecognitionMode mode,
        IIssuerRegistry.IssuerCategory[] calldata categories
    ) external;

    function setIssuerBlocklist(bytes2 byState, bytes32 issuerId, bool blocked) external;

    function isRecognizedBy(bytes2 verifierState, bytes32 issuerId) external view returns (bool);
    function getPolicy(bytes2 recognizingState, bytes2 recognizedState)
        external view returns (RecognitionPolicy memory);
}
