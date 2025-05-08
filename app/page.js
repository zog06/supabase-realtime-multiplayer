"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initRealtimeConnection } from "@/data/connectRealtime";
import { createInterpolatedPosition } from "@/utils/interpolation";
import { getUserColor, getColorName } from "@/utils/colors";
import { createParticleSystem } from "@/utils/particles";
import { PingIndicator } from "@/components/ping-indicator";
import "./grid-background.css";

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [interpolatedUsers, setInterpolatedUsers] = useState([]);
  const [clientId, setClientId] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [pingMs, setPingMs] = useState(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const rawUsersRef = useRef([]);
  const userInterpolatorsRef = useRef({});
  const userParticlesRef = useRef({});
  const realtimeConnectionRef = useRef(null);
  const throttleRef = useRef(false);

  // Initialize realtime connection
  useEffect(() => {
    const initConnection = async () => {
      try {
        console.log("Initializing realtime connection...");
        
        // Initialize the connection with callbacks for users and ping updates
        const connection = initRealtimeConnection(
          // Users update callback
          (updatedUsers) => {
            console.log("Users updated:", updatedUsers);
            rawUsersRef.current = updatedUsers;
            
            // Update or create interpolators for each user
            updatedUsers.forEach(user => {
              if (!userInterpolatorsRef.current[user.id]) {
                // Create a new interpolator for this user with appropriate smoothness
                const isCurrentUser = user.id === clientId;
                userInterpolatorsRef.current[user.id] = createInterpolatedPosition(
                  { x: user.x, y: user.y },
                  isCurrentUser ? 1.0 : 0.08, // Ultra smooth for other users (lower = smoother)
                  isCurrentUser ? 100 : 20    // Max speed (pixels per frame)
                );
                
                // Create a particle system for this user
                if (!isCurrentUser) { // Only create particles for other users
                  const userColor = getUserColor(user.id);
                  userParticlesRef.current[user.id] = createParticleSystem(
                    userColor, // Use the same color as the user's cursor
                    800,      // Particle lifetime in ms
                    4,        // Particle size
                    0.95      // Particle decay rate
                  );
                }
              } else {
                // Update the target position for existing interpolator
                userInterpolatorsRef.current[user.id].updateTargetPosition({
                  x: user.x,
                  y: user.y
                });
              }
            });
            
            // Remove interpolators and particle systems for users who left
            Object.keys(userInterpolatorsRef.current).forEach(userId => {
              if (!updatedUsers.some(user => user.id === userId)) {
                userInterpolatorsRef.current[userId].cleanup();
                delete userInterpolatorsRef.current[userId];
                
                // Clean up particle system if it exists
                if (userParticlesRef.current[userId]) {
                  userParticlesRef.current[userId].clear();
                  delete userParticlesRef.current[userId];
                }
              }
            });
          },
          // Ping update callback
          (pingTime) => {
            setPingMs(pingTime);
          }
        );
        
        realtimeConnectionRef.current = connection;

        // Store the client ID
        const id = connection.getClientId();
        setClientId(id);
        console.log("Client ID:", id);

        // Connect to the realtime channel
        await connection.connect();
        setConnectionStatus("connected");
        console.log("Connected to realtime channel");
      } catch (error) {
        console.error("Error connecting to realtime:", error);
        setConnectionStatus("error");
      }
    };

    initConnection();

    // Cleanup function
    return () => {
      // Clean up all interpolators
      Object.values(userInterpolatorsRef.current).forEach(interpolator => {
        interpolator.cleanup();
      });
      
      // Clean up all particle systems
      Object.values(userParticlesRef.current).forEach(particles => {
        particles.clear();
      });
      
      if (realtimeConnectionRef.current) {
        realtimeConnectionRef.current.disconnect();
      }
    };
  }, []);

  // Animation frame for smooth cursor updates
  useEffect(() => {
    let animationFrameId;
    
    const updateInterpolatedPositions = () => {
      // Get current interpolated positions for all users
      const interpolated = rawUsersRef.current.map(user => {
        const interpolator = userInterpolatorsRef.current[user.id];
        if (interpolator) {
          const position = interpolator.getCurrentPosition();
          return {
            ...user,
            x: position.x,
            y: position.y
          };
        }
        return user;
      });
      
      setInterpolatedUsers(interpolated);
      animationFrameId = requestAnimationFrame(updateInterpolatedPositions);
    };
    
    animationFrameId = requestAnimationFrame(updateInterpolatedPositions);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Track mouse movements and update position in realtime
  useEffect(() => {
    const handleMouseMove = (event) => {
      const newPosition = { x: event.clientX, y: event.clientY };
      setMousePosition(newPosition);

      // Throttle updates to avoid overwhelming the connection
      if (!throttleRef.current && connectionStatus === "connected" && realtimeConnectionRef.current) {
        throttleRef.current = true;
        
        // Update position in realtime
        realtimeConnectionRef.current.updateMousePosition(newPosition.x, newPosition.y)
          .catch(error => console.error("Error updating mouse position:", error));
        
        // Reset throttle after a short delay
        setTimeout(() => {
          throttleRef.current = false;
        }, 33); // ~30fps update rate (smoother than before)
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [connectionStatus]);

  // Render a cursor with trail effect for ultra-smooth visuals
  const renderCursor = (user) => {
    const isCurrentUser = user.id === clientId;
    const colorClass = getUserColor(user.id, isCurrentUser);
    const interpolator = userInterpolatorsRef.current[user.id];
    
    // Skip if no interpolator exists
    if (!interpolator) return null;
    
    // Get trail positions for this user if they're not the current user
    const trailPositions = !isCurrentUser ? interpolator.getTrailPositions() : [];
    
    return (
      <div key={user.id}>
        {/* Render trail dots for other users */}
        {!isCurrentUser && trailPositions.map((pos, index) => {
          // Skip the first position as it's the main cursor
          if (index === 0) return null;
          
          // Calculate size and opacity based on position in trail
          const size = 10 - index * 1.6;
          const opacity = 0.6 - index * 0.12;
          
          return (
            <div 
              key={`trail-${index}`}
              className="absolute pointer-events-none"
              style={{ 
                left: `${pos.x}px`, 
                top: `${pos.y}px`,
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
              }}
            >
              <div 
                className={`rounded-full ${colorClass}`} 
                style={{ 
                  opacity, 
                  width: '100%', 
                  height: '100%',
                  filter: 'blur(1px)'
                }}
              />
            </div>
          );
        })}
        
        {/* Main cursor dot */}
        <div 
          className="absolute pointer-events-none"
          style={{ 
            left: `${user.x}px`, 
            top: `${user.y}px`,
            transform: 'translate(-50%, -50%)',
            width: isCurrentUser ? '12px' : '10px',
            height: isCurrentUser ? '12px' : '10px',
            transition: isCurrentUser ? 'none' : 'transform 0.05s ease-out'
          }}
        >
          <div 
            className={`w-full h-full rounded-full ${colorClass} shadow-md`} 
            style={{ 
              opacity: 0.85,
              boxShadow: isCurrentUser ? '0 0 8px rgba(255,255,255,0.6)' : '0 0 4px rgba(255,255,255,0.3)'
            }}
          />
        </div>
      </div>
    );
  };

  // Get color indicator for the user list
  const getUserColorIndicator = (userId) => {
    const isCurrentUser = userId === clientId;
    const colorClass = getUserColor(userId, isCurrentUser);
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full ${colorClass} shadow-sm`}></div>
        <span>{userId === clientId ? 'You' : userId}</span>
      </div>
    );
  };

  // Ping status is now handled by the PingIndicator component

  return (
    <div className="relative min-h-screen bg-background text-foreground blueprint-grid">
      {/* Mouse cursors for each user with smooth interpolation */}
      {interpolatedUsers.map(renderCursor)}
      
      {/* Header */}
      <header className="fixed top-0 left-0 w-full p-4 z-10 bg-background/80 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-primary">Zog's Multiplayer Experience</h1>
      </header>
      
      {/* Ping indicator with Shadcn UI styling */}
      <PingIndicator pingMs={pingMs} />
      
      {/* Main content */}
      <main className="container mx-auto pt-20 p-4">
        <Card className="w-full max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Mouse Position Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <p className="text-muted-foreground">Move your mouse around the screen to see your position.</p>
                <p className="mt-2">Current position: X: {Math.round(mousePosition.x)}, Y: {Math.round(mousePosition.y)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: {connectionStatus === "connected" ? (
                    <span className="text-green-500">Connected to room "Test1"</span>
                  ) : connectionStatus === "connecting" ? (
                    <span className="text-yellow-500">Connecting...</span>
                  ) : (
                    <span className="text-red-500">Connection error</span>
                  )}
                </p>
              </div>
              
              <div className="border rounded-md p-4 bg-card/50">
                <h3 className="font-medium mb-2">Connected Users ({interpolatedUsers.length})</h3>
                {interpolatedUsers.length > 0 ? (
                  <ul className="space-y-2">
                    {interpolatedUsers.map(user => (
                      <li key={user.id} className="flex justify-between items-center">
                        {getUserColorIndicator(user.id)}
                        <span className="text-muted-foreground">X: {Math.round(user.x)}, Y: {Math.round(user.y)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No users connected</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
