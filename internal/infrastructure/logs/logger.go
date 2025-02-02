package logs

import (
    "log"
    "os"

    "github.com/fatih/color"
)

type Logger struct {
    infoColor      *color.Color
    warnColor      *color.Color
    errorColor     *color.Color
    fatalColor     *color.Color
    standardLogger *log.Logger
}

func NewLogger() *Logger {
    return &Logger{
        infoColor:      color.New(color.FgGreen),
        warnColor:      color.New(color.FgYellow),
        errorColor:     color.New(color.FgRed),
        fatalColor:     color.New(color.FgHiRed, color.Bold),
        standardLogger: log.New(os.Stdout, "", log.LstdFlags),
    }
}

func (l *Logger) Infof(format string, args ...interface{}) {
    l.standardLogger.Println(l.infoColor.Sprintf("[INFO] "+format, args...))
}

func (l *Logger) Warnf(format string, args ...interface{}) {
    l.standardLogger.Println(l.warnColor.Sprintf("[WARN] "+format, args...))
}

func (l *Logger) Errorf(format string, args ...interface{}) {
    l.standardLogger.Println(l.errorColor.Sprintf("[ERROR] "+format, args...))
}

func (l *Logger) Fatalf(format string, args ...interface{}) {
    l.standardLogger.Fatalln(l.fatalColor.Sprintf("[FATAL] "+format, args...))
}
