import { getPage, delay } from '../browser/puppeteer.js';
import { readReplies, readMessages, readComments, writeReplies, writeMessages } from '../data.js';
import chalk from 'chalk';
import type { Page } from 'puppeteer';

// FIX #2: 대댓글 전송 — 현재 LinkedIn DOM에 맞게 셀렉터 수정
async function sendReply(page: Page, postUrl: string, commentContent: string, replyText: string): Promise<boolean> {
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000, 5000);

    // Expand comments if needed
    const showCommentsBtn = await page.$('button[aria-label*="comment"], button.social-details-social-counts__comments-count');
    if (showCommentsBtn) {
      await showCommentsBtn.click();
      await delay(2000, 3000);
    }

    // Load more comments
    for (let i = 0; i < 5; i++) {
      const loadMore = await page.$('button.comments-comments-list__load-more-comments-button, button[aria-label*="이전 댓글"]');
      if (!loadMore) break;
      await loadMore.click();
      await delay(1500, 2500);
    }

    // DEBUG: 먼저 댓글 내부의 버튼 구조를 파악
    const debugInfo = await page.evaluate((targetContent: string) => {
      const commentEls = document.querySelectorAll('article.comments-comment-entity:not(.comments-comment-entity--reply)');
      for (const el of commentEls) {
        const content = el.querySelector('.comments-comment-item__main-content')?.textContent?.trim();
        if (content && content.includes(targetContent.slice(0, 50))) {
          const allBtns = el.querySelectorAll('button');
          const btnInfo = Array.from(allBtns).map(b => ({
            text: b.textContent?.trim().slice(0, 30),
            ariaLabel: b.getAttribute('aria-label')?.slice(0, 50),
            classes: Array.from(b.classList).join(' '),
          }));
          return { found: true, buttons: btnInfo };
        }
      }
      return { found: false, buttons: [] };
    }, commentContent);
    console.log(`  DEBUG buttons in comment: ${JSON.stringify(debugInfo)}`);

    // Find the target comment and click the reply button
    const found = await page.evaluate((targetContent: string) => {
      const commentEls = document.querySelectorAll('article.comments-comment-entity:not(.comments-comment-entity--reply)');
      for (const el of commentEls) {
        const content = el.querySelector('.comments-comment-item__main-content')?.textContent?.trim();
        if (content && content.includes(targetContent.slice(0, 50))) {
          // 방법 1: aria-label로 찾기
          const replyBtn = el.querySelector('button[aria-label*="Reply"], button[aria-label*="답글"]') as HTMLButtonElement;
          if (replyBtn) { replyBtn.click(); return 'aria-label'; }

          // 방법 2: 클래스로 찾기
          const replyBtn2 = el.querySelector('button.comments-comment-social-bar__reply-action-button') as HTMLButtonElement;
          if (replyBtn2) { replyBtn2.click(); return 'class'; }

          // 방법 3: 텍스트로 찾기
          const allBtns = el.querySelectorAll('button');
          for (const btn of allBtns) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text === 'reply' || text === '답글' || text.includes('reply') || text.includes('답글')) {
              btn.click();
              return 'text:' + text;
            }
          }
          return 'no-reply-btn';
        }
      }
      return 'no-comment';
    }, commentContent);
    console.log(`  DEBUG reply button result: ${found}`);

    if (found === 'no-comment' || found === 'no-reply-btn') {
      console.log(chalk.yellow(`  Could not find comment or reply button (${found})`));
      return false;
    }

    await delay(2000, 3000);

    // DEBUG: reply input 구조 확인
    const inputDebug = await page.evaluate(() => {
      const editors = document.querySelectorAll('.ql-editor');
      return Array.from(editors).map((el, i) => {
        const parent = el.closest('[class*="comment"]');
        return {
          index: i,
          parentClasses: parent ? Array.from(parent.classList).join(' ').slice(0, 80) : 'none',
          placeholder: el.getAttribute('data-placeholder')?.slice(0, 30),
          contenteditable: el.getAttribute('contenteditable'),
        };
      });
    });
    console.log(`  DEBUG editors found: ${JSON.stringify(inputDebug)}`);

    // 대댓글 입력란 찾기 — 가장 마지막에 나타난 에디터가 답글용
    // 포스트 댓글 입력란(첫 번째)이 아닌, 답글 버튼 클릭 후 새로 나타난 에디터를 찾아야 함
    const allEditors = await page.$$('.ql-editor[contenteditable="true"]');
    if (allEditors.length === 0) {
      console.log(chalk.yellow('  Could not find any editor'));
      return false;
    }

    // 마지막 에디터가 대댓글용 (답글 버튼 클릭 후 새로 생긴 것)
    const replyInput = allEditors[allEditors.length - 1];
    await replyInput.click();
    await delay(300, 500);
    await page.keyboard.type(replyText, { delay: 30 });

    await delay(500, 1000);

    // Submit — 마지막 submit 버튼이 대댓글 전송용
    const submitBtns = await page.$$('button.comments-comment-box__submit-button--cr, button.comments-comment-box__submit-button');
    if (submitBtns.length > 0) {
      const lastSubmit = submitBtns[submitBtns.length - 1];
      await lastSubmit.click();
      await delay(2000, 3000);
      return true;
    }

    // Fallback: aria-label로 찾기
    const fallbackBtns = await page.$$('button[aria-label*="Submit"], button[aria-label*="게시"]');
    if (fallbackBtns.length > 0) {
      const lastFallback = fallbackBtns[fallbackBtns.length - 1];
      await lastFallback.click();
      await delay(2000, 3000);
      return true;
    }

    console.log(chalk.yellow('  Could not find submit button'));
    return false;
  } catch (error) {
    console.error(chalk.red(`  Error: ${(error as Error).message}`));
    return false;
  }
}

