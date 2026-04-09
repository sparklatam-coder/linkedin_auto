import { execFileSync } from 'child_process';
import { readContacts, writeContacts } from '../data.js';
import { loadConfig } from '../config.js';

function callClaude(prompt: string): string {
  try {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const result = execFileSync('claude', ['-p', prompt], {
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      env,
    });
    return result.trim();
  } catch (error) {
    console.error('Claude CLI call failed:', (error as Error).message?.slice(0, 200));
    return '';
  }
}

export async function generate(): Promise<void> {
  const config = loadConfig();
  const contacts = readContacts();

  // 대댓글이 pending이고 content 비어있는 것만 (이미 sent/skipped는 무시)
  const toGenerate = contacts.filter(c =>
    c.reply.status === 'pending' && c.reply.content === ''
  );

  if (toGenerate.length === 0) {
    console.log('No new comments to process.');
    return;
  }

  console.log(`Generating replies and DMs for ${toGenerate.length} comments...`);

  for (let i = 0; i < toGenerate.length; i++) {
    const c = toGenerate[i];
    console.log(`\n[${i + 1}/${toGenerate.length}] ${c.authorName}: "${c.commentContent.slice(0, 50)}..."`);

    // Generate reply
    const replyPrompt = `You are managing a LinkedIn account. Generate a natural, warm reply to this comment on my post.

My post (excerpt): "${c.postContent.slice(0, 300)}"
Comment by ${c.authorName}: "${c.commentContent}"

Rules:
- Write in the same language as the comment
- Be genuine and grateful
- Keep it concise (1-3 sentences)
- Do not use hashtags
- Do not be overly formal
- Output ONLY the reply text, nothing else`;

    const replyContent = callClaude(replyPrompt);
    if (replyContent) {
      c.reply.content = replyContent;
      console.log(`  Reply: "${replyContent.slice(0, 60)}..."`);
    }

    // Generate DM (이미 sent면 스킵)
    if (c.dm.status === 'sent' || c.dm.content) {
      console.log(`  DM: skipped (already ${c.dm.status})`);
      continue;
    }

    const dmPrompt = `You are managing a LinkedIn account. Generate a natural networking DM to someone who commented on my post.

Recipient: ${c.authorName}
Their comment on my post: "${c.commentContent}"
Service/content to mention naturally: "${config.promoText}"

Rules:
- Write in the same language as the comment
- Start with gratitude for their comment
- Naturally transition to mentioning the service/content
- Keep it concise (3-5 sentences)
- Sound personal, not like a template
- Do not use hashtags or emojis
- Output ONLY the message text, nothing else`;

    const dmContent = callClaude(dmPrompt);
    if (dmContent) {
      c.dm.content = dmContent;
      console.log(`  DM: "${dmContent.slice(0, 60)}..."`);
    }

    writeContacts(contacts); // 매 건마다 저장
  }

  console.log(`\nGenerated for ${toGenerate.length} contacts. Saved to data/contacts.json`);
}
