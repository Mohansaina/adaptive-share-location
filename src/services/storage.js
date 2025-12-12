import AsyncStorage from '@react-native-async-storage/async-storage';

const BUFFER_KEY = 'location_buffer';

/**
 * Save a location payload to the buffer
 * @param {Object} payload - Location data to buffer
 */
export async function saveBuffer(payload) {
  try {
    const existingBuffer = await getBuffer();
    existingBuffer.push(payload);
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(existingBuffer));
  } catch (error) {
    console.error('Error saving to buffer:', error);
  }
}

/**
 * Get all buffered location payloads
 * @returns {Promise<Array>} Array of buffered payloads
 */
export async function getBuffer() {
  try {
    const buffer = await AsyncStorage.getItem(BUFFER_KEY);
    return buffer ? JSON.parse(buffer) : [];
  } catch (error) {
    console.error('Error getting buffer:', error);
    return [];
  }
}

/**
 * Clear the location buffer
 */
export async function clearBuffer() {
  try {
    await AsyncStorage.removeItem(BUFFER_KEY);
  } catch (error) {
    console.error('Error clearing buffer:', error);
  }
}

/**
 * Get the number of buffered locations
 * @returns {Promise<number>} Count of buffered locations
 */
export async function getBufferCount() {
  try {
    const buffer = await getBuffer();
    return buffer.length;
  } catch (error) {
    console.error('Error getting buffer count:', error);
    return 0;
  }
}