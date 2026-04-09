import { getPage, delay, humanMove, humanScroll, humanType } from '../browser/puppeteer.js';
import { readContacts, writeContacts } from '../data.js';
import chalk from 'chalk';
import type { Contact } from '../types.js';
import type { Page } from 'puppeteer';

const BATCH_SIZE = 10; // 한 번에 최대 10명
const BATCH_PAUSE_MIN = 3 * 60 * 1000; // 배치 간 3분
const BATCH_PAUSE_MAX = 5 * 60 * 1000; // 배치 간 5분

// --- 1촌 여부 체크 ---
async function checkConnection(page: Page, contact: Contact): Promise<boolean> {
  await page.goto(contact.authorProfileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(3000, 6000);
  await humanMove(page);
  await humanScroll(page);

  const hasMessage = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const link of links) {
      if (link.textContent?.trim() === 'Message' || link.textContent?.trim() === '메시지') return true;
    }
    return false;
  });

  return hasMessage;
}

// --- 댓글을 찾을 때까지 더 보기 반복 클릭 ---
async function findAndClickReply(page: Page, authorName: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = await page.evaluate((targetAuthor: string) => {
      const commentEls = document.querySelectorAll('article.comments-comment-entity:not(.comments-comment-entity--reply)');
      for (const el of commentEls) {
        let name = '';
        const nameSelectors = ['a span.hoverable-link-text', '.comments-post-meta__name-text span', 'a[href*="/in/"] span', 'span[dir="ltr"]'];
        for (const sel of nameSelectors) {
          const found = el.querySelector(sel);
          if (found?.textContent?.trim()) { name = found.textContent.trim(); break; }
        }
        if (!(name.includes(targetAuthor) || targetAuthor.includes(name))) continue;

        const replyBtn = el.querySelector('button[aria-label*="Reply"], button[aria-label*="답글"]') as HTMLButtonElement;
        if (replyBtn) { replyBtn.click(); return 'matched:' + name; }
        return 'no-reply-btn:' + name;
      }
      return 'not-found';
    }, authorName);

    if (found !== 'not-found') return found;

    const loadMore = await page.$('button.comments-comments-list__load-more-comments-button, button[aria-label*="Load more comments"], button[aria-label*="이전 댓글"]');
    if (!loadMore) return 'no-comment';
    await loadMore.click();
    await delay(2000, 4000);
  }
  return 'no-comment';
}

// --- 대댓글 전송 ---
async function sendReply(page: Page, postUrl: string, authorName: string, replyText: string): Promise<boolean> {
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(4000, 8000);
    await humanMove(page);
    await humanScroll(page);

    const showCommentsBtn = await page.$('button[aria-label*="comment"], button.social-details-social-counts__comments-count');
    if (showCommentsBtn) {
      await humanMove(page);
      await showCommentsBtn.click();
      await delay(3000, 5000);
    }

    const found = await findAndClickReply(page, authorName);
    console.log(`  Reply target: ${found}`);

    if (found === 'no-comment' || found.startsWith('no-reply-btn')) return false;

    await delay(2000, 4000);

    const allEditors = await page.$$('.ql-editor[contenteditable="true"]');
    if (allEditors.length === 0) return false;

    const replyInput = allEditors[allEditors.length - 1];
    await replyInput.click();
    await delay(500, 1000);
    await humanType(page, replyText);
    await delay(1000, 2000);

    const submitBtns = await page.$$('button.comments-comment-box__submit-button--cr, button.comments-comment-box__submit-button');
    if (submitBtns.length > 0) {
      await humanMove(page);
      await submitBtns[submitBtns.length - 1].click();
      await delay(3000, 5000);
      return true;
    }

    const fallbackBtns = await page.$$('button[aria-label*="Submit"], button[aria-label*="게시"]');
    if (fallbackBtns.length > 0) {
      await fallbackBtns[fallbackBtns.length - 1].click();
      await delay(3000, 5000);
      return true;
    }
    return false;
  } catch (error) {
    console.error(chalk.red(`  Error: ${(error as Error).message}`));
    return false;
  }
}

