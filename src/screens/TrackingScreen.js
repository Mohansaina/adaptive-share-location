import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView, Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as Clipboard from 'expo-clipboard';
import { getBuffer, clearBuffer } from '../services/storage';
import { 
  requestForegroundPermissions, 
  requestBackgroundPermissions, 
  startForegroundLocationUpdates, 
  stopForegroundLocationUpdates,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
  flushBuffer,
  intervalFromSpeed,
  haversineDistance,
  getLastSentLocation,
  sendPayload
} from '../services/locationService';

// Constant for adaptive location sharing
const DISTANCE_THRESHOLD = 10; // meters

export default function TrackingScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [lastSentLocation, setLastSentLocation] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [bufferCount, setBufferCount] = useState(0);
  const [networkStatus, setNetworkStatus] = useState('unknown');

  // Check initial permissions and network status
  useEffect(() => {
    checkPermissions();
    checkNetworkStatus();
    
    // Set up interval to check network status and flush buffer
    const interval = setInterval(() => {
      checkNetworkStatus();
      flushBuffer();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Update buffer count when tracking changes
  useEffect(() => {
    updateBufferCount();
  }, [isTracking]);

  /**
   * Check current permission status
   */
  const checkPermissions = async () => {
    const foregroundGranted = await Location.getForegroundPermissionsAsync();
    const backgroundGranted = await Location.getBackgroundPermissionsAsync();
    
    if (foregroundGranted.status === 'granted' && backgroundGranted.status === 'granted') {
      setPermissionStatus('granted');
    } else if (foregroundGranted.status === 'denied' || backgroundGranted.status === 'denied') {
      setPermissionStatus('denied');
    } else {
      setPermissionStatus('undetermined');
    }
  };

  /**
   * Check network connectivity
   */
  const checkNetworkStatus = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setNetworkStatus(networkState.isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Error checking network status:', error);
      setNetworkStatus('unknown');
    }
  };

  /**
   * Update buffer count display
   */
  const updateBufferCount = async () => {
    try {
      const buffer = await getBuffer();
      setBufferCount(buffer.length);
    } catch (error) {
      console.error('Error updating buffer count:', error);
    }
  };

  /**
   * Request location permissions
   */
  const requestPermissions = async () => {
    try {
      // First check current permissions
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      
      console.log('Current permissions:', { foregroundStatus, backgroundStatus });
      
      let foregroundGranted = foregroundStatus.status === 'granted';
      let backgroundGranted = backgroundStatus.status === 'granted';
      
      // Request foreground permissions if not granted
      if (!foregroundGranted) {
        const foregroundResult = await Location.requestForegroundPermissionsAsync();
        console.log('Foreground permission result:', foregroundResult);
        foregroundGranted = foregroundResult.status === 'granted';
      }
      
      // Request background permissions if not granted (Android only)
      if (foregroundGranted && !backgroundGranted && Platform.OS === 'android') {
        try {
          const backgroundResult = await Location.requestBackgroundPermissionsAsync();
          console.log('Background permission result:', backgroundResult);
          backgroundGranted = backgroundResult.status === 'granted';
        } catch (backgroundError) {
          console.log('Background permission error (might be iOS):', backgroundError);
          // On iOS, background permissions are handled differently
          backgroundGranted = true;
        }
      }
      
      // For iOS, if foreground is granted, we consider background granted too
      if (Platform.OS === 'ios' && foregroundGranted) {
        backgroundGranted = true;
      }
      
      if (foregroundGranted && backgroundGranted) {
        setPermissionStatus('granted');
        Alert.alert('Success', 'Location permissions granted');
      } else if (foregroundGranted) {
        setPermissionStatus('partial');
        Alert.alert('Partial Access', 'Foreground permission granted but background permission denied');
      } else {
        setPermissionStatus('denied');
        Alert.alert('Permission Denied', 'Location permission is required for this feature');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions: ' + error.message);
    }
  };

  /**
   * Manual permission check
   */
  const manuallyCheckPermissions = async () => {
    try {
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      
      console.log('Manual permission check:', { foregroundStatus, backgroundStatus });
      
      if (foregroundStatus.status === 'granted' && backgroundStatus.status === 'granted') {
        setPermissionStatus('granted');
        Alert.alert('Permissions Status', 'All permissions granted');
      } else if (foregroundStatus.status === 'granted') {
        setPermissionStatus('partial');
        Alert.alert('Permissions Status', 'Foreground granted, background denied');
      } else if (foregroundStatus.status === 'denied' || backgroundStatus.status === 'denied') {
        setPermissionStatus('denied');
        Alert.alert('Permissions Status', 'Some permissions denied. Please enable in Settings.');
      } else {
        setPermissionStatus('undetermined');
        Alert.alert('Permissions Status', 'Permissions not yet requested');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      Alert.alert('Error', 'Failed to check permissions: ' + error.message);
    }
  };

  /**
   * Open app settings to manually grant permissions
   */
  const openAppSettings = async () => {
    try {
      // Try to open app settings
      const supported = await Linking.canOpenURL('app-settings:');
      if (supported) {
        await Linking.openURL('app-settings:');
      } else {
        // Fallback for Android
        if (Platform.OS === 'android') {
          await Linking.openSettings();
        } else {
          Alert.alert('Info', 'Please manually go to Settings > Apps > Expo Go > Permissions');
        }
      }
    } catch (error) {
      console.error('Error opening app settings:', error);
      Alert.alert('Error', 'Could not open settings: ' + error.message);
    }
  };

  /**
   * Toggle tracking on/off
   */
  const toggleTracking = async () => {
    if (isTracking) {
      // Stop tracking
      stopForegroundLocationUpdates();
      try {
        await stopBackgroundLocationUpdates();
      } catch (error) {
        console.warn('Error stopping background updates:', error);
      }
      setIsTracking(false);
      Alert.alert('Tracking Stopped', 'Location tracking has been disabled');
    } else {
      // Start tracking
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permissions first');
        return;
      }
      
      try {
        // Start foreground updates
        await startForegroundLocationUpdates(handleLocationUpdate);
        
        // Start background updates
        await startBackgroundLocationUpdates();
        
        setIsTracking(true);
        Alert.alert('Tracking Started', 'Location tracking is now active');
      } catch (error) {
        console.error('Error starting tracking:', error);
        Alert.alert('Error', 'Failed to start tracking: ' + error.message);
      }
    }
  };

  /**
   * Handle location updates from foreground service with adaptive logic
   */
  const handleLocationUpdate = async (location) => {
    console.debug('Foreground location update:', location);
    setCurrentLocation(location);
    
    // Apply the same adaptive logic as in background task
    try {
      // Create payload similar to background task
      const payload = {
        userId: 'user-123', // In a real app, this would come from auth
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        speed: location.coords.speed !== null ? location.coords.speed : 0,
        accuracy: location.coords.accuracy,
        timestamp: new Date(location.timestamp).toISOString()
      };
      
      // Check if we should send this location based on adaptive logic
      // We'll implement a simplified version here for demonstration
      const lastSent = getLastSentLocation();
      
      // If this is the first location or we should send based on adaptive logic
      let shouldSend = !lastSent;
      
      if (lastSent) {
        // Calculate distance from last sent location
        const distance = haversineDistance(
          lastSent.lat,
          lastSent.lon,
          payload.lat,
          payload.lon
        );
        
        // Calculate time since last sent (both in milliseconds now)
        const timeSinceLast = location.timestamp - lastSent.timestamp;
        
        // Get current interval based on speed
        const currentSpeed = payload.speed;
        const currentInterval = intervalFromSpeed(currentSpeed);
        
        console.debug(`Foreground - Distance: ${distance}m, Time since last: ${timeSinceLast}ms, Interval: ${currentInterval}ms`);
        
        // Check if enough time has passed and user has moved enough
        if (distance >= DISTANCE_THRESHOLD && timeSinceLast >= currentInterval) {
          shouldSend = true;
        }
      }
      
      if (shouldSend) {
        console.debug('Sending foreground location update');
        const success = await sendPayload(payload);
        if (success) {
          // Update the UI with the new last sent location
          setLastSentLocation({
            lat: payload.lat,
            lon: payload.lon,
            speed: payload.speed,
            timestamp: payload.timestamp
          });
        }
      } else {
        console.debug('Skipping foreground location update (adaptive logic)');
      }
    } catch (err) {
      console.error('Error processing foreground location:', err);
    }
  };

  /**
   * Clear the location buffer
   */
  const clearLocationBuffer = async () => {
    try {
      await clearBuffer();
      await updateBufferCount();
      Alert.alert('Success', 'Location buffer cleared');
    } catch (error) {
      console.error('Error clearing buffer:', error);
      Alert.alert('Error', 'Failed to clear buffer');
    }
  };

  /**
   * Show buffered locations
   */
  const showBufferedLocations = async () => {
    try {
      const buffer = await getBuffer();
      if (buffer.length === 0) {
        Alert.alert('Buffer Empty', 'No locations are currently buffered');
        return;
      }
      
      const message = `Buffered Locations: ${buffer.length}\n\n` +
        buffer.map((loc, index) => 
          `#${index + 1}: ${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)} @ ${new Date(loc.timestamp).toLocaleTimeString()}`
        ).join('\n\n');
        
      Alert.alert('Buffered Locations', message, [{ text: 'OK', style: 'cancel' }]);
    } catch (error) {
      console.error('Error showing buffer:', error);
      Alert.alert('Error', 'Failed to retrieve buffer');
    }
  };

  /**
   * Share current location via WhatsApp
   */
  const shareLocationViaWhatsApp = async () => {
    try {
      // Check if we have a current location
      if (!currentLocation) {
        Alert.alert('No Location', 'Please wait for location data before sharing');
        return;
      }

      // Format location message
      const latitude = currentLocation.coords.latitude;
      const longitude = currentLocation.coords.longitude;
      const accuracy = currentLocation.coords.accuracy;
      const speed = currentLocation.coords.speed !== null ? 
        (currentLocation.coords.speed * 3.6).toFixed(1) : 'N/A'; // Convert m/s to km/h
      
      const message = `📍 My Current Location:\n\n` +
        `Latitude: ${latitude.toFixed(6)}\n` +
        `Longitude: ${longitude.toFixed(6)}\n` +
        `Accuracy: ${accuracy?.toFixed(1) || 'N/A'} meters\n` +
        `Speed: ${speed} km/h\n\n` +
        `Shared via Adaptive Location Sharing App`;
      
      // Create Google Maps link
      const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
      
      // Combine message with maps link
      const fullMessage = `${message}\n\n${mapsLink}`;
      
      // Encode message for URL
      const encodedMessage = encodeURIComponent(fullMessage);
      
      // WhatsApp URL schemes
      let whatsappUrl;
      if (Platform.OS === 'android') {
        whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
      } else {
        whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
      }
      
      // Try to open WhatsApp
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback: Copy to clipboard and show alert
        await Clipboard.setStringAsync(fullMessage);
        Alert.alert(
          'WhatsApp Not Available',
          'WhatsApp is not installed on your device. Your location details have been copied to the clipboard.\n\n' +
          'You can paste this information into any messaging app.\n\n' +
          'Location details:\n' + fullMessage,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing location via WhatsApp:', error);
      Alert.alert('Error', 'Failed to share location via WhatsApp: ' + error.message);
    }
  };

  /**
   * Convert speed from m/s to km/h
   */
  const speedToKmh = (speed) => {
    return (speed * 3.6).toFixed(1);
  };

  /**
   * Calculate time ago string
   */
  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  /**
   * Calculate next interval based on last location speed
   */
  const getNextInterval = () => {
    if (!currentLocation || !currentLocation.coords) return 'Unknown';
    
    const speed = currentLocation.coords.speed !== null ? currentLocation.coords.speed : 0;
    const intervalMs = intervalFromSpeed(speed);
    
    if (intervalMs >= 60000) {
      return `${intervalMs / 60000} min`;
    } else {
      return `${intervalMs / 1000} sec`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Adaptive Location Sharing</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Tracking Status:</Text>
          <Switch
            value={isTracking}
            onValueChange={toggleTracking}
            disabled={permissionStatus !== 'granted'}
          />
          <Text style={[styles.value, isTracking ? styles.active : styles.inactive]}>
            {isTracking ? 'ACTIVE' : 'OFF'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={requestPermissions}
          disabled={permissionStatus === 'granted'}
        >
          <Text style={styles.buttonText}>
            {permissionStatus === 'granted' ? 'Permissions Granted' : 'Request Permissions'}
          </Text>
        </TouchableOpacity>
        
        {/* Add manual check button */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#9C27B0' }]} 
          onPress={manuallyCheckPermissions}
        >
          <Text style={styles.buttonText}>Check Permissions Status</Text>
        </TouchableOpacity>
        
        {/* Add open settings button */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#FF5722' }]} 
          onPress={openAppSettings}
        >
          <Text style={styles.buttonText}>Open App Settings</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Permissions:</Text>
          <Text style={styles.value}>{permissionStatus.toUpperCase()}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Network:</Text>
          <Text style={styles.value}>{networkStatus.toUpperCase()}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Buffered Points:</Text>
          <Text style={styles.value}>{bufferCount}</Text>
        </View>
        
        <TouchableOpacity style={styles.smallButton} onPress={showBufferedLocations}>
          <Text style={styles.smallButtonText}>View Buffered Locations</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.smallButton} onPress={clearLocationBuffer}>
          <Text style={styles.smallButtonText}>Clear Buffer</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Location</Text>
        
        {currentLocation ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Latitude:</Text>
              <Text style={styles.value}>{currentLocation.coords.latitude.toFixed(6)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Longitude:</Text>
              <Text style={styles.value}>{currentLocation.coords.longitude.toFixed(6)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Speed:</Text>
              <Text style={styles.value}>{speedToKmh(currentLocation.coords.speed)} km/h</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Accuracy:</Text>
              <Text style={styles.value}>{currentLocation.coords.accuracy?.toFixed(1) || 'N/A'} m</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Next Interval:</Text>
              <Text style={styles.value}>{getNextInterval()}</Text>
            </View>
            
            {/* Add WhatsApp share button */}
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#25D366' }]} 
              onPress={shareLocationViaWhatsApp}
            >
              <Text style={styles.buttonText}>Share via WhatsApp</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.placeholder}>Waiting for location...</Text>
        )}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Sent Location</Text>
        
        {lastSentLocation ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Latitude:</Text>
              <Text style={styles.value}>{lastSentLocation.lat.toFixed(6)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Longitude:</Text>
              <Text style={styles.value}>{lastSentLocation.lon.toFixed(6)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Speed:</Text>
              <Text style={styles.value}>{speedToKmh(lastSentLocation.speed)} km/h</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>Time:</Text>
              <Text style={styles.value}>{timeAgo(lastSentLocation.timestamp)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.placeholder}>No locations sent yet</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  label: {
    fontSize: 16,
    color: '#666',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  active: {
    color: '#4CAF50',
  },
  inactive: {
    color: '#F44336',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  smallButton: {
    backgroundColor: '#FF9800',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  placeholder: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 10,
  },
});