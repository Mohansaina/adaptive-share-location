const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Store received locations in memory (in production, you'd use a database)
let receivedLocations = [];

// POST endpoint to receive location updates
app.post('/api/location/update', (req, res) => {
  const locationData = req.body;
  
  console.log('Received location update:', new Date().toISOString());
  console.log('Payload:', JSON.stringify(locationData, null, 2));
  
  // Validate required fields
  if (!locationData.userId || !locationData.lat || !locationData.lon) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, lat, lon' 
    });
  }
  
  // Add to our in-memory store
  receivedLocations.push({
    ...locationData,
    receivedAt: new Date().toISOString()
  });
  
  // Keep only the last 100 locations to prevent memory issues
  if (receivedLocations.length > 100) {
    receivedLocations = receivedLocations.slice(-100);
  }
  
  // Respond with success
  res.json({ 
    success: true, 
    message: 'Location update received',
    receivedAt: new Date().toISOString()
  });
});

// GET endpoint to retrieve all received locations
app.get('/api/location/history', (req, res) => {
  res.json({
    locations: receivedLocations,
    count: receivedLocations.length
  });
});

// GET endpoint for health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock server listening at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log(`  POST  http://localhost:${PORT}/api/location/update`);
  console.log(`  GET   http://localhost:${PORT}/api/location/history`);
  console.log(`  GET   http://localhost:${PORT}/health`);
});

module.exports = app;