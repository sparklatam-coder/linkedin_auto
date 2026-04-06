import readline from 'readline';
import { launchBrowser, delay } from '../browser/puppeteer.js';
import { loadConfig } from '../config.js';
import { readSession, writeSession } from '../data.js';
import type { AppConfig } from '../types.js';
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
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
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

async function loginWithGoogle(page: Page, config: AppConfig): Promise<void> {
  console.log('Logging in to LinkedIn via Google...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(1000, 2000);

  // Click "Sign in with Google" button
  const googleBtn = await page.$('button[data-litms-control-urn="google-sign-in"], a[href*="google"], button.google-sign-in');
  if (!googleBtn) {
    // Try finding by text content
    const buttons = await page.$$('button, a');
    let found = false;
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent?.trim() || '', btn);
      if (text.toLowerCase().includes('google')) {
        await btn.click();
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error('Could not find "Sign in with Google" button on LinkedIn login page.');
    }
  } else {
    await googleBtn.click();
  }

  await delay(2000, 3000);

  // Google OAuth popup or redirect — handle new page/tab
  const pages = await page.browser().pages();
  const googlePage = pages.length > 1 ? pages[pages.length - 1] : page;

  // Wait for Google login page to load
  await googlePage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000, timeout: 15000 }).catch(() => {});
  await delay(1000, 2000);

  // Enter Google email
  const emailInput = await googlePage.waitForSelector('input[type="email"]', { timeout: 15000 });
  if (emailInput) {
    await emailInput.type(config.googleEmail, { delay: 50 });
    await delay(500, 1000);

    // Click Next
    const nextBtn = await googlePage.$('#identifierNext, button[type="button"]');
    if (nextBtn) await nextBtn.click();
    await delay(2000, 3000);
  }

  // Enter Google password
  const passwordInput = await googlePage.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
  if (passwordInput) {
    await passwordInput.type(config.googlePassword, { delay: 50 });
    await delay(500, 1000);

    // Click Next
    const passNextBtn = await googlePage.$('#passwordNext, button[type="button"]');
    if (passNextBtn) await passNextBtn.click();
    await delay(3000, 5000);
  }

  // Handle Google 2FA if prompted
  const currentGoogleUrl = googlePage.url();
  if (currentGoogleUrl.includes('challenge') || currentGoogleUrl.includes('signin/v2')) {
    console.log('Google 2FA required. Check your phone or authenticator app.');
    const code = await prompt('Enter Google verification code: ');

    const codeInput = await googlePage.waitForSelector('input[type="tel"], input[name="totpPin"], input[type="text"]', { timeout: 60000 });
    if (codeInput) {
      await codeInput.type(code, { delay: 50 });
      await delay(500, 1000);

      const verifyBtn = await googlePage.$('#totpNext, button[type="button"]');
      if (verifyBtn) await verifyBtn.click();
      await delay(3000, 5000);
    }
  }

  // If Google opened in a new tab, it should redirect back to LinkedIn
  // Wait for LinkedIn feed to load on the original page
  if (googlePage !== page) {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000, timeout: 30000 }).catch(() => {});
  }
}

async function loginDirect(page: Page, config: AppConfig): Promise<void> {
  console.log('Logging in to LinkedIn with email/password...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.type('#username', config.linkedinEmail, { delay: 50 });
  await page.type('#password', config.linkedinPassword, { delay: 50 });
  await delay(1000, 2000);

  await page.click('button[type="submit"]');
  await delay(3000, 5000);

  // Check for LinkedIn 2FA — let the user handle it in the browser
  const currentUrl = page.url();
  if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
    console.log('2FA verification required. Please complete it in the browser window.');
    console.log('Waiting for you to finish verification...');
    // Poll until the URL changes away from checkpoint/challenge
    while (true) {
      await delay(2000, 3000);
      const url = page.url();
      if (!url.includes('checkpoint') && !url.includes('challenge')) break;
    }
    await delay(2000, 3000);
  }
}

export async function login(): Promise<Page> {
  const config = loadConfig();
  const page = await launchBrowser();

  // Try restoring saved session first
  if (await restoreSession(page)) return page;

  // Login based on configured method
  if (config.loginMethod === 'google') {
    await loginWithGoogle(page, config);
  } else {
    await loginDirect(page, config);
  }

  // Verify login success — wait for feed page URL
  console.log('Waiting for login to complete...');
  for (let i = 0; i < 60; i++) {
    await delay(2000, 3000);
    const url = page.url();
    if (url.includes('/feed') || url.includes('/mynetwork') || url.includes('/in/')) {
      console.log('Login successful!');
      break;
    }
    if (i === 59) {
      throw new Error('Login timed out. Please try again.');
    }
  }

  // Save session cookies
  const cookies = await page.cookies();
  writeSession(cookies as any[]);
  console.log('Session saved for future use.');

  return page;
}
