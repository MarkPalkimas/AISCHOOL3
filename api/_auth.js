import { Clerk } from '@clerk/clerk-sdk-node';

let clerkInstance = null;

function getClerk() {
  if (clerkInstance) return clerkInstance;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing CLERK_SECRET_KEY');
  }
  clerkInstance = Clerk({ secretKey });
  return clerkInstance;
}

export async function verifyAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const clerk = getClerk();
    const decoded = await clerk.verifyToken(token);
    return decoded.sub;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}
