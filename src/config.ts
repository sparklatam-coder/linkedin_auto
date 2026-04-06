import dotenv from 'dotenv';
import path from 'path';
import type { AppConfig } from './types.js';

dotenv.config();

export function loadConfig(): AppConfig {
  const loginMethod = (process.env.LOGIN_METHOD || 'google') as 'google' | 'direct';
  const promoText = process.env.PROMO_TEXT || '';

  if (loginMethod === 'google') {
    const googleEmail = process.env.GOOGLE_EMAIL;
    const googlePassword = process.env.GOOGLE_PASSWORD;
    if (!googleEmail || !googlePassword) {
      console.error('Error: GOOGLE_EMAIL and GOOGLE_PASSWORD must be set in .env');
      process.exit(1);
    }
    return {
      loginMethod,
      linkedinEmail: '',
      linkedinPassword: '',
      googleEmail,
      googlePassword,
      promoText,
      dataDir: path.resolve('data'),
    };
  }

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password) {
    console.error('Error: LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  return {
    loginMethod,
    linkedinEmail: email,
    linkedinPassword: password,
    googleEmail: '',
    googlePassword: '',
    promoText,
    dataDir: path.resolve('data'),
  };
}
