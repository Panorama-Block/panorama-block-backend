package logs

import (
	"fmt"
	"log"
	"os"
	"time"
)

// Logger provides structured logging capabilities
type Logger struct {
	infoLogger  *log.Logger
	warnLogger  *log.Logger
	errorLogger *log.Logger
	debugLogger *log.Logger
}

// NewLogger creates a new logger instance
func NewLogger() *Logger {
	flags := log.Ldate | log.Ltime

	return &Logger{
		infoLogger:  log.New(os.Stdout, "[INFO] ", flags),
		warnLogger:  log.New(os.Stdout, "[WARN] ", flags),
		errorLogger: log.New(os.Stderr, "[ERROR] ", flags),
		debugLogger: log.New(os.Stdout, "[DEBUG] ", flags),
	}
}

// Infof logs an info message with formatting
func (l *Logger) Infof(format string, args ...interface{}) {
	l.infoLogger.Printf(format, args...)
}

// Warnf logs a warning message with formatting
func (l *Logger) Warnf(format string, args ...interface{}) {
	l.warnLogger.Printf(format, args...)
}

// Errorf logs an error message with formatting
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.errorLogger.Printf(format, args...)
}

// Debugf logs a debug message with formatting
func (l *Logger) Debugf(format string, args ...interface{}) {
	l.debugLogger.Printf(format, args...)
}

// Fatalf logs a fatal error message with formatting and exits
func (l *Logger) Fatalf(format string, args ...interface{}) {
	l.errorLogger.Printf(format, args...)
	os.Exit(1)
}

// LogRequest logs HTTP request information
func (l *Logger) LogRequest(method, path, ip string, duration time.Duration) {
	l.Infof("%s %s from %s - %s", method, path, ip, duration)
} 