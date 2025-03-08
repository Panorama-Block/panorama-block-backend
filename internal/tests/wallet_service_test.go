package tests

import (
    "testing"

    "github.com/stretchr/testify/mock"
    "github.com/stretchr/testify/require"
    "github.com/noymaxx/backend/internal/application/services"
    "github.com/noymaxx/backend/internal/domain/entities"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
)

// MockWalletRepo substitui IWalletRepository
type MockWalletRepo struct {
    mock.Mock
}

func (m *MockWalletRepo) InsertOrUpdateWallet(w entities.Wallet) error {
    args := m.Called(w)
    return args.Error(0)
}

func (m *MockWalletRepo) GetWalletByBlockchainAddress(b, a string) (*entities.Wallet, error) {
    args := m.Called(b, a)
    return args.Get(0).(*entities.Wallet), args.Error(1)
}

func (m *MockWalletRepo) GetAllAddresses() ([]string, error) {
    args := m.Called()
    return args.Get(0).([]string), args.Error(1)
}

// MockBalanceRepo substitui IBalanceRepository
type MockBalanceRepo struct {
    mock.Mock
}

func (mb *MockBalanceRepo) InsertOrUpdateBalances(b entities.WalletBalances) error {
    args := mb.Called(b)
    return args.Error(0)
}

func (mb *MockBalanceRepo) GetBalancesByWallet(b, a string) (*entities.WalletBalances, error) {
    args := mb.Called(b, a)
    return args.Get(0).(*entities.WalletBalances), args.Error(1)
}

// TestFetchAndStoreBalance
func TestFetchAndStoreBalance(t *testing.T) {
    // Preparar mocks
    walletRepo := new(MockWalletRepo)
    balanceRepo := new(MockBalanceRepo)
    logger := logs.NewLogger()
    svc := services.NewWalletService(logger, walletRepo, balanceRepo, nil) // sem redis

    // Mocks de repositório
    walletRepo.On("InsertOrUpdateWallet", mock.Anything).Return(nil)
    walletRepo.On("GetWalletByBlockchainAddress", "BSC", "0x123").
        Return(&entities.Wallet{Blockchain: "BSC", Address: "0x123"}, nil)

    balanceRepo.On("InsertOrUpdateBalances", mock.Anything).Return(nil)

    // Mock da função usecases.GetBalanceFromRango
    // Você pode usar injeção de dependência ou monkey patching (dependendo do Go)
    // Aqui só ilustramos a ideia

    // Execução
    result, err := svc.FetchAndStoreBalance("BSC.0x123")
    require.NoError(t, err)
    require.Len(t, result, 1)
    require.Equal(t, "BSC", result[0].Blockchain)
    require.Equal(t, "0x123", result[0].Address)

    // Asserções de mock
    walletRepo.AssertCalled(t, "InsertOrUpdateWallet", mock.Anything)
    balanceRepo.AssertCalled(t, "InsertOrUpdateBalances", mock.Anything)
}
