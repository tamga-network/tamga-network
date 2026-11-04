// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title ISovereignty — `onlyOwnerState` yetkisinin tek kaynağı (SPEC-BC-0001 §0)
/// @dev   Governance bu arayüzü uygular. Registry'ler yalnızca sorar.
interface ISovereignty {
    function isDelegateOf(address account, bytes2 stateCode) external view returns (bool);
    function isActiveMember(bytes2 stateCode) external view returns (bool);
}
