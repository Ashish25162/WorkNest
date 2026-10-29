// Centralized API configuration for WorkNest
// In local development: defaults to '' so Vite proxy handles requests
// On Vercel: reads VITE_API_BASE_URL (e.g. 'https://my-backend.railway.app') or falls back to '' (if using Vercel rewrites)
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Returns the fully qualified API URL or relative path based on environment.
 * @param {string} path - e.g. '/api/workers' or 'api/workers'
 * @returns {string}
 */
export function apiUrl(path = '') {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Resolves static uploaded asset URLs (e.g. avatar images).
 * @param {string} photo - e.g. '/uploads/abc.jpg' or 'https://...'
 * @returns {string}
 */
export function assetUrl(photo) {
  if (!photo) return '';
  if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
    return photo;
  }
  const cleanPath = photo.startsWith('/') ? photo : `/${photo}`;
  return `${API_BASE_URL}${cleanPath}`;
}
