/**
 * A utility for smoothly interpolating between positions with advanced smoothing
 */

/**
 * Create a new interpolated position tracker with enhanced smoothness
 * @param {Object} initialPosition - The initial position {x, y}
 * @param {number} smoothFactor - How smooth the interpolation should be (0-1, lower = smoother)
 * @param {number} maxSpeed - Maximum speed in pixels per frame (optional)
 * @returns {Object} - An object with methods to update and get the interpolated position
 */
export function createInterpolatedPosition(initialPosition = { x: 0, y: 0 }, smoothFactor = 0.2, maxSpeed = 30) {
  // Current interpolated position
  let currentPosition = { ...initialPosition };
  
  // Target position (where we're moving towards)
  let targetPosition = { ...initialPosition };
  
  // Velocity for momentum-based movement
  let velocity = { x: 0, y: 0 };
  
  // Previous positions for trail effect
  const trailPositions = Array(5).fill().map(() => ({ ...initialPosition }));
  
  // Last animation frame ID for cancellation
  let animationFrameId = null;
  
  // Whether the animation is running
  let isAnimating = false;
  
  // Last update timestamp for consistent animation speed
  let lastUpdateTime = 0;
  
  /**
   * Update the target position
   * @param {Object} newPosition - The new target position {x, y}
   */
  const updateTargetPosition = (newPosition) => {
    targetPosition = { ...newPosition };
    
    // Start animation if not already running
    if (!isAnimating) {
      lastUpdateTime = performance.now();
      startAnimation();
    }
  };
  
  /**
   * Start the animation loop
   */
  const startAnimation = () => {
    isAnimating = true;
    animationFrameId = requestAnimationFrame(animate);
  };
  
  /**
   * Animation loop with improved physics
   */
  const animate = (timestamp) => {
    // Calculate time delta for frame-rate independent movement
    const deltaTime = Math.min(timestamp - lastUpdateTime, 33) / 16.67; // Cap at ~60fps equivalent
    lastUpdateTime = timestamp;
    
    // Calculate distance to target
    const dx = targetPosition.x - currentPosition.x;
    const dy = targetPosition.y - currentPosition.y;
    
    // Calculate distance
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If we're very close to the target, just snap to it
    const isCloseEnough = distance < 0.5;
    
    if (isCloseEnough) {
      velocity = { x: 0, y: 0 };
      currentPosition = { ...targetPosition };
      isAnimating = false;
    } else {
      // Apply spring physics for smoother movement
      // Spring force + damping
      const springFactor = smoothFactor * deltaTime;
      const dampingFactor = 0.7; // Damping to prevent oscillation
      
      // Update velocity with spring physics
      velocity.x = velocity.x * dampingFactor + dx * springFactor;
      velocity.y = velocity.y * dampingFactor + dy * springFactor;
      
      // Limit velocity to max speed
      const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (currentSpeed > maxSpeed) {
        const scaleFactor = maxSpeed / currentSpeed;
        velocity.x *= scaleFactor;
        velocity.y *= scaleFactor;
      }
      
      // Update position based on velocity
      currentPosition.x += velocity.x;
      currentPosition.y += velocity.y;
      
      // Update trail positions
      trailPositions.pop(); // Remove last position
      trailPositions.unshift({ ...currentPosition }); // Add current position to front
      
      // Continue animation
      animationFrameId = requestAnimationFrame(animate);
    }
  };
  
  /**
   * Get the current interpolated position
   * @returns {Object} - The current position {x, y}
   */
  const getCurrentPosition = () => {
    return { ...currentPosition };
  };
  
  /**
   * Get trail positions for visual effects
   * @returns {Array} - Array of previous positions
   */
  const getTrailPositions = () => {
    return [...trailPositions];
  };
  
  /**
   * Clean up resources
   */
  const cleanup = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    isAnimating = false;
  };
  
  return {
    updateTargetPosition,
    getCurrentPosition,
    getTrailPositions,
    cleanup
  };
}
