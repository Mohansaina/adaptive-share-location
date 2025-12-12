# Adaptive Location Sharing

An intelligent location sharing application built with React Native and Expo that adapts location update frequency based on user movement speed. This app efficiently tracks and shares location while minimizing battery consumption.

## Features

- **Adaptive Location Tracking**: Automatically adjusts location update frequency based on user movement speed
- **Background Location Updates**: Continues tracking even when the app is in the background
- **Offline Buffering**: Stores location data when offline and syncs when connectivity is restored
- **WhatsApp Integration**: Share your current location via WhatsApp with a single tap
- **Cross-Platform**: Works on both iOS and Android devices
- **Battery Efficient**: Optimized algorithms to minimize power consumption

## Technology Stack

- **React Native** - Cross-platform mobile development framework
- **Expo** - Managed workflow for React Native development
- **expo-location** - Geolocation APIs for foreground and background tracking
- **expo-task-manager** - Background task execution
- **@react-native-async-storage/async-storage** - Persistent data storage
- **expo-network** - Network connectivity detection
- **expo-clipboard** - Clipboard functionality for sharing

## Architecture

```
adaptive-location-share/
├── src/
│   ├── navigation/          # App navigation setup
│   ├── screens/             # UI screens
│   ├── services/            # Business logic and utilities
│   └── tasks/              # Background tasks
├── mock-server/            # Development server for testing
└── assets/                 # Images and static assets
```

## Adaptive Algorithm

The app uses a speed-based adaptive algorithm to optimize location updates:

- **High Speed (>10 m/s)**: Updates every 30 seconds
- **Medium Speed (2-10 m/s)**: Updates every 60 seconds
- **Low Speed (<2 m/s)**: Updates every 5 minutes
- **Stationary (0 m/s)**: Updates every 15 minutes

Additionally, location updates are triggered when the user moves more than 10 meters from the last recorded position.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Mohansaina/adaptive-share-location.git
   ```

2. Navigate to the project directory:
   ```bash
   cd adaptive-share-location
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Development Setup

### Prerequisites

- Node.js (version 14 or higher)
- Expo CLI
- Mobile device with Expo Go app installed

### Running the Application

1. Start the mock server (for development testing):
   ```bash
   npm run mock-server
   ```

2. Start the Expo development server:
   ```bash
   npx expo start --tunnel
   ```

3. Scan the QR code with the Expo Go app on your mobile device

### Testing Location Sharing

1. Grant location permissions when prompted
2. Toggle the tracking switch to start location sharing
3. Use the "Share via WhatsApp" button to share your current location

## Project Structure

```
src/
├── navigation/
│   └── AppNavigator.js     # Stack navigator setup
├── screens/
│   └── TrackingScreen.js   # Main UI with location controls
├── services/
│   ├── locationService.js  # Core adaptive location logic
│   └── storage.js          # AsyncStorage buffer implementation
└── tasks/
    └── locationTask.js     # Background location task handler
```

## Key Components

### TrackingScreen.js

The main user interface that displays:
- Current location information
- Tracking status controls
- Last sent location details
- Network connectivity status
- Buffered location count
- WhatsApp sharing functionality

### locationService.js

Implements the adaptive location logic:
- `intervalFromSpeed()` - Calculates update intervals based on speed
- `haversineDistance()` - Calculates distance between coordinates
- `sendPayload()` - Sends location data to the server
- `flushBuffer()` - Syncs buffered locations when online

### locationTask.js

Handles background location updates using Expo's task manager:
- Registers background location task
- Processes location updates in the background
- Stores locations in buffer when offline

### storage.js

Manages offline data persistence:
- `addToBuffer()` - Adds locations to storage
- `getBuffer()` - Retrieves stored locations
- `clearBuffer()` - Clears stored locations

## Troubleshooting

### Common Issues

1. **Java Casting Errors in Expo Go**:
   - Clear npm cache: `npm cache clean --force`
   - Remove node_modules and reinstall dependencies
   - Restart the development server

2. **Location Permissions**:
   - Ensure all location permissions are granted
   - Check device settings for app permissions

3. **Network Connectivity**:
   - Verify the mock server is running
   - Check device internet connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React Native and Expo
- Uses adaptive algorithms for efficient location tracking
- Inspired by modern location-sharing applications