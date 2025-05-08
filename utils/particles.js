/**
 * Creates a particle system for cursor trails
 * @param {string} color - The color of the particles (in hex or rgba format)
 * @param {number} lifetime - How long particles live in milliseconds
 * @param {number} size - Starting size of particles in pixels
 * @param {number} decay - How quickly particles fade (0-1)
 * @returns {Object} Particle system controller
 */
export function createParticleSystem(color = 'rgba(255, 255, 255, 0.7)', lifetime = 800, size = 5, decay = 0.95) {
  let particles = [];
  let lastPosition = null;
  let emissionRate = 3; // Pixels between particle emissions
  let distanceSinceLastEmit = 0;
  
  /**
   * Create a new particle at the given position
   */
  const createParticle = (x, y) => {
    // Random offset for more natural look
    const offsetX = (Math.random() - 0.5) * 3;
    const offsetY = (Math.random() - 0.5) * 3;
    
    particles.push({
      x: x + offsetX,
      y: y + offsetY,
      size: size * (0.7 + Math.random() * 0.3), // Slightly random size
      alpha: 0.7 + Math.random() * 0.3, // Slightly random alpha
      createdAt: performance.now(),
      lifetime: lifetime * (0.8 + Math.random() * 0.4), // Slightly random lifetime
    });
  };
  
  /**
   * Update the particle system with a new cursor position
   */
  const update = (position) => {
    const now = performance.now();
    
    // Update existing particles (fade them out)
    particles = particles.filter(particle => {
      const age = now - particle.createdAt;
      return age < particle.lifetime;
    });
    
    // Emit new particles based on movement
    if (lastPosition && position) {
      // Calculate distance moved
      const dx = position.x - lastPosition.x;
      const dy = position.y - lastPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Add to distance counter
      distanceSinceLastEmit += distance;
      
      // Emit particles along the path if we've moved enough
      if (distanceSinceLastEmit >= emissionRate) {
        const steps = Math.floor(distanceSinceLastEmit / emissionRate);
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 0; i < steps; i++) {
          const emitX = lastPosition.x + stepX * i;
          const emitY = lastPosition.y + stepY * i;
          createParticle(emitX, emitY);
        }
        
        distanceSinceLastEmit = distanceSinceLastEmit % emissionRate;
      }
    }
    
    // Update last position
    lastPosition = { ...position };
  };
  
  /**
   * Render all particles to a canvas context
   */
  const render = (ctx) => {
    const now = performance.now();
    
    particles.forEach(particle => {
      const age = now - particle.createdAt;
      const lifePercent = age / particle.lifetime;
      const fadeAlpha = particle.alpha * (1 - lifePercent);
      const fadeSize = particle.size * (1 - lifePercent * 0.5);
      
      ctx.globalAlpha = fadeAlpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, fadeSize, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Reset global alpha
    ctx.globalAlpha = 1;
  };
  
  /**
   * Clear all particles
   */
  const clear = () => {
    particles = [];
    lastPosition = null;
  };
  
  return {
    update,
    render,
    clear,
    getParticleCount: () => particles.length
  };
}
