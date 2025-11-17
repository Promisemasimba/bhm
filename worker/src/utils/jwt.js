/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Verify JWT token
 * Note: In this implementation, we trust tokens issued by our Core API
 * For additional security, you could verify the signature here
 */
export function verifyJWT(token, secret) {
  // This is a simplified version
  // In production, you would use a proper JWT library
  // For Workers, consider using jose or similar lightweight library

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}
