// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract RemittancePayment is AccessControl, ReentrancyGuard, Pausable, Ownable {
    struct Payment {
        address sender;
        address recipient;
        uint256 amount;
        bool claimed;
        uint256 expiration;
    }

    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    uint256 public constant MIN_PAYMENT_AMOUNT = 1e16; // 0.01 ETH
    uint256 public constant MAX_PAYMENT_AMOUNT = 1e20; // 100 ETH
    uint256 public constant PAYMENT_DURATION = 7 days;
    uint256 public feePercentage = 1; // 1% fee

    mapping(bytes32 => Payment) public payments;
    mapping(address => uint256) public balances;
    mapping(string => address) public currencyOracles;

    event PaymentSent(bytes32 indexed paymentId, address indexed sender, address indexed recipient, uint256 amount);
    event PaymentClaimed(bytes32 indexed paymentId, address indexed recipient, uint256 amount);
    event CurrencyOracleUpdated(string indexed currency, address indexed oracleAddress);
    event FeePercentageUpdated(uint256 newFeePercentage);

    error InvalidPaymentAmount(uint256 amount);
    error UnsupportedCurrency(string currency);
    error InvalidExchangeRate();
    error InvalidOracleAddress();
    error UnauthorizedAccess();

    constructor() {
        _setupRole(OWNER_ROLE, msg.sender);
    }

    function sendPayment(address _recipient, bytes32 _paymentId, string memory _currency, uint256 _amount) external payable whenNotPaused nonReentrant {
        if (payments[_paymentId].sender != address(0)) revert("Payment ID already exists");
        if (_amount < MIN_PAYMENT_AMOUNT || _amount > MAX_PAYMENT_AMOUNT) revert InvalidPaymentAmount(_amount);
        if (msg.value < _amount) revert("Insufficient payment amount");
        if (currencyOracles[_currency] == address(0)) revert UnsupportedCurrency(_currency);

        uint256 exchangeRate = getExchangeRate(_currency);
        uint256 nativeAmount = (_amount * 1 ether) / exchangeRate;

        uint256 fee = (nativeAmount * feePercentage) / 100;
        uint256 remainingAmount = nativeAmount - fee;

        unchecked {
            balances[owner()] += fee;
        }

        payments[_paymentId] = Payment(msg.sender, _recipient, remainingAmount, false, block.timestamp + PAYMENT_DURATION);

        emit PaymentSent(_paymentId, msg.sender, _recipient, remainingAmount);
    }

    function claimPayment(bytes32 _paymentId) external whenNotPaused nonReentrant {
        Payment storage payment = payments[_paymentId];
        if (payment.recipient != msg.sender) revert("Only the recipient can claim the payment");
        if (payment.claimed) revert("Payment has already been claimed");
        if (block.timestamp > payment.expiration) revert("Payment has expired");

        payment.claimed = true;

        unchecked {
            balances[msg.sender] += payment.amount;
        }

        emit PaymentClaimed(_paymentId, msg.sender, payment.amount);
    }

    function getExchangeRate(string memory _currency) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(currencyOracles[_currency]);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        if (price <= 0) revert InvalidExchangeRate();
        return uint256(price);
    }

    function setCurrencyOracle(string memory _currency, address _oracleAddress) external onlyRole(OWNER_ROLE) {
        if (_oracleAddress == address(0)) revert InvalidOracleAddress();
        currencyOracles[_currency] = _oracleAddress;
        emit CurrencyOracleUpdated(_currency, _oracleAddress);
    }

    function setFeePercentage(uint256 _newFeePercentage) external onlyRole(OWNER_ROLE) {
        if (_newFeePercentage > 100) revert("Fee percentage cannot exceed 100%");
        feePercentage = _newFeePercentage;
        emit FeePercentageUpdated(_newFeePercentage);
    }

    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    function withdraw(uint256 _amount) external onlyRole(OWNER_ROLE) nonReentrant {
        if (balances[owner()] < _amount) revert("Insufficient balance");
        
        unchecked {
            balances[owner()] -= _amount;
        }
        
        (bool success, ) = payable(owner()).call{value: _amount}("");
        if (!success) revert("Withdrawal failed");
    }
}