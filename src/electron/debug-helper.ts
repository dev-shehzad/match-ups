// Add this file to help with debugging

/**
 * Debug helper functions for browser view integration
 */

// Enable debug mode
const DEBUG = true

/**
 * Log a debug message if debug mode is enabled
 */
export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[BrowserView Debug]", ...args)
  }
}

/**
 * Log an error message
 */
export function debugError(...args: any[]) {
  console.error("[BrowserView Error]", ...args)
}

/**
 * Get the dimensions of an element for debugging
 */
export function getElementDimensions(element: HTMLElement | null) {
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
  }
}

/**
 * Check if an element is visible in the DOM
 */
export function isElementVisible(element: HTMLElement | null) {
  if (!element) return false

  const style = window.getComputedStyle(element)
  return (
    style.display !== "none" && style.visibility !== "hidden" && element.offsetWidth > 0 && element.offsetHeight > 0
  )
}

/**
 * Validate browser view bounds
 */
export function validateBounds(bounds: { x: number; y: number; width: number; height: number }) {
  const issues = []

  if (bounds.width <= 0) issues.push("Width must be greater than 0")
  if (bounds.height <= 0) issues.push("Height must be greater than 0")
  if (bounds.x < 0) issues.push("X position is negative")
  if (bounds.y < 0) issues.push("Y position is negative")

  return {
    valid: issues.length === 0,
    issues,
  }
}
