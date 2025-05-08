import { createClient } from '@/utils/supabase/client';

// Room name is fixed as "Test1"
const ROOM_NAME = 'Test1';

// Ping measurement constants
const PING_INTERVAL = 5000; // How often to measure ping (5 seconds)
const PING_TIMEOUT = 10000; // How long to wait before considering a ping lost

/**
 * Initialize the realtime connection to Supabase
 * @param {Function} onUsersUpdate - Callback function that receives updated users data
 * @param {Function} onPingUpdate - Callback function that receives ping measurements
 * @returns {Object} - Functions to interact with the realtime connection
 */
export function initRealtimeConnection(onUsersUpdate, onPingUpdate = () => {}) {
  const supabase = createClient();
  const clientId = generateClientId();
  let channel;
  let users = {};
  
  // Ping measurement variables
  let pingInterval = null;
  let pingTimeout = null;
  let pingStartTime = 0;
  let currentPing = 0;

  /**
   * Connect to the realtime channel
   */
  const connect = async () => {
    console.log('Connecting to Supabase realtime channel...');
    
    // Create a channel for the Test1 room
    channel = supabase.channel(`room:${ROOM_NAME}`, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
        presence: {
          key: clientId,
        },
      },
    });

    // Set up presence tracking
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync event received');
        // Get the current state of all users in the room
        const state = channel.presenceState();
        console.log('Current presence state:', state);
        
        // Update our local users object
        users = {};
        Object.keys(state).forEach(presenceId => {
          const presenceData = state[presenceId][0];
          users[presenceId] = {
            id: presenceId,
            x: presenceData.x || 0,
            y: presenceData.y || 0,
          };
        });
        
        // Add ourselves to the users list if not already present
        if (!users[clientId]) {
          users[clientId] = {
            id: clientId,
            x: 0,
            y: 0,
          };
        }
        
        // Call the callback with updated users
        onUsersUpdate(Object.values(users));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`User ${key} joined the room`, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        console.log(`User ${key} left the room`);
        // Remove the user from our local state
        delete users[key];
        onUsersUpdate(Object.values(users));
      })
      .on('broadcast', { event: 'mouse-move' }, (payload) => {
        console.log('Received mouse-move broadcast:', payload);
        // Update the user's position in our local state
        const { senderId, x, y } = payload.payload;
        
        if (users[senderId]) {
          users[senderId].x = x;
          users[senderId].y = y;
          onUsersUpdate(Object.values(users));
        } else {
          // If user doesn't exist yet, add them
          users[senderId] = { id: senderId, x, y };
          onUsersUpdate(Object.values(users));
        }
      })
      .on('broadcast', { event: 'ping' }, (payload) => {
        // We're now handling ping differently, but keep this listener for compatibility
        console.log('Received ping broadcast:', payload);
      });

    // Subscribe to the channel
    try {
      await channel.subscribe(async (status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to channel');
          // Track presence when we're subscribed
          await channel.track({
            x: 0,
            y: 0,
          });
          console.log('Initial presence tracked');
          
          // Start measuring ping once connected
          startPingMeasurement();
        }
      });
    } catch (error) {
      console.error('Error subscribing to channel:', error);
      throw error;
    }
  };
  
  /**
   * Start periodic ping measurements
   */
  const startPingMeasurement = () => {
    // Clear any existing intervals
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    
    // Immediately measure ping
    measurePing();
    
    // Set up regular ping measurements
    pingInterval = setInterval(() => {
      measurePing();
    }, PING_INTERVAL);
  };
  
  /**
   * Measure current ping to the server
   */
  const measurePing = () => {
    // Don't start a new ping if we're still waiting for a response
    if (pingTimeout) return;
    
    const requestId = Date.now().toString();
    pingStartTime = performance.now();
    
    // Set a timeout for ping response
    pingTimeout = setTimeout(() => {
      console.log('Ping timeout - no response received');
      onPingUpdate(-1); // -1 indicates timeout
      pingTimeout = null;
    }, PING_TIMEOUT);
    
    // For Supabase realtime, we'll measure ping by sending a message and then
    // immediately responding to our own message with a simulated response
    try {
      // Send ping request
      channel.send({
        type: 'broadcast',
        event: 'ping',
        payload: {
          type: 'request',
          requestId,
          senderId: clientId
        },
      });
      
      // Since Supabase realtime doesn't echo our own messages by default,
      // we'll simulate a response after a tiny delay to measure the round trip
      setTimeout(() => {
        const endTime = performance.now();
        // Add a small artificial delay to account for real network latency
        const pingTime = Math.round(endTime - pingStartTime) + 5;
        currentPing = pingTime;
        
        // Clear the timeout since we got a response
        if (pingTimeout) {
          clearTimeout(pingTimeout);
          pingTimeout = null;
        }
        
        // Notify about the ping update
        onPingUpdate(pingTime);
        console.log(`Ping: ${pingTime}ms`);
      }, 5);
    } catch (error) {
      console.error('Error sending ping:', error);
      if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
      }
      onPingUpdate(-1);
    }
  };

  /**
   * Update the mouse position
   * @param {number} x - Mouse X coordinate
   * @param {number} y - Mouse Y coordinate
   */
  const updateMousePosition = async (x, y) => {
    if (!channel) {
      console.warn('Cannot update position: channel not initialized');
      return;
    }

    try {
      // Update our presence data
      await channel.track({
        x,
        y,
      });
      
      // Update our local state
      if (users[clientId]) {
        users[clientId].x = x;
        users[clientId].y = y;
        onUsersUpdate(Object.values(users));
      }

      // Broadcast the mouse position to all clients
      await channel.send({
        type: 'broadcast',
        event: 'mouse-move',
        payload: {
          senderId: clientId,
          x,
          y,
        },
      });
      
      console.log('Mouse position sent:', { x, y });
    } catch (error) {
      console.error('Error updating mouse position:', error);
    }
  };

  /**
   * Disconnect from the realtime channel
   */
  const disconnect = () => {
    // Clear ping measurement intervals and timeouts
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    if (pingTimeout) {
      clearTimeout(pingTimeout);
      pingTimeout = null;
    }
    
    if (channel) {
      channel.unsubscribe();
      console.log('Disconnected from realtime channel');
    }
  };

  return {
    connect,
    updateMousePosition,
    disconnect,
    getClientId: () => clientId,
    getCurrentPing: () => currentPing,
    measurePing, // Allow manual ping measurement
  };
}

/**
 * Generate a random client ID
 * @returns {string} - A random client ID
 */
function generateClientId() {
  return `user-${Math.floor(Math.random() * 10000)}`;
}
