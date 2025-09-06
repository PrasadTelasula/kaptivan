package pool

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ConnectionState represents the state of a connection
type ConnectionState string

const (
	StateActive   ConnectionState = "active"
	StateIdle     ConnectionState = "idle"
	StateEvicted  ConnectionState = "evicted"
	StateUnhealthy ConnectionState = "unhealthy"
)

// PoolConfig holds configuration for the connection pool
type PoolConfig struct {
	MaxConnections      int           // Maximum number of connections in pool
	MaxIdleConnections  int           // Maximum idle connections to maintain
	ConnectionTimeout   time.Duration // Timeout for establishing connection
	IdleTimeout         time.Duration // Time before idle connection is evicted
	HealthCheckInterval time.Duration // Interval for health checks
	MaxRetries          int           // Maximum reconnection attempts
	RetryBackoff        time.Duration // Backoff between retries
}

// DefaultPoolConfig returns default pool configuration
func DefaultPoolConfig() *PoolConfig {
	return &PoolConfig{
		MaxConnections:      100,
		MaxIdleConnections:  10,
		ConnectionTimeout:   30 * time.Second,
		IdleTimeout:         5 * time.Minute,
		HealthCheckInterval: 30 * time.Second,
		MaxRetries:          3,
		RetryBackoff:        5 * time.Second,
	}
}

// ClientConnection wraps a Kubernetes client with metadata
type ClientConnection struct {
	client         kubernetes.Interface
	config         *rest.Config
	clusterName    string
	state          ConnectionState
	createdAt      time.Time
	lastUsedAt     time.Time
	lastHealthCheck time.Time
	useCount       uint64
	errorCount     uint32
	mu             sync.RWMutex
}

// GetClient returns the Kubernetes client
func (c *ClientConnection) GetClient() kubernetes.Interface {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastUsedAt = time.Now()
	atomic.AddUint64(&c.useCount, 1)
	return c.client
}

// MarkUnhealthy marks the connection as unhealthy
func (c *ClientConnection) MarkUnhealthy() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.state = StateUnhealthy
	atomic.AddUint32(&c.errorCount, 1)
}

// IsHealthy returns true if connection is healthy
func (c *ClientConnection) IsHealthy() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state == StateActive || c.state == StateIdle
}

// ConnectionPool manages a pool of Kubernetes client connections
type ConnectionPool struct {
	config        *PoolConfig
	connections   sync.Map // map[string]*ClientConnection
	metrics       *PoolMetrics
	healthChecker *HealthChecker
	kubeConfig    *rest.Config
	
	// Connection counts
	totalConnections   int32
	activeConnections  int32
	idleConnections    int32
	
	// Control channels
	stopCh chan struct{}
	wg     sync.WaitGroup
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(config *PoolConfig) *ConnectionPool {
	if config == nil {
		config = DefaultPoolConfig()
	}
	
	pool := &ConnectionPool{
		config:  config,
		metrics: NewPoolMetrics(),
		stopCh:  make(chan struct{}),
	}
	
	pool.healthChecker = NewHealthChecker(pool)
	
	// Start background workers
	pool.wg.Add(2)
	go pool.healthCheckWorker()
	go pool.evictionWorker()
	
	return pool
}

// GetConnection gets or creates a connection for a cluster
func (p *ConnectionPool) GetConnection(ctx context.Context, clusterName string, kubeConfigPath string) (kubernetes.Interface, error) {
	// Try to get existing connection
	if conn, ok := p.connections.Load(clusterName); ok {
		clientConn := conn.(*ClientConnection)
		if clientConn.IsHealthy() {
			p.metrics.RecordHit()
			return clientConn.GetClient(), nil
		}
		// Connection exists but unhealthy, try to reconnect
		p.metrics.RecordMiss()
	} else {
		p.metrics.RecordMiss()
	}
	
	// Check if we've reached max connections
	if atomic.LoadInt32(&p.totalConnections) >= int32(p.config.MaxConnections) {
		// Try to evict an idle connection
		if !p.evictIdleConnection() {
			return nil, fmt.Errorf("connection pool is full (max: %d)", p.config.MaxConnections)
		}
	}
	
	// Create new connection
	return p.createConnection(ctx, clusterName, kubeConfigPath)
}

// createConnection creates a new connection to a cluster
func (p *ConnectionPool) createConnection(ctx context.Context, clusterName string, kubeConfigPath string) (kubernetes.Interface, error) {
	// Load kubeconfig
	config, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build config: %w", err)
	}
	
	// Override context if specified
	if clusterName != "" {
		loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeConfigPath}
		configOverrides := &clientcmd.ConfigOverrides{CurrentContext: clusterName}
		kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
		
		config, err = kubeConfig.ClientConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to get client config for context %s: %w", clusterName, err)
		}
	}
	
	// Set timeout
	config.Timeout = p.config.ConnectionTimeout
	
	// Create client with retry logic
	var client kubernetes.Interface
	var lastErr error
	
	for i := 0; i < p.config.MaxRetries; i++ {
		client, err = kubernetes.NewForConfig(config)
		if err == nil {
			// Test the connection
			_, err = client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
			if err == nil {
				break
			}
		}
		
		lastErr = err
		if i < p.config.MaxRetries-1 {
			time.Sleep(p.config.RetryBackoff)
		}
	}
	
	if lastErr != nil {
		p.metrics.RecordConnectionError()
		return nil, fmt.Errorf("failed to create client after %d retries: %w", p.config.MaxRetries, lastErr)
	}
	
	// Create connection wrapper
	conn := &ClientConnection{
		client:          client,
		config:          config,
		clusterName:     clusterName,
		state:           StateActive,
		createdAt:       time.Now(),
		lastUsedAt:      time.Now(),
		lastHealthCheck: time.Now(),
	}
	
	// Store connection
	p.connections.Store(clusterName, conn)
	atomic.AddInt32(&p.totalConnections, 1)
	atomic.AddInt32(&p.activeConnections, 1)
	
	p.metrics.RecordConnectionCreated()
	
	return client, nil
}

