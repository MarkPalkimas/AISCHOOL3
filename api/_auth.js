export async function verifyAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decodedJson = Buffer.from(payload, 'base64').toString('utf8');
    const decoded = JSON.parse(decodedJson);
    return decoded?.sub || null;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}
