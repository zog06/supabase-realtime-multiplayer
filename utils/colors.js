/**
 * Utility functions for generating and managing user colors
 */

// Predefined vibrant colors for users (excluding primary which is reserved for current user)
const USER_COLORS = [
  'bg-red-500',     // Red
  'bg-green-500',   // Green
  'bg-blue-500',    // Blue
  'bg-yellow-500',  // Yellow
  'bg-purple-500',  // Purple
  'bg-pink-500',    // Pink
  'bg-indigo-500',  // Indigo
  'bg-teal-500',    // Teal
  'bg-orange-500',  // Orange
  'bg-cyan-500',    // Cyan
];

// Color map to keep track of assigned colors
const colorMap = new Map();

/**
 * Get a consistent color for a user based on their ID
 * @param {string} userId - The user's ID
 * @param {boolean} isCurrentUser - Whether this is the current user
 * @returns {string} - Tailwind CSS class for the color
 */
export function getUserColor(userId, isCurrentUser = false) {
  // Current user always gets primary color
  if (isCurrentUser) {
    return 'bg-primary';
  }
  
  // If user already has an assigned color, return it
  if (colorMap.has(userId)) {
    return colorMap.get(userId);
  }
  
  // Assign a new color based on the current size of the map
  const colorIndex = colorMap.size % USER_COLORS.length;
  const color = USER_COLORS[colorIndex];
  
  // Store the color assignment
  colorMap.set(userId, color);
  
  return color;
}

/**
 * Get the text color name from a background color class
 * @param {string} bgColorClass - The background color class
 * @returns {string} - The color name without the bg- prefix
 */
export function getColorName(bgColorClass) {
  if (bgColorClass === 'bg-primary') {
    return 'Primary';
  }
  
  // Extract the color name from the class (e.g., 'bg-red-500' -> 'Red')
  const match = bgColorClass.match(/bg-([a-z]+)-\d+/);
  if (match && match[1]) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1);
  }
  
  return 'Unknown';
}

/**
 * Clear all color assignments
 */
export function resetColorMap() {
  colorMap.clear();
}