// evictIdleConnection evicts the oldest idle connection
func (p *ConnectionPool) evictIdleConnection() bool {
	var oldestIdle *ClientConnection
	var oldestKey string
	
	p.connections.Range(func(key, value interface{}) bool {
		conn := value.(*ClientConnection)
		conn.mu.RLock()
		defer conn.mu.RUnlock()
		
		if conn.state == StateIdle {
			if oldestIdle == nil || conn.lastUsedAt.Before(oldestIdle.lastUsedAt) {
				oldestIdle = conn
				oldestKey = key.(string)
			}
		}
		return true
	})
	
	if oldestIdle != nil {
		p.connections.Delete(oldestKey)
		atomic.AddInt32(&p.totalConnections, -1)
		atomic.AddInt32(&p.idleConnections, -1)
		p.metrics.RecordEviction()
		return true
	}
	
	return false
}

// healthCheckWorker periodically checks connection health
func (p *ConnectionPool) healthCheckWorker() {
	defer p.wg.Done()
	
	ticker := time.NewTicker(p.config.HealthCheckInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			p.performHealthChecks()
		case <-p.stopCh:
			return
		}
	}
}

// performHealthChecks checks health of all connections
func (p *ConnectionPool) performHealthChecks() {
	p.connections.Range(func(key, value interface{}) bool {
		conn := value.(*ClientConnection)
		go p.healthChecker.CheckConnection(conn)
		return true
	})
}

// evictionWorker periodically evicts idle connections
func (p *ConnectionPool) evictionWorker() {
	defer p.wg.Done()
	
	ticker := time.NewTicker(p.config.IdleTimeout / 2)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			p.evictExpiredConnections()
		case <-p.stopCh:
			return
		}
	}
}

// evictExpiredConnections evicts connections that have been idle too long
func (p *ConnectionPool) evictExpiredConnections() {
	now := time.Now()
	
	p.connections.Range(func(key, value interface{}) bool {
		conn := value.(*ClientConnection)
		conn.mu.RLock()
		shouldEvict := now.Sub(conn.lastUsedAt) > p.config.IdleTimeout && conn.state == StateIdle
		conn.mu.RUnlock()
		
		if shouldEvict {
			p.connections.Delete(key)
			atomic.AddInt32(&p.totalConnections, -1)
			atomic.AddInt32(&p.idleConnections, -1)
			p.metrics.RecordEviction()
		}
		
		return true
	})
}

// GetMetrics returns pool metrics
func (p *ConnectionPool) GetMetrics() PoolMetricsSnapshot {
	return p.metrics.Snapshot()
}

// Close closes all connections and stops background workers
func (p *ConnectionPool) Close() {
	close(p.stopCh)
	p.wg.Wait()
	
	// Close all connections
	p.connections.Range(func(key, value interface{}) bool {
		p.connections.Delete(key)
		return true
	})
}

// GetConnectionStats returns current connection statistics
func (p *ConnectionPool) GetConnectionStats() ConnectionStats {
	stats := ConnectionStats{
		TotalConnections:   int(atomic.LoadInt32(&p.totalConnections)),
		ActiveConnections:  int(atomic.LoadInt32(&p.activeConnections)),
		IdleConnections:    int(atomic.LoadInt32(&p.idleConnections)),
		HealthyConnections: 0,
		UnhealthyConnections: 0,
	}
	
	p.connections.Range(func(key, value interface{}) bool {
		conn := value.(*ClientConnection)
		if conn.IsHealthy() {
			stats.HealthyConnections++
		} else {
			stats.UnhealthyConnections++
		}
		return true
	})
	
	return stats
}

// ConnectionStats holds connection statistics
type ConnectionStats struct {
	TotalConnections     int
	ActiveConnections    int
	IdleConnections      int
	HealthyConnections   int
	UnhealthyConnections int
}