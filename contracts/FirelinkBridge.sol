// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCall } from "src/libraries/SafeCall.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IFlareRelayer } from "./IFlareRelayer.sol";

contract FireLinkBridge is Initializable {
    using SafeERC20 for IERC20;

    uint32 internal constant RECEIVE_DEFAULT_GAS_LIMIT = 200_000;

    IFlareRealyer public immutable MESSENGER;

    StandardBridge public immutable OTHER_BRIDGE;


    address private spacer_0_2_20;

    address private spacer_1_0_20;

    mapping(address => mapping(address => uint256)) public deposits;


    uint256[47] private __gap;

    event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData);

    event ETHBridgeFinalized(address indexed from, address indexed to, uint256 amount, bytes extraData);

    event ERC20BridgeInitiated(
        address indexed localToken,
        address indexed remoteToken,
        address indexed from,
        address to,
        uint256 amount,
        bytes extraData
    );


    event ERC20BridgeFinalized(
        address indexed localToken,
        address indexed remoteToken,
        address indexed from,
        address to,
        uint256 amount,
        bytes extraData
    );


    modifier onlyEOA() {
        require(!Address.isContract(msg.sender), "FireLinkBridge: function can only be called from an EOA");
        _;
    }

    modifier onlyOtherBridge() {
        require(
            msg.sender == address(MESSENGER) && MESSENGER.xDomainMessageSender() == address(OTHER_BRIDGE),
            "FireLinkBridge: function can only be called from the other bridge"
        );
        _;
    }

    function initialize(address payable _messenger, address payable _otherBridge) public initializer {
        MESSENGER = IFlareRelayer(_messenger);
        OTHER_BRIDGE = StandardBridge(_otherBridge);
    }

    receive() external payable virtual;


    function messenger() external view returns (CrossDomainMessenger) {
        return MESSENGER;
    }


    function otherBridge() external view returns (StandardBridge) {
        return OTHER_BRIDGE;
    }

    function paused() public view virtual returns (bool) {
        return false;
    }

    function bridgeETH(uint32 _minGasLimit, bytes calldata _extraData) public payable onlyEOA {
        _initiateBridgeETH(msg.sender, msg.sender, msg.value, _minGasLimit, _extraData);
    }

    function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) public payable {
        _initiateBridgeETH(msg.sender, _to, msg.value, _minGasLimit, _extraData);
    }


    function bridgeERC20(
        address _localToken,
        address _remoteToken,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes calldata _extraData
    )
        public
        virtual
        onlyEOA
    {
        _initiateBridgeERC20(_localToken, _remoteToken, msg.sender, msg.sender, _amount, _minGasLimit, _extraData);
    }


    function bridgeERC20To(
        address _localToken,
        address _remoteToken,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes calldata _extraData
    )
        public
        virtual
    {
        _initiateBridgeERC20(_localToken, _remoteToken, msg.sender, _to, _amount, _minGasLimit, _extraData);
    }

    function finalizeBridgeETH(
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _extraData
    )
        public
        payable
        onlyOtherBridge
    {
        require(paused() == false, "FireLinkBridge: paused");
        require(msg.value == _amount, "FireLinkBridge: amount sent does not match amount required");
        require(_to != address(this), "FireLinkBridge: cannot send to self");
        require(_to != address(MESSENGER), "FireLinkBridge: cannot send to messenger");
\
        _emitETHBridgeFinalized(_from, _to, _amount, _extraData);

        bool success = SafeCall.call(_to, gasleft(), _amount, hex"");
        require(success, "FireLinkBridge: ETH transfer failed");
    }

    function finalizeBridgeERC20(
        address _localToken,
        address _remoteToken,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _extraData
    )
        public
        onlyOtherBridge
    {
        require(paused() == false, "FireLinkBridge: paused");
        if (_isOptimismMintableERC20(_localToken)) {
            require(
                _isCorrectTokenPair(_localToken, _remoteToken),
                "FireLinkBridge: wrong remote token for Optimism Mintable ERC20 local token"
            );

            OptimismMintableERC20(_localToken).mint(_to, _amount);
        } else {
            deposits[_localToken][_remoteToken] = deposits[_localToken][_remoteToken] - _amount;
            IERC20(_localToken).safeTransfer(_to, _amount);
        }


        _emitERC20BridgeFinalized(_localToken, _remoteToken, _from, _to, _amount, _extraData);
    }

    function _initiateBridgeETH(
        address _from,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes memory _extraData
    )
        internal
    {
        require(msg.value == _amount, "FireLinkBridge: bridging ETH must include sufficient ETH value");


        _emitETHBridgeInitiated(_from, _to, _amount, _extraData);

        MESSENGER.sendMessage{ value: _amount }(
            address(OTHER_BRIDGE),
            abi.encodeWithSelector(this.finalizeBridgeETH.selector, _from, _to, _amount, _extraData),
            _minGasLimit
        );
    }


    function _initiateBridgeERC20(
        address _localToken,
        address _remoteToken,
        address _from,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes memory _extraData
    )
        internal
    {
        if (_isOptimismMintableERC20(_localToken)) {
            require(
                _isCorrectTokenPair(_localToken, _remoteToken),
                "FireLinkBridge: wrong remote token for Optimism Mintable ERC20 local token"
            );

            OptimismMintableERC20(_localToken).burn(_from, _amount);
        } else {
            IERC20(_localToken).safeTransferFrom(_from, address(this), _amount);
            deposits[_localToken][_remoteToken] = deposits[_localToken][_remoteToken] + _amount;
        }

        _emitERC20BridgeInitiated(_localToken, _remoteToken, _from, _to, _amount, _extraData);

        MESSENGER.sendMessage(
            address(OTHER_BRIDGE),
            abi.encodeWithSelector(
                this.finalizeBridgeERC20.selector,

                _remoteToken,
                _localToken,
                _from,
                _to,
                _amount,
                _extraData
            ),
            _minGasLimit
        );
    }


    function _isOptimismMintableERC20(address _token) internal view returns (bool) {
        return ERC165Checker.supportsInterface(_token, type(ILegacyMintableERC20).interfaceId)
            || ERC165Checker.supportsInterface(_token, type(IOptimismMintableERC20).interfaceId);
    }

    function _isCorrectTokenPair(address _mintableToken, address _otherToken) internal view returns (bool) {
        if (ERC165Checker.supportsInterface(_mintableToken, type(ILegacyMintableERC20).interfaceId)) {
            return _otherToken == ILegacyMintableERC20(_mintableToken).l1Token();
        } else {
            return _otherToken == IOptimismMintableERC20(_mintableToken).remoteToken();
        }
    }


    function _emitETHBridgeInitiated(
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _extraData
    )
        internal
        virtual
    {
        emit ETHBridgeInitiated(_from, _to, _amount, _extraData);
    }

    function _emitETHBridgeFinalized(
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _extraData
    )
        internal
        virtual
    {
        emit ETHBridgeFinalized(_from, _to, _amount, _extraData);
    }


    function _emitERC20BridgeInitiated(
        address _localToken,
        address _remoteToken,
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _extraData
    )
        internal
        virtual
    {
        emit ERC20BridgeInitiated(_localToken, _remoteToken, _from, _to, _amount, _extraData);
    }


    function _emitERC20BridgeFinalized(
        address _localToken,
        address _remoteToken,
        address _from,
        address _to,
        uint256 _amount,
        bytes memory _extraData
    )
        internal
        virtual
    {
        emit ERC20BridgeFinalized(_localToken, _remoteToken, _from, _to, _amount, _extraData);
    }
}