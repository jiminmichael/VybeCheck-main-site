import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { finalizePayout } from '../server/firebaseRoutes';

const reference = process.argv[2];
if (!reference) throw new Error('Usage: npm run payout:finalize -- payout-reference');
const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const otp = await terminal.question('Business-owner transfer OTP (local terminal only): ');
  await finalizePayout(reference, otp.trim());
  console.log('Transfer authorization submitted. Check payout history for its confirmed status.');
} finally { terminal.close(); }
