import { execSync } from 'child_process';
import { readComments, readReplies, readMessages, writeReplies, writeMessages } from '../data.js';
import { loadConfig } from '../config.js';
import type { Reply, DirectMessage } from '../types.js';

function callClaude(prompt: string): string {
  try {
    const escaped = prompt.replace(/'/g, "'\\''");
    const result = execSync(`claude -p '${escaped}'`, {
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    return result.trim();
  } catch (error) {
    console.error('Claude CLI call failed:', (error as Error).message);
    return '';
  }
}

export async function generate(): Promise<void> {
  const config = loadConfig();
  const comments = readComments();
  const existingReplies = readReplies();
  const existingMessages = readMessages();

  const existingReplyIds = new Set(existingReplies.map((r) => r.commentId));
  const existingMessageIds = new Set(existingMessages.map((m) => m.commentId));
  const unreplied = comments.filter((c) => !c.alreadyReplied && !existingReplyIds.has(c.id));

  if (unreplied.length === 0) {
    console.log('No new comments to process.');
    return;
  }

  console.log(`Generating replies and DMs for ${unreplied.length} comments...`);

  const newReplies: Reply[] = [];
  const newMessages: DirectMessage[] = [];

  for (let i = 0; i < unreplied.length; i++) {
    const comment = unreplied[i];
    console.log(`\n[${i + 1}/${unreplied.length}] Processing comment by ${comment.authorName}...`);
    console.log(`  Comment: "${comment.content.slice(0, 80)}..."`);

    // Generate reply
    const replyPrompt = `You are managing a LinkedIn account. Generate a natural, warm reply to this comment on my post.

My post (excerpt): "${comment.postContent.slice(0, 300)}"
Comment by ${comment.authorName}: "${comment.content}"

Rules:
- Write in the same language as the comment
- Be genuine and grateful
- Keep it concise (1-3 sentences)
- Do not use hashtags
- Do not be overly formal
- Output ONLY the reply text, nothing else`;

    const replyContent = callClaude(replyPrompt);
    if (replyContent) {
      newReplies.push({
        commentId: comment.id,
        originalComment: comment.content,
        generatedContent: replyContent,
        status: 'pending',
        finalContent: replyContent,
      });
      console.log(`  Reply: "${replyContent.slice(0, 60)}..."`);
    }

    // Generate DM
    if (!existingMessageIds.has(comment.id)) {
      const dmPrompt = `You are managing a LinkedIn account. Generate a natural networking DM to someone who commented on my post.

Recipient: ${comment.authorName}
Their comment on my post: "${comment.content}"
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
        newMessages.push({
          commentId: comment.id,
          recipientName: comment.authorName,
          recipientProfileUrl: comment.authorProfileUrl,
          generatedContent: dmContent,
          status: 'pending',
          finalContent: dmContent,
        });
        console.log(`  DM: "${dmContent.slice(0, 60)}..."`);
      }
    }
  }

  writeReplies([...existingReplies, ...newReplies]);
  writeMessages([...existingMessages, ...newMessages]);

  console.log(`\nGenerated ${newReplies.length} replies and ${newMessages.length} DMs`);
  console.log('Saved to data/replies.json and data/messages.json');
}
