#!/usr/bin/env node

// Test script to verify frontend WebSocket streaming works
// This simulates what the frontend does

const WebSocket = require('ws');

// Simulate the frontend query format
const query = {
  clusters: ['docker-desktop'],
  namespaces: ['default'],
  pods: ['json-log-generator'],
  containers: ['json-generator'],
  logLevels: ['ERROR', 'WARN', 'INFO']
};

// Build URL with query parameters (like the frontend now does)
const params = new URLSearchParams();

if (query.clusters && query.clusters.length > 0) {
  query.clusters.forEach(cluster => params.append('clusters', cluster));
}

if (query.namespaces && query.namespaces.length > 0) {
  query.namespaces.forEach(ns => params.append('namespaces', ns));
}

if (query.pods && query.pods.length > 0) {
  query.pods.forEach(pod => params.append('pods', pod));
}

if (query.containers && query.containers.length > 0) {
  query.containers.forEach(container => params.append('containers', container));
}

if (query.logLevels && query.logLevels.length > 0) {
  query.logLevels.forEach(level => params.append('logLevels', level));
}

const wsUrl = `ws://localhost:8080/api/v1/logs/stream?${params.toString()}`;

console.log('Frontend-style WebSocket test');
console.log('Connecting to:', wsUrl);
console.log('-----------------------------------\n');

const ws = new WebSocket(wsUrl);
let messageCount = 0;
let startTime = Date.now();

ws.on('open', () => {
  console.log(`[${new Date().toISOString()}] WebSocket connected successfully`);
  console.log('Frontend would NOT send JSON query anymore - it\'s all in the URL\n');
});

ws.on('message', (data) => {
  messageCount++;
  
  try {
    const msg = JSON.parse(data);
    
    // Log first few messages and then every 10th
    if (messageCount <= 3 || messageCount % 10 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] Message #${messageCount}:`, msg.type === 'log' ? 'LOG' : msg.type);
      
      if (msg.type === 'log' && msg.data) {
        const logLine = msg.data;
        // Try to extract some info from the log
        const timestampMatch = logLine.match(/timestamp\":\s*\"([^\"]+)\"/);
        if (timestampMatch) {
          console.log(`  Log timestamp: ${timestampMatch[1]}`);
        }
      }
    }
  } catch (e) {
    console.log(`[ERROR] Failed to parse message #${messageCount}`);
  }
});

ws.on('close', (code, reason) => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n[${new Date().toISOString()}] WebSocket closed after ${elapsed} seconds`);
  console.log(`Close code: ${code}, Reason: ${reason}`);
  console.log(`Total messages received: ${messageCount}`);
  
  if (messageCount > 0) {
    console.log('\n✅ SUCCESS: Frontend WebSocket format works!');
  } else {
    console.log('\n❌ FAILURE: No messages received');
  }
  
  process.exit(0);
});

ws.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] WebSocket error:`, err.message);
});

// Test for 30 seconds
setTimeout(() => {
  if (messageCount > 0) {
    console.log(`\n✅ Test passed: Received ${messageCount} messages in 30 seconds`);
    console.log('Frontend WebSocket streaming is working correctly!');
  } else {
    console.log('\n❌ Test failed: No messages received in 30 seconds');
  }
  ws.close();
  process.exit(messageCount > 0 ? 0 : 1);
}, 30000);

console.log('Testing for 30 seconds...\n');