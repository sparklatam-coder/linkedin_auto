import readline from 'readline';
import { launchBrowser, getPage, delay } from '../browser/puppeteer.js';
import { loadConfig } from '../config.js';
import { readSession, writeSession } from '../data.js';
import type { Page } from 'puppeteer';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function restoreSession(page: Page): Promise<boolean> {
  const cookies = readSession();
  if (!cookies) return false;

  try {
    await page.setCookie(...(cookies as any[]));
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 15000 });
    const url = page.url();
    if (url.includes('/feed')) {
      console.log('Session restored from saved cookies.');
      return true;
    }
  } catch {
    // session expired
  }
  return false;
}

export async function login(): Promise<Page> {
  const config = loadConfig();
  const page = await launchBrowser();

  // Try restoring saved session first
  if (await restoreSession(page)) return page;

  console.log('Logging in to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

  // Enter credentials
  await page.type('#username', config.linkedinEmail, { delay: 50 });
  await page.type('#password', config.linkedinPassword, { delay: 50 });
  await delay(1000, 2000);

  // Click login
  await page.click('button[type="submit"]');
  await delay(3000, 5000);

  // Check for 2FA / verification challenge
  const currentUrl = page.url();
  if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
    console.log('2FA verification required. Check your email/phone.');
    const code = await prompt('Enter verification code: ');

    // Try to find and fill the verification input
    const inputSelector = 'input#input__email_verification_pin, input[name="pin"]';
    await page.waitForSelector(inputSelector, { timeout: 60000 });
    await page.type(inputSelector, code, { delay: 50 });
    await delay(500, 1000);

    // Submit verification
    const submitBtn = await page.$('button#email-pin-submit-button, button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await delay(3000, 5000);
  }

  // Verify login success
  try {
    await page.waitForSelector('.feed-shared-update-v2, .scaffold-layout__main', { timeout: 15000 });
    console.log('Login successful!');
  } catch {
    throw new Error('Login failed. Check your credentials or handle CAPTCHA manually.');
  }

  // Save session cookies
  const cookies = await page.cookies();
  writeSession(cookies as any[]);
  console.log('Session saved for future use.');

  return page;
}
