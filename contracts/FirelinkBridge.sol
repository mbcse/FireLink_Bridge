// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.15;

// import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IFlareRelayer } from "./IFlareRelayer.sol";
import { FirelinkMintableERC20 } from './FirelinkMintableERC20.sol';
import { IFirelinkMintableERC20, ILegacyMintableERC20 } from './IFirelinkMintableERC20.sol';
import { IEVMTransactionVerification } from "@flarenetwork/flare-periphery-contracts/coston/stateConnector/interface/IEVMTransactionVerification.sol";
import { EVMTransaction } from "@flarenetwork/flare-periphery-contracts/coston/stateConnector/interface/EVMTransaction.sol";
import { FlareContractsRegistryLibrary } from "@flarenetwork/flare-periphery-contracts/coston/util-contracts/ContractRegistryLibrary.sol";

contract FirelinkBridge is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint32 internal constant RECEIVE_DEFAULT_GAS_LIMIT = 200_000;

    IFlareRelayer public  MESSENGER;
    FirelinkBridge public  OTHER_BRIDGE;
    TransactionInfo[] public transactions;

    address private spacer_0_2_20;
    address private spacer_1_0_20;
    mapping(address => mapping(address => uint256)) public deposits;

    uint256[47] private __gap;

    IFirelinkMintableERC20 ethContract;
    
    
    event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData);
    event ETHBridgeFinalized(address indexed from, address indexed to, uint256 amount, bytes extraData);
    event ERC20BridgeInitiated(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData);
    event ERC20BridgeFinalized(address indexed localToken, address indexed remoteToken, address indexed from, address to, uint256 amount, bytes extraData);

    
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address payable _messenger, address payable _otherBridge) initializer public {
        // __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        MESSENGER = IFlareRelayer(_messenger);
        OTHER_BRIDGE = FirelinkBridge(_otherBridge);
        super.transferOwnership(initialOwner);
    }

   

    // function pause() public onlyOwner {
    //     _pause();
    // }

    // function unpause() public onlyOwner {
    //     _unpause();
    // }

    modifier onlyEOA() {
        require(!Address.isContract(msg.sender), "FirelinkBridge: function can only be called from an EOA");
        _;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    receive() external payable {

    }


    function setEthERC20ContractAddress(address _ethAddress) public onlyOwner {
        ethContract = IFirelinkMintableERC20(_ethAddress);
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
        // onlyOtherBridge
    {
        // require(paused() == false, "FirelinkBridge: paused");
        require(msg.value == _amount, "FirelinkBridge: amount sent does not match amount required");
        require(_to != address(this), "FirelinkBridge: cannot send to self");
        require(_to != address(MESSENGER), "FirelinkBridge: cannot send to messenger");
        _emitETHBridgeFinalized(_from, _to, _amount, _extraData);

        bool success = call(_to, gasleft(), _amount, hex"");
        require(success, "FirelinkBridge: ETH transfer failed");
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
        // onlyOtherBridge
    {
        // require(paused() == false, "FirelinkBridge: paused");
        if (_isFirelinkMintableERC20(_localToken)) {
            require(
                _isCorrectTokenPair(_localToken, _remoteToken),
                "FirelinkBridge: wrong remote token for Firelink Mintable ERC20 local token"
            );

            FirelinkMintableERC20(_localToken).mint(_to, _amount);
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
        require(msg.value == _amount, "FirelinkBridge: bridging ETH must include sufficient ETH value");

        _emitETHBridgeInitiated(_from, _to, _amount, _extraData);
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
        if (_isFirelinkMintableERC20(_localToken)) {
            require(
                _isCorrectTokenPair(_localToken, _remoteToken),
                "FirelinkBridge: wrong remote token for Firelink Mintable ERC20 local token"
            );

            FirelinkMintableERC20(_localToken).burn(_from, _amount);
        } else {
            IERC20(_localToken).safeTransferFrom(_from, address(this), _amount);
            deposits[_localToken][_remoteToken] = deposits[_localToken][_remoteToken] + _amount;
        }

        _emitERC20BridgeInitiated(_localToken, _remoteToken, _from, _to, _amount, _extraData);

        // MESSENGER.sendMessage(
        //     address(OTHER_BRIDGE),
        //     abi.encodeWithSelector(
        //         this.finalizeBridgeERC20.selector,
        //         _remoteToken,
        //         _localToken,
        //         _from,
        //         _to,
        //         _amount,
        //         _extraData
        //     ),
        //     _minGasLimit
        // );
    }

    function _isFirelinkMintableERC20(address _token) internal view returns (bool) {
        return ERC165Checker.supportsInterface(_token, type(ILegacyMintableERC20).interfaceId) ||
            ERC165Checker.supportsInterface(_token, type(IFirelinkMintableERC20).interfaceId);
    }

    function _isCorrectTokenPair(address _mintableToken, address _otherToken) internal view returns (bool) {
        if (ERC165Checker.supportsInterface(_mintableToken, type(ILegacyMintableERC20).interfaceId)) {
            return _otherToken == ILegacyMintableERC20(_mintableToken).l1Token();
        } else {
            return _otherToken == IFirelinkMintableERC20(_mintableToken).remoteToken();
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

    function call(address _target, uint256 _gas, uint256 _value, bytes memory _calldata) internal returns (bool) {
        bool _success;
        assembly {
            _success :=
                call(
                    _gas, // gas
                    _target, // recipient
                    _value, // ether value
                    add(_calldata, 32), // inloc
                    mload(_calldata), // inlen
                    0, // outloc
                    0 // outlen
                )
        }
        return _success;
    }

    struct EventInfo {
        address sender;
        address receiver;
        uint256 value;
        bytes data;
    }

    struct TransactionInfo {
        EVMTransaction.Proof originalTransaction;
        uint256 eventNumber;
        EventInfo[] eventInfo;
    }

    function isEVMTransactionProofValid(
        EVMTransaction.Proof calldata transaction
    ) public view returns (bool) {
        return FlareContractsRegistryLibrary
                .auxiliaryGetIEVMTransactionVerification()
                .verifyEVMTransaction(transaction);
    }

    function FinalizeBridgeAndReleaseEth(EVMTransaction.Proof calldata _transaction) external {
        require(isEVMTransactionProofValid(_transaction), "Invalid transaction proof");

        uint256 transactionIndex = transactions.length;
        transactions.push();
        transactions[transactionIndex].originalTransaction = _transaction;
        transactions[transactionIndex].eventNumber = _transaction.data.responseBody.events.length;
        EventInfo[] storage eventInfo = transactions[transactionIndex].eventInfo;
        for(uint256 i = 0; i < _transaction.data.responseBody.events.length; i++) {
            (address sender, address receiver, uint256 value, bytes memory data) = abi.decode(_transaction.data.responseBody.events[i].data, (address, address, uint256, bytes));
            eventInfo.push(EventInfo({
                sender: sender,
                receiver: receiver,
                value: value,
                data: data
            }));
        }

        ethContract.mint(eventInfo[0].receiver, eventInfo[0].value);
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getAllTransactions() external view returns (TransactionInfo[] memory) {
        TransactionInfo[] memory result = new TransactionInfo[](transactions.length);
        for(uint256 i = 0; i < transactions.length; i++) {
            result[i] = transactions[i];
        }
        return result;
    }

}