// FIX #4: DM 버튼 셀렉터 대폭 확장
async function sendDM(page: Page, recipientProfileUrl: string, recipientName: string, messageText: string): Promise<boolean> {
  try {
    // 프로필 페이지로 이동
    await page.goto(recipientProfileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(3000, 5000);

    // DEBUG: 프로필 페이지의 버튼들 확인
    const profileBtnDebug = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a');
      const relevant = Array.from(btns).filter(b => {
        const text = (b.textContent?.trim() || '').toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('message') || text.includes('메시지') || text.includes('connect') || text.includes('팔로우') || text.includes('follow') || aria.includes('message') || aria.includes('메시지');
      }).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim().slice(0, 30),
        ariaLabel: b.getAttribute('aria-label')?.slice(0, 50),
        classes: Array.from(b.classList).join(' ').slice(0, 60),
      }));
      return relevant;
    });
    console.log(`  DEBUG profile buttons: ${JSON.stringify(profileBtnDebug)}`);

    // "Message" / "메시지" 버튼 찾기 — 다양한 셀렉터 시도
    let messageBtnFound = false;

    // 방법 1: 프로필 페이지의 Message 링크(<a> 태그)의 href를 가져와서 직접 이동
    const messageHref = await page.evaluate(() => {
      // 프로필 상단의 Message 링크 찾기 (첫 번째 것이 해당 프로필의 메시지 링크)
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const text = link.textContent?.trim();
        if (text === 'Message' || text === '메시지') {
          return link.href;
        }
      }
      return null;
    });

    if (messageHref) {
      console.log(`  Found message link: ${messageHref}`);
      await page.goto(messageHref, { waitUntil: 'domcontentloaded', timeout: 60000 });
      messageBtnFound = true;
    }

    // 방법 2: button으로 시도
    if (!messageBtnFound) {
      const directSelectors = [
        'button.message-anywhere-button',
        'button[aria-label*="Message"]',
        'button[aria-label*="메시지"]',
      ];
      for (const sel of directSelectors) {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          messageBtnFound = true;
          break;
        }
      }
    }

    // 방법 3: 메시징 compose 페이지로 직접 이동
    if (!messageBtnFound) {
      console.log(chalk.yellow(`  Profile message button not found. Using messaging compose...`));
      await page.goto('https://www.linkedin.com/messaging/thread/new/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000, 5000);

      const searchInput = await page.$('input[role="combobox"], input[name="searchTerm"], input.msg-connections-typeahead__search-field');
      if (!searchInput) {
        console.log(chalk.yellow('  Could not find recipient search'));
        return false;
      }

      await searchInput.click();
      await searchInput.type(recipientName, { delay: 50 });
      await delay(2000, 3000);

      const suggestion = await page.$('.msg-connections-typeahead__suggestion, [role="option"], li.basic-typeahead__selectable');
      if (suggestion) {
        await suggestion.click();
        await delay(1000, 2000);
      } else {
        console.log(chalk.yellow('  Could not find recipient in search results'));
        return false;
      }
    }

    // 메시지 창이 열릴 때까지 충분히 대기
    await delay(3000, 5000);

    // DEBUG: 메시지 입력란 구조 확인
    const dmDebug = await page.evaluate(() => {
      const url = window.location.href;
      const contentEditables = document.querySelectorAll('[contenteditable="true"]');
      const textboxes = document.querySelectorAll('[role="textbox"]');
      const msgForms = document.querySelectorAll('[class*="msg-form"]');
      return {
        url,
        contentEditables: Array.from(contentEditables).map(el => ({
          tag: el.tagName,
          classes: Array.from(el.classList).join(' ').slice(0, 60),
          placeholder: el.getAttribute('data-placeholder') || el.getAttribute('aria-placeholder') || el.getAttribute('aria-label') || '',
        })),
        textboxCount: textboxes.length,
        msgFormCount: msgForms.length,
      };
    });
    console.log(`  DEBUG DM page: ${JSON.stringify(dmDebug)}`);

    // 메시지 입력 필드 찾기
    const msgInputSelectors = [
      '.msg-form__contenteditable',
      '.msg-form__msg-content-container .ql-editor',
      'div[role="textbox"][contenteditable="true"]',
      '.msg-form__message-texteditor .ql-editor',
      'div.msg-form__contenteditable[contenteditable="true"]',
      'p[data-placeholder]',
    ];

    let msgInput = null;
    for (const sel of msgInputSelectors) {
      msgInput = await page.$(sel);
      if (msgInput) { console.log(`  Found input via: ${sel}`); break; }
    }

    if (!msgInput) {
      // Retry after more wait
      await delay(3000, 5000);
      for (const sel of msgInputSelectors) {
        msgInput = await page.$(sel);
        if (msgInput) { console.log(`  Found input via (retry): ${sel}`); break; }
      }
    }

    if (!msgInput) {
      console.log(chalk.yellow('  Could not find message input'));
      return false;
    }

    await msgInput.click();
    await delay(500, 1000);
    await page.keyboard.type(messageText, { delay: 30 });
    await delay(500, 1000);

    // DEBUG: 전송 버튼 구조 확인
    const sendBtnDebug = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      const msgBtns = Array.from(btns).filter(b => {
        const text = (b.textContent?.trim() || '').toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const cls = Array.from(b.classList).join(' ');
        return text.includes('send') || text.includes('보내기') || aria.includes('send') || aria.includes('보내기') || cls.includes('msg-form') || cls.includes('send');
      }).map(b => ({
        text: b.textContent?.trim().slice(0, 20),
        ariaLabel: b.getAttribute('aria-label')?.slice(0, 30),
        classes: Array.from(b.classList).join(' ').slice(0, 60),
        disabled: b.disabled,
      }));
      return msgBtns;
    });
    console.log(`  DEBUG send buttons: ${JSON.stringify(sendBtnDebug)}`);

    // 전송 버튼 — 다양한 셀렉터 시도
    const sendSelectors = [
      'button.msg-form__send-button',
      'button.msg-form__send-btn',
      'button[aria-label*="Send"]',
      'button[aria-label*="보내기"]',
      'button[type="submit"]',
    ];

    for (const sel of sendSelectors) {
      const sendBtn = await page.$(sel);
      if (sendBtn) {
        console.log(`  Found send button via: ${sel}`);
        await sendBtn.click();
        await delay(2000, 3000);
        return true;
      }
    }

    // Fallback: Enter 키로 전송 (LinkedIn 메시지는 Enter로 전송)
    console.log('  Trying Enter key to send...');
    await page.keyboard.press('Enter');
    await delay(2000, 3000);
    return true;
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
