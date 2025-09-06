#!/usr/bin/env node

const WebSocket = require('ws');

// Test with multiple pods that have the same container name
// This simulates selecting two pods from the same deployment
const params = new URLSearchParams();
params.append('clusters', 'docker-desktop');
params.append('namespaces', 'default');

// Add two nginx pods from the same deployment
params.append('pods', 'nginx-demo-54544f4cbb-m6pjn');
params.append('pods', 'nginx-demo-54544f4cbb-plq6t');

// Both pods have the same container name (nginx)
params.append('containers', 'nginx');

params.append('logLevels', 'ERROR');
params.append('logLevels', 'WARN');
params.append('logLevels', 'INFO');

const url = `ws://localhost:8080/api/v1/logs/stream?${params.toString()}`;

console.log('Testing WebSocket with multiple pods having the same container...');
console.log('URL:', url);
console.log('-----------------------------------\n');

const ws = new WebSocket(url);
let messageCount = 0;
const podMessages = new Map(); // Track which pods we're receiving logs from

ws.on('open', () => {
  console.log(`[${new Date().toISOString()}] WebSocket connected successfully`);
});

ws.on('message', (data) => {
  messageCount++;
  
  try {
    const msg = JSON.parse(data);
    
    if (msg.type === 'logs' && msg.data) {
      // Extract pod information from the log
      msg.data.forEach(log => {
        if (log.pod) {
          const count = podMessages.get(log.pod) || 0;
          podMessages.set(log.pod, count + 1);
        }
      });
      
      // Log every 10th message
      if (messageCount % 10 === 0) {
        console.log(`[${new Date().toISOString()}] Received ${messageCount} messages`);
        console.log('Logs per pod:');
        for (const [pod, count] of podMessages.entries()) {
          console.log(`  - ${pod}: ${count} logs`);
        }
        console.log('---');
      }
    } else if (msg.type === 'error') {
      console.error(`[${new Date().toISOString()}] ERROR:`, msg.data);
    }
  } catch (err) {
    console.error('Failed to parse message:', err);
  }
});

ws.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
});

ws.on('close', () => {
  console.log(`[${new Date().toISOString()}] WebSocket closed`);
  console.log('\nFinal summary:');
  console.log(`Total messages received: ${messageCount}`);
  console.log('Logs per pod:');
  for (const [pod, count] of podMessages.entries()) {
    console.log(`  - ${pod}: ${count} logs`);
  }
  
  if (podMessages.size === 0) {
    console.log('\n⚠️  WARNING: No logs received from any pods!');
    console.log('This indicates the backend is not correctly handling multiple pods.');
  } else if (podMessages.size === 1) {
    console.log('\n⚠️  WARNING: Only received logs from one pod!');
    console.log('Expected logs from both pods with the container "json-generator"');
  } else {
    console.log('\n✅ Success: Received logs from multiple pods');
  }
  
  process.exit(0);
});

// Run for 10 seconds then close
setTimeout(() => {
  console.log('\nTest complete, closing connection...');
  ws.close();
}, 10000);