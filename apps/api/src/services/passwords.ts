import argon2 from 'argon2';

// argon2id with OWASP-recommended parameters (D-04): 19 MiB memory, 2 iterations, 1 lane.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Verified against when the email is unknown, so a failed login takes about as long either way.
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('styleme-dummy-password-for-timing');
  await verifyPassword(await dummyHash, password);
}
