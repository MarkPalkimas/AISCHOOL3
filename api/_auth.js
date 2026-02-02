import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

export async function verifyAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = await clerk.verifyToken(token);
    return decoded.sub;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}
