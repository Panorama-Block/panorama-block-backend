// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ValidatedLending
 * @notice Contrato que combina validação de taxa + operações de lending do Benqi em uma única transação
 * @dev Reduz de 2 assinaturas para 1, melhora UX e economiza gas
 */

interface IValidation {
    function payAndValidate() external payable;
    function getTaxRate() external view returns (uint256);
}

interface IBenqiQToken {
    function mint() external payable returns (uint256);
    function mint(uint256 mintAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ValidatedLending {

    // ========== STATE VARIABLES ==========

    address public immutable validationContract;
    address public owner;

    // ========== EVENTS ==========

    event ValidatedSupply(address indexed user, address indexed qToken, uint256 amount, uint256 taxPaid);
    event ValidatedBorrow(address indexed user, address indexed qToken, uint256 amount, uint256 taxPaid);
    event ValidatedRepay(address indexed user, address indexed qToken, uint256 amount, uint256 taxPaid);
    event ValidatedWithdraw(address indexed user, address indexed qToken, uint256 amount, uint256 taxPaid);

    // ========== ERRORS ==========

    error InvalidAmount();
    error ValidationFailed();
    error SupplyFailed();
    error BorrowFailed();
    error RepayFailed();
    error WithdrawFailed();
    error Unauthorized();
    error TransferFailed();

    // ========== MODIFIERS ==========

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ========== CONSTRUCTOR ==========

    constructor(address _validationContract) {
        validationContract = _validationContract;
        owner = msg.sender;
    }

    // ========== MAIN FUNCTIONS ==========

    /**
     * @notice Executa validação + supply de AVAX em uma única transação
     * @param qTokenAddress Endereço do qToken Benqi (ex: qAVAX)
     * @dev User envia valor total, contrato divide entre taxa e supply
     */
    function validateAndSupplyAVAX(address qTokenAddress) external payable {
        if (msg.value == 0) revert InvalidAmount();

        // Obtém taxa do contrato de validação
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        uint256 taxAmount = (msg.value * taxRate) / 100;
        uint256 supplyAmount = msg.value - taxAmount;

        // 1. Paga validação
        (bool validationSuccess, ) = validationContract.call{value: taxAmount}("");
        if (!validationSuccess) revert ValidationFailed();

        // 2. Executa supply no Benqi
        IBenqiQToken qToken = IBenqiQToken(qTokenAddress);
        uint256 result = qToken.mint{value: supplyAmount}();
        if (result != 0) revert SupplyFailed();

        emit ValidatedSupply(msg.sender, qTokenAddress, supplyAmount, taxAmount);
    }

    /**
     * @notice Executa validação + supply de token ERC20 em uma única transação
     * @param qTokenAddress Endereço do qToken Benqi (ex: qUSDC)
     * @param amount Quantidade do token a fazer supply
     * @dev User precisa ter aprovado este contrato antes
     */
    function validateAndSupplyERC20(address qTokenAddress, uint256 amount) external payable {
        if (amount == 0) revert InvalidAmount();

        // Obtém taxa do contrato de validação
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        uint256 taxAmount = (msg.value * taxRate) / 100;

        // 1. Paga validação com AVAX
        if (msg.value > 0) {
            (bool validationSuccess, ) = validationContract.call{value: taxAmount}("");
            if (!validationSuccess) revert ValidationFailed();
        }

        // 2. Transfer tokens do user para este contrato
        // (User precisa ter dado approve antes)
        IERC20 token = IERC20(getUnderlyingToken(qTokenAddress));
        bool transferSuccess = token.transferFrom(msg.sender, address(this), amount);
        if (!transferSuccess) revert TransferFailed();

        // 3. Aprova qToken para gastar os tokens
        token.approve(qTokenAddress, amount);

        // 4. Executa supply
        IBenqiQToken qToken = IBenqiQToken(qTokenAddress);
        uint256 result = qToken.mint(amount);
        if (result != 0) revert SupplyFailed();

        emit ValidatedSupply(msg.sender, qTokenAddress, amount, taxAmount);
    }

    /**
     * @notice Executa validação + borrow em uma única transação
     * @param qTokenAddress Endereço do qToken Benqi
     * @param borrowAmount Quantidade a emprestar
     */
    function validateAndBorrow(address qTokenAddress, uint256 borrowAmount) external payable {
        if (msg.value == 0 || borrowAmount == 0) revert InvalidAmount();

        // Obtém taxa do contrato de validação
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        uint256 taxAmount = (msg.value * taxRate) / 100;

        // 1. Paga validação
        (bool validationSuccess, ) = validationContract.call{value: taxAmount}("");
        if (!validationSuccess) revert ValidationFailed();

        // 2. Executa borrow
        IBenqiQToken qToken = IBenqiQToken(qTokenAddress);
        uint256 result = qToken.borrow(borrowAmount);
        if (result != 0) revert BorrowFailed();

        emit ValidatedBorrow(msg.sender, qTokenAddress, borrowAmount, taxAmount);
    }

    /**
     * @notice Executa validação + repay de empréstimo em uma única transação
     * @param qTokenAddress Endereço do qToken Benqi
     * @param repayAmount Quantidade a pagar
     */
    function validateAndRepayAVAX(address qTokenAddress, uint256 repayAmount) external payable {
        if (msg.value == 0) revert InvalidAmount();

        // Obtém taxa do contrato de validação
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        uint256 taxAmount = (msg.value * taxRate) / 100;
        uint256 effectiveRepayAmount = msg.value - taxAmount;

        // 1. Paga validação
        (bool validationSuccess, ) = validationContract.call{value: taxAmount}("");
        if (!validationSuccess) revert ValidationFailed();

        // 2. Executa repay
        IBenqiQToken qToken = IBenqiQToken(qTokenAddress);
        uint256 result = qToken.repayBorrow{value: effectiveRepayAmount}(repayAmount);
        if (result != 0) revert RepayFailed();

        emit ValidatedRepay(msg.sender, qTokenAddress, effectiveRepayAmount, taxAmount);
    }

    /**
     * @notice Executa validação + withdraw em uma única transação
     * @param qTokenAddress Endereço do qToken Benqi
     * @param redeemAmount Quantidade a sacar
     */
    function validateAndWithdraw(address qTokenAddress, uint256 redeemAmount) external payable {
        if (msg.value == 0 || redeemAmount == 0) revert InvalidAmount();

        // Obtém taxa do contrato de validação
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        uint256 taxAmount = (msg.value * taxRate) / 100;

        // 1. Paga validação
        (bool validationSuccess, ) = validationContract.call{value: taxAmount}("");
        if (!validationSuccess) revert ValidationFailed();

        // 2. Executa withdraw
        IBenqiQToken qToken = IBenqiQToken(qTokenAddress);
        uint256 result = qToken.redeemUnderlying(redeemAmount);
        if (result != 0) revert WithdrawFailed();

        emit ValidatedWithdraw(msg.sender, qTokenAddress, redeemAmount, taxAmount);
    }

    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Retorna o token underlying de um qToken
     * @dev Função placeholder - implementação real requer interface do qToken
     */
    function getUnderlyingToken(address qTokenAddress) internal pure returns (address) {
        // TODO: Implementar lógica para obter underlying token
        // Por enquanto retorna o próprio endereço como placeholder
        return qTokenAddress;
    }

    /**
     * @notice Calcula quanto será pago de taxa dado um amount
     * @param amount Valor total
     * @return taxAmount Valor da taxa
     * @return netAmount Valor líquido após taxa
     */
    function calculateTax(uint256 amount) external view returns (uint256 taxAmount, uint256 netAmount) {
        uint256 taxRate = IValidation(validationContract).getTaxRate();
        taxAmount = (amount * taxRate) / 100;
        netAmount = amount - taxAmount;
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Permite owner sacar qualquer AVAX preso no contrato
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Permite owner sacar qualquer ERC20 preso no contrato
     */
    function emergencyWithdrawERC20(address token) external onlyOwner {
        IERC20 erc20 = IERC20(token);
        uint256 balance = erc20.balanceOf(address(this));
        bool success = erc20.transferFrom(address(this), owner, balance);
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Transfere ownership do contrato
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        owner = newOwner;
    }

    // ========== FALLBACK ==========

    receive() external payable {}
}
