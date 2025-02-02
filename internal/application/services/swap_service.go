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

// SwapService is our concrete implementation of ISwapService
type SwapService struct {
    logger logs.Logger
}

// NewSwapService is a constructor for SwapService
func NewSwapService(logger logs.Logger) *SwapService {
    return &SwapService{logger: logger}
}

// FindBestSwap implements ISwapService. It does a parallel fetch from
// multiple sources, merges results, and returns the best swap route.
func (s *SwapService) FindBestSwap(swapReq interfaces.SwapRequest) (*interfaces.SwapResponse, error) {
    // We'll use a context with timeout to avoid indefinite waiting
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    // Channels to gather results
    rangoCh := make(chan *interfaces.SwapResponse, 1)
    errorCh := make(chan error, 2)
    // Suppose we have a second source ...
    anotherCh := make(chan *interfaces.SwapResponse, 1)

    var wg sync.WaitGroup
    wg.Add(2) // We'll call 2 external services in parallel

    // 1) Call Rango in a goroutine
    go func() {
        defer wg.Done()
        res, err := usecases.GetBestSwapRoute(swapReq, s.logger)
        if err != nil {
            errorCh <- fmt.Errorf("Rango error: %w", err)
            return
        }
        rangoCh <- res
    }()

    // 2) Another hypothetical aggregator (just an example)
    go func() {
        defer wg.Done()
        // For demonstration, we’ll just return the same Rango call, but in a real scenario,
        // you might call a different aggregator, etc.
        res, err := usecases.GetBestSwapRoute(swapReq, s.logger)
        if err != nil {
            errorCh <- fmt.Errorf("Another aggregator error: %w", err)
            return
        }
        anotherCh <- res
    }()

    // Wait for them in a separate goroutine
    go func() {
        wg.Wait()
        // close channels once done
        close(rangoCh)
        close(anotherCh)
        close(errorCh)
    }()

    // We'll collect results or an error
    var bestRoute *interfaces.SwapResponse
    var firstErr error

Loop:
    for {
        select {
        case <-ctx.Done():
            s.logger.Warnf("Timeout reached, returning the best found route or error")
            // If no route was found by now, return an error
            if bestRoute == nil {
                return nil, fmt.Errorf("operation timed out, no routes found")
            }
            break Loop
        case err := <-errorCh:
            if err != nil && firstErr == nil {
                firstErr = err
            }
        case res := <-rangoCh:
            if res != nil {
                // For demonstration, let's consider the first response the "best"
                bestRoute = res
            }
        case res := <-anotherCh:
            if res != nil && bestRoute == nil {
                // Maybe we combine them somehow or pick the "best"
                bestRoute = res
            }
        }

        // If we have a best route, we can break out or wait for the second
        // fetch to see if it yields a better route.
        if bestRoute != nil {
            // For simplicity, let's just break
            break Loop
        }
    }

    // If no route found at all, return error
    if bestRoute == nil {
        s.logger.Errorf("No best route found: %v", firstErr)
        return nil, fmt.Errorf("no best route found: %v", firstErr)
    }

    // Return the best route. Possibly log or check errors from the other aggregator.
    return bestRoute, nil
}
