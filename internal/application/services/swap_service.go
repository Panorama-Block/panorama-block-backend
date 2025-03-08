package services

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/noymaxx/backend/internal/domain/interfaces"
    "github.com/noymaxx/backend/internal/infrastructure/logs"
    "github.com/noymaxx/backend/internal/application/usecases"
)

// SwapService is our concrete implementation
type SwapService struct {
    logger logs.Logger
}

func NewSwapService(logger logs.Logger) *SwapService {
    return &SwapService{logger: logger}
}

func (s *SwapService) FindBestSwap(swapReq interfaces.SwapRequest) (*interfaces.SwapResponse, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    rangoCh := make(chan *interfaces.SwapResponse, 1)
    anotherCh := make(chan *interfaces.SwapResponse, 1)
    errorCh := make(chan error, 2)

    var wg sync.WaitGroup
    wg.Add(2)

    // 1) Goroutine Rango
    go func() {
        defer wg.Done()
        res, err := usecases.GetBestSwapRoute(swapReq, s.logger)
        if err != nil {
            errorCh <- fmt.Errorf("Rango error: %w", err)
            return
        }
        rangoCh <- res
    }()

    // 2) Goroutine "Outro aggregator"
    go func() {
        defer wg.Done()
        res, err := usecases.GetBestSwapRoute(swapReq, s.logger) // apenas exemplo
        if err != nil {
            errorCh <- fmt.Errorf("Aggregator error: %w", err)
            return
        }
        anotherCh <- res
    }()

    // Fim das goroutines
    go func() {
        wg.Wait()
        close(rangoCh)
        close(anotherCh)
        close(errorCh)
    }()

    var bestRoute *interfaces.SwapResponse
    var firstErr error

Loop:
    for {
        select {
        case <-ctx.Done():
            s.logger.Warnf("Timeout reached.")
            if bestRoute == nil {
                return nil, fmt.Errorf("timed out, no route found")
            }
            break Loop
        case err := <-errorCh:
            if err != nil && firstErr == nil {
                firstErr = err
            }
        case res := <-rangoCh:
            if res != nil {
                bestRoute = res
                break Loop
            }
        case res := <-anotherCh:
            if res != nil {
                bestRoute = res
                break Loop
            }
        }
    }

    if bestRoute == nil {
        s.logger.Errorf("No best route found: %v", firstErr)
        return nil, fmt.Errorf("no best route found: %v", firstErr)
    }
    return bestRoute, nil
}
