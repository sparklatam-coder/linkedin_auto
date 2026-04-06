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
  .command('scrape')
  .description('Login and scrape comments from your latest posts')
  .option('-p, --posts <number>', 'Number of recent posts to scrape', '5')
  .action(async (opts) => {
    try {
      await login();
      await scrape(parseInt(opts.posts, 10));
    } finally {
      await closeBrowser();
    }
  });

program
  .command('generate')
  .description('Generate replies and DMs for scraped comments using Claude')
  .action(async () => {
    await generate();
  });

program
  .command('review')
  .description('Review and approve/modify/reject generated replies and DMs')
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

program
  .command('run')
  .description('Run the full pipeline: scrape → generate → review → send')
  .option('-p, --posts <number>', 'Number of recent posts to process', '5')
  .action(async (opts) => {
    try {
      await login();
      await scrape(parseInt(opts.posts, 10));
      await generate();
      await review();
      await send();
    } finally {
      await closeBrowser();
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
