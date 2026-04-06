import { getPage, delay } from '../browser/puppeteer.js';
import { readReplies, readMessages, readComments, writeReplies, writeMessages } from '../data.js';
import chalk from 'chalk';
import type { Page } from 'puppeteer';

async function sendReply(page: Page, postUrl: string, commentContent: string, replyText: string): Promise<boolean> {
  try {
    await page.goto(postUrl, { waitUntil: 'networkidle2' });
    await delay(2000, 3000);

    const commented = await page.evaluate((targetContent: string) => {
      const commentEls = document.querySelectorAll('.comments-comment-item');
      for (const el of commentEls) {
        const content = el.querySelector('.comments-comment-item__main-content')?.textContent?.trim();
        if (content && content.includes(targetContent.slice(0, 50))) {
          const replyBtn = el.querySelector('button.comments-comment-social-bar__reply-action-button') as HTMLButtonElement;
          if (replyBtn) {
            replyBtn.click();
            return true;
          }
        }
      }
      return false;
    }, commentContent);

    if (!commented) {
      console.log(chalk.yellow('  Could not find comment or reply button'));
      return false;
    }

    await delay(1000, 2000);

    const replyInput = await page.$('.comments-comment-box__form .ql-editor, .comments-reply-form .ql-editor');
    if (!replyInput) {
      console.log(chalk.yellow('  Could not find reply input'));
      return false;
    }

    await replyInput.click();
    await page.keyboard.type(replyText, { delay: 30 });
    await delay(500, 1000);

    const submitBtn = await page.$('.comments-comment-box__submit-button--cr');
    if (submitBtn) {
      await submitBtn.click();
      await delay(2000, 3000);
      return true;
    }

    return false;
  } catch (error) {
    console.error(chalk.red(`  Error: ${(error as Error).message}`));
    return false;
  }
}

async function sendDM(page: Page, recipientProfileUrl: string, recipientName: string, messageText: string): Promise<boolean> {
  try {
    await page.goto(recipientProfileUrl, { waitUntil: 'networkidle2' });
    await delay(2000, 3000);

    const messageBtn = await page.$('button.message-anywhere-button, a[href*="messaging"]');
    if (!messageBtn) {
      console.log(chalk.yellow(`  No direct message button for ${recipientName}. Trying messaging page...`));

      await page.goto('https://www.linkedin.com/messaging/compose/', { waitUntil: 'networkidle2' });
      await delay(2000, 3000);

      const searchInput = await page.$('input[role="combobox"], input.msg-connections-typeahead__search-field');
      if (!searchInput) {
        console.log(chalk.yellow('  Could not find recipient search'));
        return false;
      }

      await searchInput.type(recipientName, { delay: 50 });
      await delay(2000, 3000);

      const suggestion = await page.$('.msg-connections-typeahead__suggestion');
      if (suggestion) {
        await suggestion.click();
        await delay(1000, 2000);
      }
    } else {
      await messageBtn.click();
      await delay(2000, 3000);
    }

    const msgInput = await page.waitForSelector('.msg-form__contenteditable, .msg-form__msg-content-container .ql-editor', { timeout: 10000 });
    if (!msgInput) {
      console.log(chalk.yellow('  Could not find message input'));
      return false;
    }

    await msgInput.click();
    await page.keyboard.type(messageText, { delay: 30 });
    await delay(500, 1000);

    const sendBtn = await page.$('button.msg-form__send-button');
    if (sendBtn) {
      await sendBtn.click();
      await delay(2000, 3000);
      return true;
    }

    return false;
  } catch (error) {
    console.error(chalk.red(`  Error: ${(error as Error).message}`));
    return false;
  }
}

export async function send(): Promise<void> {
  const page = await getPage();
  const replies = readReplies();
  const messages = readMessages();
  const comments = readComments();

  const commentMap = new Map(comments.map((c) => [c.id, c]));

  const approvedReplies = replies.filter((r) => r.status === 'approved' || r.status === 'modified');
  if (approvedReplies.length > 0) {
    console.log(chalk.bold(`\nSending ${approvedReplies.length} replies...`));

    for (let i = 0; i < approvedReplies.length; i++) {
      const reply = approvedReplies[i];
      const comment = commentMap.get(reply.commentId);
      if (!comment) continue;

      console.log(`[${i + 1}/${approvedReplies.length}] Replying to ${comment.authorName}...`);
      const success = await sendReply(page, comment.postUrl, comment.content, reply.finalContent);

      if (success) {
        reply.status = 'sent';
        console.log(chalk.green('  Sent!'));
      } else {
        reply.status = 'failed';
        console.log(chalk.red('  Failed'));
      }

      writeReplies(replies);
      await delay(3000, 7000);
    }
  }

  const approvedDMs = messages.filter((m) => m.status === 'approved' || m.status === 'modified');
  if (approvedDMs.length > 0) {
    console.log(chalk.bold(`\nSending ${approvedDMs.length} DMs...`));

    for (let i = 0; i < approvedDMs.length; i++) {
      const msg = approvedDMs[i];
      console.log(`[${i + 1}/${approvedDMs.length}] DMing ${msg.recipientName}...`);

      const success = await sendDM(page, msg.recipientProfileUrl, msg.recipientName, msg.finalContent);

      if (success) {
        msg.status = 'sent';
        console.log(chalk.green('  Sent!'));
      } else {
        msg.status = 'failed';
        console.log(chalk.red('  Failed'));
      }

      writeMessages(messages);
      await delay(5000, 10000);
    }
  }

  const sentReplies = replies.filter((r) => r.status === 'sent').length;
  const sentDMs = messages.filter((m) => m.status === 'sent').length;
  console.log(chalk.bold(`\nDone! Sent ${sentReplies} replies and ${sentDMs} DMs.`));
}
