package main

import (
	"context"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

var logger = logrus.New()

type traceKey struct{}

// consoleFormatter prints logs in a Spring-like pattern:
// 2026-04-18 14:21:10.627  INFO  [traceId] message   field=value
type consoleFormatter struct{}

var levelColors = map[logrus.Level]string{
	logrus.TraceLevel: "\033[37m",  // white
	logrus.DebugLevel: "\033[36m",  // cyan
	logrus.InfoLevel:  "\033[32m",  // green
	logrus.WarnLevel:  "\033[33m",  // yellow
	logrus.ErrorLevel: "\033[31m",  // red
	logrus.FatalLevel: "\033[35m",  // magenta
	logrus.PanicLevel: "\033[35m",
}

const colorReset = "\033[0m"

func (f *consoleFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	color := levelColors[entry.Level]
	level := fmt.Sprintf("%-5s", strings.ToUpper(entry.Level.String()))
	ts := entry.Time.Format("2006-01-02 15:04:05.000")

	traceId := "-"
	if v, ok := entry.Data["traceId"]; ok {
		if s, ok := v.(string); ok && len(s) >= 8 {
			traceId = s[:8]
		}
	}

	var extra strings.Builder
	for k, v := range entry.Data {
		if k == "traceId" {
			continue
		}
		extra.WriteString(fmt.Sprintf("  %s=%v", k, v))
	}

	line := fmt.Sprintf("%s  %s%s%s  [%s]  %s%s\n",
		ts, color, level, colorReset, traceId, entry.Message, extra.String())
	return []byte(line), nil
}

// logstashHook ------------------------------------------------------------

type logstashHook struct {
	addr      string
	conn      net.Conn
	formatter logrus.Formatter
}

func newLogstashHook(addr string) *logstashHook {
	h := &logstashHook{addr: addr, formatter: &logrus.JSONFormatter{}}
	go h.connect()
	return h
}

func (h *logstashHook) connect() {
	for {
		conn, err := net.DialTimeout("tcp", h.addr, 5*time.Second)
		if err == nil {
			h.conn = conn
			return
		}
		time.Sleep(2 * time.Second)
	}
}

func (h *logstashHook) Levels() []logrus.Level { return logrus.AllLevels }

func (h *logstashHook) Fire(entry *logrus.Entry) error {
	if h.conn == nil {
		return nil
	}
	b, err := h.formatter.Format(entry)
	if err != nil {
		return err
	}
	if _, err = h.conn.Write(b); err != nil {
		h.conn = nil
		go h.connect()
	}
	return nil
}

// traceId helpers ---------------------------------------------------------

func withTrace(ctx context.Context) (context.Context, *logrus.Entry) {
	traceId := uuid.New().String()
	ctx = context.WithValue(ctx, traceKey{}, traceId)
	return ctx, logger.WithField("traceId", traceId)
}

func logFromCtx(ctx context.Context) *logrus.Entry {
	if id, ok := ctx.Value(traceKey{}).(string); ok {
		return logger.WithField("traceId", id)
	}
	return logger.WithField("traceId", uuid.New().String())
}

// simulated service layer -------------------------------------------------

func validateRequest(ctx context.Context, userID string) error {
	logFromCtx(ctx).WithField("userID", userID).Info("Validating request")
	time.Sleep(time.Duration(rand.Intn(20)+5) * time.Millisecond)
	if userID == "" {
		return fmt.Errorf("userID is required")
	}
	logFromCtx(ctx).WithField("userID", userID).Debug("Request validated")
	return nil
}

func queryDatabase(ctx context.Context, userID string) (map[string]string, error) {
	logFromCtx(ctx).WithFields(logrus.Fields{
		"userID": userID,
		"query":  "SELECT * FROM users WHERE id = ?",
	}).Info("Querying database")
	time.Sleep(time.Duration(rand.Intn(40)+10) * time.Millisecond)

	// simulate occasional slow query
	if rand.Intn(5) == 0 {
		logFromCtx(ctx).WithField("userID", userID).Warn("Slow query detected (>30ms)")
	}
	logFromCtx(ctx).WithField("userID", userID).Debug("Database query complete")
	return map[string]string{"id": userID, "name": "Test User"}, nil
}

func callExternalService(ctx context.Context, userID string) error {
	logFromCtx(ctx).WithField("userID", userID).Info("Calling external service")
	time.Sleep(time.Duration(rand.Intn(30)+5) * time.Millisecond)

	// simulate occasional external error
	if rand.Intn(4) == 0 {
		err := fmt.Errorf("external service timeout")
		logFromCtx(ctx).WithField("userID", userID).WithError(err).Error("External service call failed")
		return err
	}
	logFromCtx(ctx).WithField("userID", userID).Debug("External service responded OK")
	return nil
}

// handlers ----------------------------------------------------------------

// processHandler simulates a realistic multi-step request so that all logs
// share the same traceId and can be filtered together in Kibana/Grafana.
func processHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		userID = uuid.New().String()[:8]
	}

	ctx, log := withTrace(r.Context())
	log.WithField("userID", userID).Info("Processing request")

	if err := validateRequest(ctx, userID); err != nil {
		log.WithError(err).Error("Request validation failed")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	data, err := queryDatabase(ctx, userID)
	if err != nil {
		log.WithError(err).Error("Database error")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := callExternalService(ctx, userID); err != nil {
		log.WithField("userID", userID).Warn("Continuing without external service data")
	}

	log.WithFields(logrus.Fields{
		"userID": userID,
		"result": data,
	}).Info("Request processed successfully")

	fmt.Fprintf(w, `{"traceId":%q,"userId":%q,"status":"ok"}`, ctx.Value(traceKey{}), userID)
}

func logsHandler(w http.ResponseWriter, r *http.Request) {
	l := logger.WithField("traceId", uuid.New().String())
	l.Trace("trace")
	l.Debug("debug")
	l.Info("info")
	l.Warn("warn")
	l.Error("error")
	fmt.Fprintln(w, "true")
}

// scheduled tasks ---------------------------------------------------------

func scheduleFunc(ctx context.Context, interval time.Duration, fn func()) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			fn()
		case <-ctx.Done():
			return
		}
	}
}

func postDebug() {
	logger.WithField("traceId", uuid.New().String()).Debug("Scheduled debug message")
}

func postError() {
	logger.WithField("traceId", uuid.New().String()).Error("Scheduled error message")
}

func postException() {
	traceId := uuid.New().String()
	defer func() {
		if r := recover(); r != nil {
			logger.WithField("traceId", traceId).WithField("panic", fmt.Sprint(r)).Error("Recovered from panic")
		}
	}()
	panic("Exception")
}

// main --------------------------------------------------------------------

func main() {
	logger.SetFormatter(&consoleFormatter{})
	logger.SetOutput(os.Stdout)
	logger.SetLevel(logrus.TraceLevel)

	logstashAddr := os.Getenv("LOGSTASH_ADDR")
	if logstashAddr == "" {
		logstashAddr = "localhost:50000"
	}
	logger.AddHook(newLogstashHook(logstashAddr))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	go scheduleFunc(ctx, 2*time.Second, postDebug)
	go scheduleFunc(ctx, 5*time.Second, postError)
	go scheduleFunc(ctx, 10*time.Second, postException)

	mux := http.NewServeMux()
	mux.HandleFunc("/logs", logsHandler)
	mux.HandleFunc("/process", processHandler)
	srv := &http.Server{Addr: ":8080", Handler: mux}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.WithError(err).Fatal("HTTP server failed")
		}
	}()

	logger.Info("Application started on :8080")
	<-ctx.Done()
	srv.Shutdown(context.Background())
}
