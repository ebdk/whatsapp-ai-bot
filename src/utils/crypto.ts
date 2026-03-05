import crypto from 'node:crypto';

export function computeWhatsAppSignature(rawBody: Buffer, appSecret: string): string {
  const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

export function timingSafeSignatureCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
