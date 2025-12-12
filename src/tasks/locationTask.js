import * as TaskManager from 'expo-task-manager';
import { sendPayload, shouldSendLocation, haversineDistance, intervalFromSpeed } from '../services/locationService';

// Import the task name from locationService
import { LOCATION_TASK_NAME } from '../services/locationService';

/**
 * Background location task definition
 * This task runs when the app is in the background and receives location updates
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    
    // Process each location update
    for (const location of locations) {
      console.debug('Background location update received:', location);
      
      try {
        // Extract location data
        const { coords, timestamp } = location;
        const { latitude, longitude, speed, accuracy } = coords;
        
        // Create payload
        const payload = {
          userId: 'user-123', // In a real app, this would come from auth
          lat: latitude,
          lon: longitude,
          speed: speed !== null ? speed : 0,
          accuracy: accuracy,
          timestamp: new Date(timestamp).toISOString()
        };
        
        // Check if we should send this location based on adaptive logic
        const shouldSend = await shouldSendLocation(location);
        
        if (shouldSend) {
          console.debug('Sending background location update');
          await sendPayload(payload);
        } else {
          console.debug('Skipping background location update (adaptive logic)');
        }
      } catch (err) {
        console.error('Error processing background location:', err);
      }
    }
  }
});

export default TaskManager;