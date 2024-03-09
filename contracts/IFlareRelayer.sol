// SPDX-License-Identifier: MIT

pragma solidity ^0.8.15;

interface IFlareRelayer {
    function requestRelay(address _relayTarget, bytes memory _additionalCalldata, address _sourceToken, uint256 _amount) external;
}