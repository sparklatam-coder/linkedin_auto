import { getPage, delay } from '../browser/puppeteer.js';
import { readContacts, writeContacts } from '../data.js';
import { createHash } from 'crypto';
import type { Contact } from '../types.js';
import type { Page } from 'puppeteer';

function makeId(postUrl: string, authorName: string, content: string): string {
  return createHash('md5').update(`${postUrl}|${authorName}|${content}`).digest('hex').slice(0, 12);
}

export async function scrape(postUrl: string): Promise<void> {
  const page = await getPage();
  const existing = readContacts();
  const existingIds = new Set(existing.map(c => c.id));

  // 내 프로필 URL 가져오기 (대댓글 감지용)
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(2000, 3000);
  const myProfileUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
    return link ? link.href.split('?')[0].replace(/\/+$/, '') : '';
  });
  const myProfileId = myProfileUrl.split('/in/')[1] || '';
  console.log(`My profile: ${myProfileId}`);

  console.log(`Opening post: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(3000, 5000);

  // 포스트 본문
  const postContent = await page.evaluate(() => {
    const selectors = ['.feed-shared-update-v2__description', '.update-components-text', '.break-words'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return '';
  });
  console.log(`Post: "${postContent.slice(0, 80)}..."`);

  // 댓글 영역 열기
  const showCommentsBtn = await page.$('button[aria-label*="comment"], button.social-details-social-counts__comments-count');
  if (showCommentsBtn) {
    await showCommentsBtn.click();
    await delay(2000, 3000);
  }

  // 모든 댓글 로드
  for (let i = 0; i < 30; i++) {
    const loadMore = await page.$('button.comments-comments-list__load-more-comments-button, button[aria-label*="Load more comments"], button[aria-label*="이전 댓글"]');
    if (!loadMore) break;
    await loadMore.click();
    await delay(1500, 2500);
  }

  // 댓글 수집 + 이미 내가 대댓글 달았는지 체크
  const rawComments = await page.evaluate((myId: string) => {
    const commentEls = document.querySelectorAll('article.comments-comment-entity:not(.comments-comment-entity--reply)');
    return Array.from(commentEls).map((el) => {
      let authorName = '';
      const nameSelectors = ['a span.hoverable-link-text', '.comments-post-meta__name-text span', 'a[href*="/in/"] span', 'span[dir="ltr"]'];
      for (const sel of nameSelectors) {
        const found = el.querySelector(sel);
        if (found?.textContent?.trim()) { authorName = found.textContent.trim(); break; }
      }
      const profileEl = el.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
      const contentEl = el.querySelector('.comments-comment-item__main-content');
      const timeEl = el.querySelector('time');

      // 이 댓글 아래에 내 대댓글이 있는지 확인
      let hasMyReply = false;
      let sibling = el.nextElementSibling;
      while (sibling) {
        const isReply = sibling.classList.contains('comments-comment-entity--reply');
        const isNextTopLevel = sibling.tagName === 'ARTICLE' && !isReply;

        if (isNextTopLevel) break;

        if (isReply) {
          // 방법 1: reply 안의 프로필 링크가 내 프로필 URL과 일치
          const replyLinks = sibling.querySelectorAll('a[href*="/in/"]');
          for (const link of replyLinks) {
            const href = (link as HTMLAnchorElement).href || '';
            if (href.includes(myId)) { hasMyReply = true; break; }
          }
          if (hasMyReply) break;

          // 방법 2: "your" 포함 (영문 LinkedIn)
          const likeBtn = sibling.querySelector('button[aria-label*="React Like"]');
          const likeLabel = likeBtn?.getAttribute('aria-label') || '';
          if (likeLabel.toLowerCase().includes('your')) { hasMyReply = true; break; }

          // 방법 3: "You" 텍스트
          const metaText = sibling.querySelector('[class*="post-meta"]')?.textContent || '';
          if (metaText.includes('You') || metaText.includes('• You')) { hasMyReply = true; break; }
        }

        sibling = sibling.nextElementSibling;
      }

      // 좋아요 버튼의 aria-label 확인 (이미 좋아요 눌렀는지)
      const likeBtn = el.querySelector('button[aria-label*="React Like"], button[aria-label*="React"]') as HTMLButtonElement;
      const isLiked = likeBtn?.getAttribute('aria-pressed') === 'true';

      return {
        authorName: authorName || 'Unknown',
        authorProfileUrl: profileEl?.href?.split('?')[0] || '',
        content: contentEl?.textContent?.trim() || '',
        timestamp: timeEl?.getAttribute('datetime') || new Date().toISOString(),
        hasMyReply,
        isLiked,
      };
    });
  }, myProfileId);

  // 좋아요 누르기 (아직 안 누른 댓글만)
  console.log('\nLiking comments...');
  let likeCount = 0;
  for (let i = 0; i < rawComments.length; i++) {
    if (!rawComments[i].isLiked) {
      const liked = await page.evaluate((idx: number) => {
        const commentEls = document.querySelectorAll('article.comments-comment-entity:not(.comments-comment-entity--reply)');
        const el = commentEls[idx];
        if (!el) return false;
        const likeBtn = el.querySelector('button[aria-label*="React Like"]') as HTMLButtonElement;
        if (likeBtn && likeBtn.getAttribute('aria-pressed') !== 'true') {
          likeBtn.click();
          return true;
        }
        return false;
      }, i);
      if (liked) {
        likeCount++;
        await delay(500, 1000);
      }
    }
  }
  console.log(`  Liked ${likeCount} comments`);

  // Contact 객체 생성 (기존 데이터와 병합)
  let newCount = 0;
  for (const raw of rawComments) {
    const id = makeId(postUrl, raw.authorName, raw.content);
    if (existingIds.has(id)) continue; // 이미 있으면 스킵 (대댓글/DM 상태 유지)

    const contact: Contact = {
      id,
      postUrl,
      postContent: postContent.slice(0, 500),
      authorName: raw.authorName,
      authorProfileUrl: raw.authorProfileUrl,
      commentContent: raw.content,
      commentTimestamp: raw.timestamp,
      isConnected: null,
      liked: true,
      reply: {
        status: raw.hasMyReply ? 'skipped' : 'pending',
        content: '',
      },
      dm: {
        status: 'pending',
        content: '',
      },
    };
    existing.push(contact);
    newCount++;
  }

  writeContacts(existing);

  const total = existing.filter(c => c.postUrl === postUrl).length;
  const skipped = existing.filter(c => c.postUrl === postUrl && c.reply.status === 'skipped').length;
  const pending = existing.filter(c => c.postUrl === postUrl && c.reply.status === 'pending').length;

  console.log(`\nTotal: ${total} comments (${newCount} new, ${skipped} already replied, ${pending} pending)`);
  existing.filter(c => c.postUrl === postUrl && c.reply.status === 'pending').forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.authorName}: "${c.commentContent.slice(0, 50)}"`)
  );
}
