import dotenv from 'dotenv';
import path from 'path';
import type { AppConfig } from './types.js';

dotenv.config();

export function loadConfig(): AppConfig {
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  const promoText = process.env.PROMO_TEXT || '';

  if (!email || !password) {
    console.error('Error: LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  return {
    linkedinEmail: email,
    linkedinPassword: password,
    promoText,
    dataDir: path.resolve('data'),
  };
}
