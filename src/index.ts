import { Command } from 'commander';
import { login } from './steps/login.js';
import { scrape } from './steps/scrape.js';
import { generate } from './steps/generate.js';
import { review, autoApprove } from './steps/review.js';
import { send } from './steps/send.js';
import { closeBrowser } from './browser/puppeteer.js';

const program = new Command();

program
  .name('linkedin-auto')
  .description('LinkedIn comment reply & DM automation tool')
  .version('2.0.0');

program
  .command('run')
  .description('Full pipeline: scrape → approve → 1촌체크 → DM → 대댓글')
  .argument('<url>', 'LinkedIn post URL')
  .action(async (url) => {
    try {
      await login();
      await scrape(url);
      await autoApprove();
      await send();
    } finally {
      await closeBrowser();
    }
  });

program
  .command('scrape')
  .description('Scrape comments + like + check already replied')
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
  .description('Generate replies and DMs using Claude (optional)')
  .action(async () => {
    await generate();
  });

program
  .command('approve')
  .description('Auto-approve all pending replies and DMs')
  .action(async () => {
    await autoApprove();
  });

program
  .command('status')
  .description('Show status of all contacts')
  .action(async () => {
    await review();
  });

program
  .command('send')
  .description('1촌체크 → DM(1촌만) → 대댓글(DM결과에 따라)')
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
