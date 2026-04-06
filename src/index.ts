import { Command } from 'commander';
import { login } from './steps/login.js';
import { scrape } from './steps/scrape.js';
import { generate } from './steps/generate.js';
import { review } from './steps/review.js';
import { send } from './steps/send.js';
import { closeBrowser } from './browser/puppeteer.js';

const program = new Command();

program
  .name('linkedin-auto')
  .description('LinkedIn comment reply & DM automation tool')
  .version('1.0.0');

program
  .command('run')
  .description('Full pipeline: post URL → scrape → generate → review → send')
  .argument('<url>', 'LinkedIn post URL')
  .action(async (url) => {
    try {
      await login();
      await scrape(url);
      await generate();
      await review();
      await send();
    } finally {
      await closeBrowser();
    }
  });

program
  .command('scrape')
  .description('Scrape comments from a specific post')
  .argument('<url>', 'LinkedIn post URL')
  .action(async (url) => {
    try {
      await login();
      await scrape(url);
    } finally {
      await closeBrowser();
    }
  });

program
  .command('generate')
  .description('Generate replies and DMs using Claude')
  .action(async () => {
    await generate();
  });

program
  .command('review')
  .description('Review and approve/modify/reject replies and DMs')
  .action(async () => {
    await review();
  });

program
  .command('send')
  .description('Send approved replies and DMs')
  .action(async () => {
    try {
      await login();
      await send();
    } finally {
      await closeBrowser();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
