"use client";
import React, { useState, useEffect } from 'react';
import { useStakingApi, StakingPosition, StakingTransaction } from '../lib/staking-api';

export default function StakingComponent() {
  const { apiClient, isConnected, userAddress } = useStakingApi();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dados do usuário
  const [position, setPosition] = useState<StakingPosition | null>(null);
  const [protocolInfo, setProtocolInfo] = useState<any>(null);
  
  // Formulários
  const [stakeAmount, setStakeAmount] = useState('0.001');
  const [unstakeAmount, setUnstakeAmount] = useState('0.001');
  
  // Transações pendentes
  const [pendingTransaction, setPendingTransaction] = useState<StakingTransaction | null>(null);

  // Login JWT
  const handleLogin = async () => {
    if (!userAddress) {
      setError('Conecte sua wallet primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await apiClient.login(userAddress);
      setIsAuthenticated(true);
      setSuccess('Login realizado com sucesso!');
      
      // Carregar dados do usuário
      await loadUserData();
    } catch (err: any) {
      setError(`Erro no login: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados do usuário
  const loadUserData = async () => {
    if (!userAddress) return;

    try {
      const [positionData, protocolData] = await Promise.all([
        apiClient.getPosition(userAddress),
        apiClient.getProtocolInfo()
      ]);
      
      setPosition(positionData);
      setProtocolInfo(protocolData);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  // Stake ETH
  const handleStake = async () => {
    if (!userAddress) {
      setError('Conecte sua wallet primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const transaction = await apiClient.stake(userAddress, stakeAmount);
      
      if (transaction.transactionData) {
        // Smart wallet - precisa assinar transação
        setPendingTransaction(transaction);
        setSuccess('Transação preparada! Assine na sua wallet.');
      } else {
        // Transação executada diretamente
        setSuccess(`Stake realizado! Hash: ${transaction.transactionHash}`);
        await loadUserData();
      }
    } catch (err: any) {
      setError(`Erro no stake: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Unstake stETH
  const handleUnstake = async () => {
    if (!userAddress) {
      setError('Conecte sua wallet primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const transaction = await apiClient.unstake(userAddress, unstakeAmount);
      
      if (transaction.transactionData) {
        // Smart wallet - precisa assinar transação
        setPendingTransaction(transaction);
        setSuccess('Transação preparada! Assine na sua wallet.');
      } else {
        // Transação executada diretamente
        setSuccess(`Unstake realizado! Hash: ${transaction.transactionHash}`);
        await loadUserData();
      }
    } catch (err: any) {
      setError(`Erro no unstake: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Claim rewards
  const handleClaimRewards = async () => {
    if (!userAddress) {
      setError('Conecte sua wallet primeiro');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      const transaction = await apiClient.claimRewards(userAddress);
      
      if (transaction.transactionData) {
        // Smart wallet - precisa assinar transação
        setPendingTransaction(transaction);
        setSuccess('Transação preparada! Assine na sua wallet.');
      } else {
        // Transação executada diretamente
        setSuccess(`Rewards claimed! Hash: ${transaction.transactionHash}`);
        await loadUserData();
      }
    } catch (err: any) {
      setError(`Erro ao claim rewards: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Executar transação pendente
  const executePendingTransaction = async () => {
    if (!pendingTransaction?.transactionData) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const txHash = await apiClient.executeTransaction(pendingTransaction.transactionData);
      
      setSuccess(`Transação executada! Hash: ${txHash}`);
      setPendingTransaction(null);
      await loadUserData();
    } catch (err: any) {
      setError(`Erro ao executar transação: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (isAuthenticated && userAddress) {
      loadUserData();
    }
  }, [isAuthenticated, userAddress]);

  if (!isConnected) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 mb-2">Wallet não conectada</h3>
        <p className="text-red-600">Conecte sua wallet para usar o staking.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Lido Staking</h1>
      
      {/* Status de autenticação */}
      {!isAuthenticated ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Autenticação necessária</h3>
          <p className="text-yellow-600 mb-4">Faça login para usar o staking.</p>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {isLoading ? 'Fazendo login...' : 'Fazer Login'}
          </button>
        </div>
      ) : (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Autenticado</h3>
          <p className="text-green-600">Usuário: {userAddress}</p>
        </div>
      )}

      {/* Informações do protocolo */}
      {protocolInfo && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Informações do Protocolo</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Staked:</span> {protocolInfo.totalStaked} ETH
            </div>
            <div>
              <span className="font-medium">APY Atual:</span> {protocolInfo.currentAPY}%
            </div>
            <div>
              <span className="font-medium">Preço stETH:</span> {protocolInfo.stETHPrice} ETH
            </div>
            <div>
              <span className="font-medium">Preço wstETH:</span> {protocolInfo.wstETHPrice} ETH
            </div>
          </div>
        </div>
      )}

      {/* Posição do usuário */}
      {position ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Sua Posição</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Staked:</span> {position.stakedAmount} ETH
            </div>
            <div>
              <span className="font-medium">stETH Balance:</span> {position.stETHBalance} stETH
            </div>
            <div>
              <span className="font-medium">wstETH Balance:</span> {position.wstETHBalance} wstETH
            </div>
            <div>
              <span className="font-medium">Rewards:</span> {position.rewards} stETH
            </div>
            <div>
              <span className="font-medium">APY:</span> {position.apy}%
            </div>
            <div>
              <span className="font-medium">Status:</span> {position.status}
            </div>
          </div>
        </div>
      ) : isAuthenticated && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Nenhuma posição encontrada</h3>
          <p className="text-gray-600">Você ainda não tem stETH. Faça seu primeiro stake!</p>
        </div>
      )}

      {/* Transação pendente */}
      {pendingTransaction && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800 mb-2">Transação Pendente</h3>
          <div className="text-sm text-orange-600 mb-4">
            <p><strong>Tipo:</strong> {pendingTransaction.type}</p>
            <p><strong>Valor:</strong> {pendingTransaction.amount} {pendingTransaction.token}</p>
            <p><strong>Status:</strong> {pendingTransaction.status}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={executePendingTransaction}
              disabled={isLoading}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? 'Executando...' : 'Executar Transação'}
            </button>
            <button
              onClick={() => setPendingTransaction(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Formulários de staking */}
      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stake */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Stake ETH</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.001"
                />
              </div>
              <button
                onClick={handleStake}
                disabled={isLoading || !stakeAmount}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Staking...' : 'Stake ETH'}
              </button>
            </div>
          </div>

          {/* Unstake */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Unstake stETH</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade (stETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.001"
                />
              </div>
              <button
                onClick={handleUnstake}
                disabled={isLoading || !unstakeAmount}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Unstaking...' : 'Unstake stETH'}
              </button>
            </div>
          </div>

          {/* Claim Rewards */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Claim Rewards</h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Reivindique seus rewards de staking
              </p>
              <button
                onClick={handleClaimRewards}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? 'Claiming...' : 'Claim Rewards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600">{success}</p>
        </div>
      )}
    </div>
  );
}
