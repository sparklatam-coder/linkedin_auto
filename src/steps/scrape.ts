import { getPage, delay } from '../browser/puppeteer.js';
import { writeComments } from '../data.js';
import { createHash } from 'crypto';
import type { Comment } from '../types.js';

function makeCommentId(postUrl: string, authorName: string, content: string): string {
  return createHash('md5').update(`${postUrl}|${authorName}|${content}`).digest('hex').slice(0, 12);
}

export async function scrape(postUrl: string): Promise<void> {
  const page = await getPage();

  console.log(`Opening post: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(3000, 5000);

  // 포스트 본문 수집
  const postContent = await page.evaluate(() => {
    const selectors = ['.feed-shared-update-v2__description', '.update-components-text', '.break-words', '[data-ad-preview="message"]'];
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

  // 댓글 더 보기
  for (let i = 0; i < 10; i++) {
    const loadMore = await page.$('button.comments-comments-list__load-more-comments-button, button[aria-label*="Load more comments"], button[aria-label*="이전 댓글"]');
    if (!loadMore) break;
    await loadMore.click();
    await delay(1500, 2500);
  }

  // 댓글 수집
  const rawComments = await page.evaluate(() => {
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
      return {
        authorName: authorName || 'Unknown',
        authorProfileUrl: profileEl?.href?.split('?')[0] || '',
        content: contentEl?.textContent?.trim() || '',
        timestamp: timeEl?.getAttribute('datetime') || new Date().toISOString(),
      };
    });
  });

  const comments: Comment[] = rawComments.map((raw) => ({
    id: makeCommentId(postUrl, raw.authorName, raw.content),
    postUrl,
    postContent: postContent.slice(0, 500),
    authorName: raw.authorName,
    authorProfileUrl: raw.authorProfileUrl,
    content: raw.content,
    timestamp: raw.timestamp,
    alreadyReplied: false,
  }));

  writeComments(comments);
  console.log(`\n${comments.length} comments saved.`);
  comments.forEach((c, i) => console.log(`  ${i + 1}. ${c.authorName}: "${c.content.slice(0, 50)}"`));
}
