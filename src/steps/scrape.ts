import { getPage, delay } from '../browser/puppeteer.js';
import { writeComments } from '../data.js';
import { createHash } from 'crypto';
import type { Comment } from '../types.js';
import type { Page } from 'puppeteer';

function makeCommentId(postUrl: string, authorName: string, content: string): string {
  return createHash('md5').update(`${postUrl}|${authorName}|${content}`).digest('hex').slice(0, 12);
}

async function getMyProfileUrl(page: Page): Promise<string> {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
  await delay(2000, 3000);

  const profileLink = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
    return link ? link.href : null;
  });

  if (!profileLink) throw new Error('Could not find profile URL');
  return profileLink.split('?')[0];
}

async function getRecentPostUrls(page: Page, profileUrl: string, count: number): Promise<string[]> {
  const activityUrl = `${profileUrl}/recent-activity/all/`;
  await page.goto(activityUrl, { waitUntil: 'networkidle2' });
  await delay(2000, 4000);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(1500, 2500);
  }

  const postUrls = await page.evaluate((maxPosts: number) => {
    const links = document.querySelectorAll('a[href*="/feed/update/"]');
    const urls = new Set<string>();
    links.forEach((link) => {
      const href = (link as HTMLAnchorElement).href.split('?')[0];
      if (href.includes('/feed/update/')) urls.add(href);
    });
    return Array.from(urls).slice(0, maxPosts);
  }, count);

  return postUrls;
}

async function scrapePostComments(page: Page, postUrl: string, myName: string): Promise<Comment[]> {
  await page.goto(postUrl, { waitUntil: 'networkidle2' });
  await delay(2000, 4000);

  const postContent = await page.evaluate(() => {
    const postEl = document.querySelector('.feed-shared-update-v2__description, .update-components-text');
    return postEl?.textContent?.trim() || '';
  });

  for (let i = 0; i < 5; i++) {
    const loadMore = await page.$('button.comments-comments-list__load-more-comments-button');
    if (!loadMore) break;
    await loadMore.click();
    await delay(1500, 2500);
  }

  const rawComments = await page.evaluate(() => {
    const commentEls = document.querySelectorAll('.comments-comment-item');
    return Array.from(commentEls).map((el) => {
      const authorEl = el.querySelector('.comments-post-meta__name-text a, .comments-post-meta__name-text span');
      const profileEl = el.querySelector('a[href*="/in/"]') as HTMLAnchorElement;
      const contentEl = el.querySelector('.comments-comment-item__main-content');
      const timeEl = el.querySelector('time');

      return {
        authorName: authorEl?.textContent?.trim() || 'Unknown',
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

  return comments.filter((c) => !c.authorName.includes(myName));
}

export async function scrape(postCount: number): Promise<void> {
  const page = await getPage();

  console.log('Finding your profile...');
  const profileUrl = await getMyProfileUrl(page);
  console.log(`Profile: ${profileUrl}`);

  await page.goto(profileUrl, { waitUntil: 'networkidle2' });
  const myName = await page.evaluate(() => {
    const nameEl = document.querySelector('h1.text-heading-xlarge');
    return nameEl?.textContent?.trim() || '';
  });
  console.log(`Logged in as: ${myName}`);

  console.log(`Fetching latest ${postCount} posts...`);
  const postUrls = await getRecentPostUrls(page, profileUrl, postCount);
  console.log(`Found ${postUrls.length} posts`);

  const allComments: Comment[] = [];

  for (let i = 0; i < postUrls.length; i++) {
    console.log(`Scraping comments from post ${i + 1}/${postUrls.length}...`);
    const comments = await scrapePostComments(page, postUrls[i], myName);
    allComments.push(...comments);
    console.log(`  Found ${comments.length} comments`);
    await delay();
  }

  writeComments(allComments);
  console.log(`\nTotal: ${allComments.length} comments saved to data/comments.json`);
}
