package search

import (
	"container/list"
	"sync"
	"time"
)

// SearchCache implements an LRU cache for search results
type SearchCache struct {
	maxSize   int
	ttl       time.Duration
	items     map[string]*cacheItem
	evictList *list.List
	mu        sync.RWMutex
}

type cacheItem struct {
	key       string
	value     interface{}
	expiresAt time.Time
	element   *list.Element
}

// NewSearchCache creates a new LRU cache
func NewSearchCache(maxSize int, ttl time.Duration) *SearchCache {
	return &SearchCache{
		maxSize:   maxSize,
		ttl:       ttl,
		items:     make(map[string]*cacheItem),
		evictList: list.New(),
	}
}

// Get retrieves an item from cache
func (c *SearchCache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	item, exists := c.items[key]
	c.mu.RUnlock()
	
	if !exists {
		return nil, false
	}
	
	// Check expiration
	if time.Now().After(item.expiresAt) {
		c.Delete(key)
		return nil, false
	}
	
	// Move to front (most recently used)
	c.mu.Lock()
	c.evictList.MoveToFront(item.element)
	c.mu.Unlock()
	
	return item.value, true
}

// Set adds or updates an item in cache
func (c *SearchCache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if ttl == 0 {
		ttl = c.ttl
	}
	
	expiresAt := time.Now().Add(ttl)
	
	// Check if item exists
	if item, exists := c.items[key]; exists {
		// Update existing item
		item.value = value
		item.expiresAt = expiresAt
		c.evictList.MoveToFront(item.element)
		return
	}
	
	// Evict if at capacity
	if c.evictList.Len() >= c.maxSize {
		c.evictOldest()
	}
	
	// Add new item
	item := &cacheItem{
		key:       key,
		value:     value,
		expiresAt: expiresAt,
	}
	element := c.evictList.PushFront(key)
	item.element = element
	c.items[key] = item
}

// Delete removes an item from cache
func (c *SearchCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if item, exists := c.items[key]; exists {
		c.evictList.Remove(item.element)
		delete(c.items, key)
	}
}

// Clear removes all items from cache
func (c *SearchCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	c.items = make(map[string]*cacheItem)
	c.evictList = list.New()
}

// evictOldest removes the least recently used item
func (c *SearchCache) evictOldest() {
	element := c.evictList.Back()
	if element != nil {
		key := element.Value.(string)
		c.evictList.Remove(element)
		delete(c.items, key)
	}
}

// Size returns the current cache size
func (c *SearchCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}

// CleanExpired removes all expired items
func (c *SearchCache) CleanExpired() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	now := time.Now()
	for key, item := range c.items {
		if now.After(item.expiresAt) {
			c.evictList.Remove(item.element)
			delete(c.items, key)
		}
	}
}