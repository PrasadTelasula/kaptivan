package events

import (
	"fmt"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prasad/kaptivan/backend/internal/kubernetes"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var clusterManager *kubernetes.ClusterManager

func Initialize(manager *kubernetes.ClusterManager) {
	clusterManager = manager
}

type EventInfo struct {
	Name               string    `json:"name"`
	Namespace          string    `json:"namespace"`
	Type               string    `json:"type"`
	Reason             string    `json:"reason"`
	Message            string    `json:"message"`
	Count              int32     `json:"count"`
	FirstTimestamp     time.Time `json:"firstTimestamp"`
	LastTimestamp      time.Time `json:"lastTimestamp"`
	InvolvedObjectKind string    `json:"involvedObjectKind"`
	InvolvedObjectName string    `json:"involvedObjectName"`
	Source             string    `json:"source"`
	SourceComponent    string    `json:"sourceComponent"`
	SourceHost         string    `json:"sourceHost"`
	Age                string    `json:"age"`
}

func List(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")
	typeFilter := c.Query("type")
	reasonFilter := c.Query("reason")
	involvedObjectKind := c.Query("involvedObjectKind")
	involvedObjectName := c.Query("involvedObjectName")
	limit := c.DefaultQuery("limit", "100")

	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	listOptions := metav1.ListOptions{}
	if limit != "" && limit != "0" {
		var limitInt64 int64
		fmt.Sscanf(limit, "%d", &limitInt64)
		listOptions.Limit = limitInt64
	}

	if involvedObjectName != "" {
		listOptions.FieldSelector = fmt.Sprintf("involvedObject.name=%s", involvedObjectName)
	}

	var allEvents []corev1.Event
	
	if namespace != "" && namespace != "all" {
		// Fetch from specific namespace
		events, err := conn.ClientSet.CoreV1().Events(namespace).List(c.Request.Context(), listOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		allEvents = events.Items
	} else {
		// Fetch from all namespaces - we need to get events from each namespace
		// to ensure we get the latest events across all namespaces
		namespaces, err := conn.ClientSet.CoreV1().Namespaces().List(c.Request.Context(), metav1.ListOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		// Create a temporary list options with a per-namespace limit
		perNamespaceLimit := int64(100) // Get latest 100 events per namespace
		tempListOptions := metav1.ListOptions{
			Limit: perNamespaceLimit,
		}
		
		// Fetch events from each namespace
		for _, ns := range namespaces.Items {
			events, err := conn.ClientSet.CoreV1().Events(ns.Name).List(c.Request.Context(), tempListOptions)
			if err != nil {
				// Log error but continue with other namespaces
				log.Printf("Failed to fetch events from namespace %s: %v", ns.Name, err)
				continue
			}
			allEvents = append(allEvents, events.Items...)
		}
	}

	eventList := transformEventList(allEvents, typeFilter, reasonFilter, involvedObjectKind)
	
	// Sort events by timestamp (most recent first), with fallback to count for equal timestamps
	sort.Slice(eventList, func(i, j int) bool {
		// Compare timestamps first
		if !eventList[i].LastTimestamp.Equal(eventList[j].LastTimestamp) {
			return eventList[i].LastTimestamp.After(eventList[j].LastTimestamp)
		}
		// If timestamps are equal, sort by count (higher count first)
		if eventList[i].Count != eventList[j].Count {
			return eventList[i].Count > eventList[j].Count
		}
		// Finally, sort by name for consistency
		return eventList[i].Name > eventList[j].Name
	})
	
	// Apply the limit AFTER sorting to ensure we get the most recent events
	requestedLimit := 2000 // Default limit
	if limit != "" {
		var limitInt64 int64
		fmt.Sscanf(limit, "%d", &limitInt64)
		requestedLimit = int(limitInt64)
	}
	
	// Trim the list to the requested limit
	if len(eventList) > requestedLimit {
		eventList = eventList[:requestedLimit]
	}

	c.JSON(http.StatusOK, gin.H{
		"events": eventList,
		"total":  len(eventList),
	})
}

func transformEventList(events []corev1.Event, typeFilter, reasonFilter, kindFilter string) []EventInfo {
	var result []EventInfo
	
	for _, event := range events {
		if typeFilter != "" && event.Type != typeFilter {
			continue
		}
		if reasonFilter != "" && event.Reason != reasonFilter {
			continue
		}
		if kindFilter != "" && event.InvolvedObject.Kind != kindFilter {
			continue
		}

		lastTime := event.LastTimestamp.Time
		if event.EventTime.Time.After(lastTime) {
			lastTime = event.EventTime.Time
		}
		
		age := calculateAge(lastTime)
		
		source := ""
		if event.Source.Component != "" || event.Source.Host != "" {
			source = event.Source.Component
			if event.Source.Host != "" {
				source += "@" + event.Source.Host
			}
		}
		if event.ReportingController != "" {
			source = event.ReportingController
		}
		
		result = append(result, EventInfo{
			Name:               event.Name,
			Namespace:          event.Namespace,
			Type:               event.Type,
			Reason:             event.Reason,
			Message:            event.Message,
			Count:              event.Count,
			FirstTimestamp:     event.FirstTimestamp.Time,
			LastTimestamp:      lastTime,
			InvolvedObjectKind: event.InvolvedObject.Kind,
			InvolvedObjectName: event.InvolvedObject.Name,
			Source:             source,
			SourceComponent:    event.Source.Component,
			SourceHost:         event.Source.Host,
			Age:                age,
		})
	}
	
	return result
}

func calculateAge(timestamp time.Time) string {
	duration := time.Since(timestamp)
	
	if duration.Seconds() < 60 {
		return fmt.Sprintf("%ds", int(duration.Seconds()))
	} else if duration.Minutes() < 60 {
		return fmt.Sprintf("%dm", int(duration.Minutes()))
	} else if duration.Hours() < 24 {
		return fmt.Sprintf("%dh", int(duration.Hours()))
	} else {
		days := int(duration.Hours() / 24)
		return fmt.Sprintf("%dd", days)
	}
}

func GetReasons(c *gin.Context) {
	context := c.Query("context")
	namespace := c.Query("namespace")

	if context == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	conn, err := clusterManager.GetConnection(context)
	if err != nil || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "cluster not connected"})
		return
	}

	var events *corev1.EventList
	if namespace != "" && namespace != "all" {
		events, err = conn.ClientSet.CoreV1().Events(namespace).List(c.Request.Context(), metav1.ListOptions{})
	} else {
		events, err = conn.ClientSet.CoreV1().Events("").List(c.Request.Context(), metav1.ListOptions{})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	reasonMap := make(map[string]int)
	for _, event := range events.Items {
		reasonMap[event.Reason]++
	}

	var reasons []map[string]interface{}
	for reason, count := range reasonMap {
		reasons = append(reasons, map[string]interface{}{
			"reason": reason,
			"count":  count,
		})
	}

	sort.Slice(reasons, func(i, j int) bool {
		return reasons[i]["count"].(int) > reasons[j]["count"].(int)
	})

	c.JSON(http.StatusOK, gin.H{
		"reasons": reasons,
		"total":   len(reasons),
	})
}