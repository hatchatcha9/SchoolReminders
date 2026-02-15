import { getCurrentSession } from './session';
import { getCredential } from '../db';
import { decryptCredentials } from './encryption';

export interface CanvasCredentials {
  token: string;
}

export interface SkywardCredentials {
  username: string;
  password: string;
}

/**
 * Get Canvas credentials for the current user
 */
export async function getCanvasCredentials(): Promise<CanvasCredentials | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const credential = getCredential(session.user.id, 'canvas');
  if (!credential) return null;

  try {
    const decrypted = decryptCredentials(
      credential.encrypted_data,
      credential.iv,
      credential.auth_tag
    );
    if ('token' in decrypted && typeof decrypted.token === 'string') {
      return { token: decrypted.token };
    }
    return null;
  } catch (error) {
    console.error('Failed to decrypt Canvas credentials:', error);
    return null;
  }
}

/**
 * Get Skyward credentials for the current user
 */
export async function getSkywardCredentials(): Promise<SkywardCredentials | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const credential = getCredential(session.user.id, 'skyward');
  if (!credential) return null;

  try {
    const decrypted = decryptCredentials(
      credential.encrypted_data,
      credential.iv,
      credential.auth_tag
    );
    if (
      'username' in decrypted &&
      'password' in decrypted &&
      typeof decrypted.username === 'string' &&
      typeof decrypted.password === 'string'
    ) {
      return { username: decrypted.username, password: decrypted.password };
    }
    return null;
  } catch (error) {
    console.error('Failed to decrypt Skyward credentials:', error);
    return null;
  }
}
