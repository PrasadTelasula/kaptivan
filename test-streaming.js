#!/usr/bin/env node

const WebSocket = require('ws');

const url = 'ws://localhost:8080/api/v1/logs/stream?clusters=docker-desktop&namespaces=default&pods=json-log-generator&containers=json-generator&logLevels=ERROR&logLevels=WARN&logLevels=INFO';

console.log('Starting WebSocket streaming test...');
console.log('This will monitor logs for 10 minutes to verify streaming continues beyond the previous 5-minute timeout.');
console.log('-----------------------------------\n');

const ws = new WebSocket(url);
let messageCount = 0;
let lastMessageTime = Date.now();
let startTime = Date.now();
let connectionClosed = false;

// Track reconnection info
let reconnectionCount = 0;
let lastReconnectionMessage = null;

ws.on('open', () => {
  console.log(`[${new Date().toISOString()}] WebSocket connected successfully`);
});

ws.on('message', (data) => {
  messageCount++;
  lastMessageTime = Date.now();
  
  try {
    const msg = JSON.parse(data);
    
    // Check for reconnection messages
    if (msg.type === 'info' && msg.data && typeof msg.data === 'string') {
      if (msg.data.includes('Reconnecting') || msg.data.includes('reconnect')) {
        reconnectionCount++;
        lastReconnectionMessage = msg.data;
        console.log(`[${new Date().toISOString()}] RECONNECTION #${reconnectionCount}: ${msg.data}`);
      }
    }
    
    // Log every 50th message to avoid spam
    if (messageCount % 50 === 0) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`[${new Date().toISOString()}] Received ${messageCount} messages after ${elapsed} seconds`);
      
      if (msg.type === 'log' && msg.data) {
        const logLine = msg.data;
        // Extract timestamp from log if available
        const timestampMatch = logLine.match(/timestamp":\s*"([^"]+)"/);
        if (timestampMatch) {
          console.log(`  Latest log timestamp: ${timestampMatch[1]}`);
        }
      }
    }
  } catch (e) {
    // Not JSON, might be plain text
  }
});

ws.on('close', (code, reason) => {
  connectionClosed = true;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`\n[${new Date().toISOString()}] WebSocket closed after ${elapsed} seconds`);
  console.log(`Close code: ${code}, Reason: ${reason}`);
  console.log(`Total messages received: ${messageCount}`);
  console.log(`Total reconnections: ${reconnectionCount}`);
  if (lastReconnectionMessage) {
    console.log(`Last reconnection message: ${lastReconnectionMessage}`);
  }
  
  if (elapsed > 300) {
    console.log('\n✅ SUCCESS: Streaming lasted more than 5 minutes!');
    console.log('The reconnection fix is working properly.');
  } else {
    console.log('\n❌ ISSUE: Streaming stopped before 5 minutes');
    console.log('The streaming issue may still exist.');
  }
  
  process.exit(0);
});

ws.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] WebSocket error:`, err.message);
});

// Check for inactivity every 10 seconds
setInterval(() => {
  if (!connectionClosed) {
    const timeSinceLastMessage = Date.now() - lastMessageTime;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    if (timeSinceLastMessage > 10000) {
      console.log(`[${new Date().toISOString()}] WARNING: No messages for ${Math.floor(timeSinceLastMessage/1000)} seconds (elapsed: ${elapsed}s)`);
    }
    
    // Log status every minute
    if (elapsed % 60 === 0 && elapsed > 0) {
      console.log(`[${new Date().toISOString()}] STATUS: Still streaming after ${elapsed/60} minute(s). Messages: ${messageCount}, Reconnections: ${reconnectionCount}`);
    }
  }
}, 10000);

// Stop after 10 minutes
setTimeout(() => {
  if (!connectionClosed) {
    console.log(`\n[${new Date().toISOString()}] Test completed successfully after 10 minutes`);
    console.log(`Total messages received: ${messageCount}`);
    console.log(`Total reconnections: ${reconnectionCount}`);
    console.log('\n✅ SUCCESS: Streaming continued for the full 10-minute test period!');
    console.log('The reconnection fix is working perfectly.');
    ws.close();
    process.exit(0);
  }
}, 10 * 60 * 1000); // 10 minutes

console.log('Monitoring started. Will run for 10 minutes...\n');