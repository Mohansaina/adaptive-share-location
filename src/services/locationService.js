import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { saveBuffer, getBuffer, clearBuffer } from './storage';
import * as SecureStore from 'expo-secure-store';

// Constants for adaptive location sharing
const DISTANCE_THRESHOLD = 10; // meters
const TIME_INTERVALS = {
  STILL: 15 * 60 * 1000,      // 15 minutes
  WALKING: 5 * 60 * 1000,     // 5 minutes
  BIKE: 2 * 60 * 1000,        // 2 minutes
  VEHICLE: 60 * 1000          // 1 minute
};

const SPEED_THRESHOLDS = {
  STILL: 0.5,     // m/s
  WALKING: 2.0,   // m/s
  BIKE: 6.0       // m/s
};

// Task name for background location updates
export const LOCATION_TASK_NAME = 'background-location-task';

let lastSentLocation = null;
let locationSubscription = null;

// Export lastSentLocation getter for external access
export const getLastSentLocation = () => lastSentLocation;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Get interval based on speed
 * @param {number} speed - Speed in m/s
 * @returns {number} Interval in milliseconds
 */
export function intervalFromSpeed(speed) {
  if (speed < SPEED_THRESHOLDS.STILL) {
    return TIME_INTERVALS.STILL;
  } else if (speed < SPEED_THRESHOLDS.WALKING) {
    return TIME_INTERVALS.WALKING;
  } else if (speed < SPEED_THRESHOLDS.BIKE) {
    return TIME_INTERVALS.BIKE;
  } else {
    return TIME_INTERVALS.VEHICLE;
  }
}

/**
 * Request foreground location permissions
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestForegroundPermissions() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting foreground permissions:', error);
    return false;
  }
}

/**
 * Request background location permissions (Android only)
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestBackgroundPermissions() {
  if (Platform.OS === 'android') {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting background permissions:', error);
      return false;
    }
  }
  return true;
}

/**
 * Check if foreground permissions are granted
 * @returns {Promise<boolean>} True if permission granted
 */
export async function checkForegroundPermissions() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if background permissions are granted
 * @returns {Promise<boolean>} True if permission granted
 */
export async function checkBackgroundPermissions() {
  const { status } = await Location.getBackgroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Start foreground location updates
 * @param {Function} callback - Function to call with location data
 */
export async function startForegroundLocationUpdates(callback) {
  // Stop any existing subscription
  if (locationSubscription) {
    locationSubscription.remove();
  }

  // Start watching position
  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // 5 seconds
      distanceInterval: 5, // 5 meters
    },
    (location) => {
      console.debug('Foreground location update:', location);
      callback(location);
    }
  );
}

/**
 * Stop foreground location updates
 */
export function stopForegroundLocationUpdates() {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}

/**
 * Start background location updates
 */
export async function startBackgroundLocationUpdates() {
  // Define the background task (actual implementation in locationTask.js)
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 30000, // 30 seconds
    distanceInterval: 10, // 10 meters
    deferredUpdatesInterval: 60000, // 1 minute
    deferredUpdatesDistance: 50, // 50 meters
    foregroundService: {
      notificationTitle: 'Location Sharing Active',
      notificationBody: 'Sharing your location adaptively',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
}

/**
 * Stop background location updates
 */
export async function stopBackgroundLocationUpdates() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

/**
 * Send location payload to server
 * @param {Object} payload - Location data to send
 * @returns {Promise<boolean>} True if successful
 */
export async function sendPayload(payload) {
  try {
    // Check network connectivity
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      console.debug('Offline: buffering location data');
      await saveBuffer(payload);
      return false;
    }

    // Get auth token from secure store
    const authToken = await SecureStore.getItemAsync('auth_token');
    
    // Send to server
    const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
    const response = await fetch(`${SERVER_URL}/api/location/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken || 'placeholder-token'}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.debug('Location sent successfully');
      lastSentLocation = {
        lat: payload.lat,
        lon: payload.lon,
        timestamp: new Date(payload.timestamp).getTime() // Store as milliseconds since epoch
      };
      return true;
    } else {
      console.debug('Failed to send location, buffering...');
      await saveBuffer(payload);
      return false;
    }
  } catch (error) {
    console.error('Error sending location:', error);
    await saveBuffer(payload);
    return false;
  }
}

/**
 * Flush buffered locations when network returns
 */
export async function flushBuffer() {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      return;
    }

    const buffer = await getBuffer();
    if (buffer.length > 0) {
      console.debug(`Flushing ${buffer.length} buffered locations`);
      
      for (const payload of buffer) {
        await sendPayload(payload);
      }
      
      await clearBuffer();
    }
  } catch (error) {
    console.error('Error flushing buffer:', error);
  }
}

/**
 * Decide whether to send location based on adaptive logic
 * @param {Object} location - Current location object
 * @returns {Promise<boolean>} True if should send
 */
export async function shouldSendLocation(location) {
  const { coords, timestamp } = location;
  const { latitude, longitude, speed, accuracy } = coords;
  
  // Use 0 as default speed if not available
  const currentSpeed = speed !== null ? speed : 0;
  
  // Calculate current interval based on speed
  const currentInterval = intervalFromSpeed(currentSpeed);
  
  // If this is the first location, send it
  if (!lastSentLocation) {
    return true;
  }
  
  // Calculate distance from last sent location
  const distance = haversineDistance(
    lastSentLocation.lat,
    lastSentLocation.lon,
    latitude,
    longitude
  );
  
  // Calculate time since last sent (both timestamps are now in milliseconds)
  const timeSinceLast = timestamp - lastSentLocation.timestamp;
  
  console.debug(`Distance: ${distance}m, Time since last: ${timeSinceLast}ms, Interval: ${currentInterval}ms`);
  
  // Check if enough time has passed and user has moved enough
  if (distance >= DISTANCE_THRESHOLD && timeSinceLast >= currentInterval) {
    return true;
  }
  
  return false;
}