// --- DM 전송 ---
async function sendDM(page: Page, profileUrl: string, messageText: string): Promise<boolean> {
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(4000, 8000);
    await humanMove(page);
    await humanScroll(page);

    const messageHref = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.textContent?.trim() === 'Message' || link.textContent?.trim() === '메시지') return link.href;
      }
      return null;
    });

    if (!messageHref) return false;

    await humanMove(page);
    await page.goto(messageHref, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(4000, 8000);

    const msgInputSelectors = ['.msg-form__contenteditable', 'div[role="textbox"][contenteditable="true"]', '.msg-form__message-texteditor .ql-editor'];
    let msgInput = null;
    for (const sel of msgInputSelectors) {
      msgInput = await page.$(sel);
      if (msgInput) break;
    }
    if (!msgInput) {
      await delay(3000, 5000);
      for (const sel of msgInputSelectors) {
        msgInput = await page.$(sel);
        if (msgInput) break;
      }
    }
    if (!msgInput) return false;

    await msgInput.click();
    await delay(500, 1500);

    // 줄바꿈은 Shift+Enter
    const lines = messageText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      await humanType(page, lines[i]);
      if (i < lines.length - 1) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
        await delay(300, 600);
      }
    }
    await delay(1000, 2000);

    const sendSelectors = ['button.msg-form__send-button', 'button[aria-label*="Send"]', 'button[aria-label*="보내기"]'];
    for (const sel of sendSelectors) {
      const sendBtn = await page.$(sel);
      if (sendBtn) {
        await humanMove(page);
        await sendBtn.click();
        await delay(3000, 5000);
        return true;
      }
    }

    await page.keyboard.press('Enter');
    await delay(3000, 5000);
    return true;
  } catch (error) {
    console.error(chalk.red(`  Error: ${(error as Error).message}`));
    return false;
  }
}

// --- 이름에서 호칭 추출 ---
function getDisplayName(name: string): string {
  const kor = name.match(/[가-힣]+/g);
  if (kor) return kor.join('');
  return name.split(/[\s(,]/)[0];
}

// --- 메인 send 함수 ---
export async function send(): Promise<void> {
  const page = await getPage();
  const contacts = readContacts();

  const toProcess = contacts.filter(c => c.dm.status === 'approved');
  if (toProcess.length === 0) {
    console.log('Nothing to send.');
    return;
  }

  console.log(chalk.bold(`\nProcessing ${toProcess.length} people (batch size: ${BATCH_SIZE})...\n`));

  for (let i = 0; i < toProcess.length; i++) {
    // 배치 제한: N명마다 긴 휴식
    if (i > 0 && i % BATCH_SIZE === 0) {
      const pauseMin = Math.floor(BATCH_PAUSE_MIN / 60000);
      const pauseMax = Math.floor(BATCH_PAUSE_MAX / 60000);
      console.log(chalk.yellow(`\n--- Batch pause: ${pauseMin}-${pauseMax}min rest (${i}/${toProcess.length} done) ---\n`));
      await delay(BATCH_PAUSE_MIN, BATCH_PAUSE_MAX);
    }

    const c = toProcess[i];
    const displayName = getDisplayName(c.authorName);
    console.log(chalk.bold(`[${i + 1}/${toProcess.length}] ${c.authorName}`));

    // Step 1: 1촌 체크
    if (c.isConnected === null) {
      c.isConnected = await checkConnection(page, c);
      console.log(`  1촌: ${c.isConnected ? chalk.green('Yes') : chalk.yellow('No')}`);
      writeContacts(contacts);
      await delay(10000, 20000); // 프로필 방문 후 긴 대기
    }

    // Step 2: DM
    if (c.isConnected) {
      console.log(`  DMing...`);
      const dmSuccess = await sendDM(page, c.authorProfileUrl, c.dm.content);
      if (dmSuccess) {
        c.dm.status = 'sent';
        console.log(chalk.green(`  DM Sent!`));
      } else {
        c.dm.status = 'failed';
        console.log(chalk.red(`  DM Failed`));
      }
    } else {
      c.dm.status = 'not-connected';
      console.log(chalk.yellow(`  DM skipped (not connected)`));
    }
    writeContacts(contacts);

    // Step 3: 대댓글
    let replyText: string;
    if (c.dm.status === 'sent') {
      replyText = `${displayName}님, DM 곧 보내드리겠습니다 :)`;
    } else {
      replyText = `${displayName}님, 1촌이어야 DM을 보내드릴 수 있습니다. 1촌 신청 부탁드립니다 :)`;
    }

    console.log(`  Replying: "${replyText}"`);
    const replySuccess = await sendReply(page, c.postUrl, c.authorName, replyText);
    if (replySuccess) {
      c.reply.status = 'sent';
      c.reply.content = replyText;
      console.log(chalk.green(`  Reply Sent!`));
    } else {
      c.reply.content = replyText;
      console.log(chalk.red(`  Reply Failed`));
    }
    writeContacts(contacts);

    // 사람 간 긴 딜레이 (30초~2분)
    await delay(30000, 120000);
  }

  // === 최종 요약 ===
  const replySent = contacts.filter(c => c.reply.status === 'sent').length;
  const replySkipped = contacts.filter(c => c.reply.status === 'skipped').length;
  const dmSent = contacts.filter(c => c.dm.status === 'sent').length;
  const dmNotConn = contacts.filter(c => c.dm.status === 'not-connected').length;
  const dmFailed = contacts.filter(c => c.dm.status === 'failed').length;
  console.log(chalk.bold(`\nDone!`));
  console.log(`  Replies: ${replySent} sent, ${replySkipped} skipped`);
  console.log(`  DMs: ${dmSent} sent, ${dmNotConn} not connected, ${dmFailed} failed`);
}
