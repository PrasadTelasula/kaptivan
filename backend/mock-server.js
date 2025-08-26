const http = require('http');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'kaptivan-backend-mock'
    }));
  } else if (req.url === '/api/v1/clusters') {
    res.writeHead(200);
    res.end(JSON.stringify({
      clusters: [
        { id: '1', name: 'dev-cluster', status: 'connected' },
        { id: '2', name: 'prod-cluster', status: 'connected' }
      ],
      total: 2
    }));
  } else if (req.url.startsWith('/api/v1/resources/')) {
    const type = req.url.split('/').pop();
    res.writeHead(200);
    res.end(JSON.stringify({
      type: type,
      resources: [],
      total: 0
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Mock backend server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /health');
  console.log('  GET /api/v1/clusters');
  console.log('  GET /api/v1/resources/:type');
});