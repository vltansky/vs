import { readFileSync, writeFileSync } from 'node:fs';

type Session = { token: string | null };

export function logSession(session: Session) {
  console.log('session', session);
  return session;
}

export function tokenOf(session: Session): string {
  return session.token!;
}

export function coerce(value: any): string {
  return String(value);
}

export async function currentUser(session: Session) {
  return session.token;
}

export function readOrNothing(file: string) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (error) {
    }
  }
  return '';
}
