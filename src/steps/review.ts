import inquirer from 'inquirer';
import chalk from 'chalk';
import { readReplies, readMessages, readComments, writeReplies, writeMessages } from '../data.js';
import type { Reply, DirectMessage } from '../types.js';

async function reviewItem(
  type: string,
  recipient: string,
  originalComment: string,
  generatedContent: string
): Promise<{ status: 'approved' | 'modified' | 'rejected'; finalContent: string }> {
  console.log(chalk.cyan(`\n─── ${type} to ${recipient} ───`));
  console.log(chalk.gray(`Original comment: "${originalComment}"`));
  console.log(chalk.white(`\n${generatedContent}\n`));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Action:',
      choices: [
        { name: chalk.green('Approve'), value: 'approved' },
        { name: chalk.yellow('Modify'), value: 'modified' },
        { name: chalk.red('Reject'), value: 'rejected' },
      ],
    },
  ]);

  if (action === 'modified') {
    const { edited } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'edited',
        message: 'Edit the content:',
        default: generatedContent,
      },
    ]);
    return { status: 'modified', finalContent: edited.trim() };
  }

  return { status: action, finalContent: generatedContent };
}

export async function review(): Promise<void> {
  const replies = readReplies();
  const messages = readMessages();
  const comments = readComments();

  const commentMap = new Map(comments.map((c) => [c.id, c]));

  const pendingReplies = replies.filter((r) => r.status === 'pending');
  if (pendingReplies.length > 0) {
    console.log(chalk.bold(`\n=== Reviewing ${pendingReplies.length} Replies ===`));

    for (const reply of pendingReplies) {
      const comment = commentMap.get(reply.commentId);
      const result = await reviewItem(
        'Reply',
        comment?.authorName || 'Unknown',
        reply.originalComment,
        reply.generatedContent
      );
      reply.status = result.status;
      reply.finalContent = result.finalContent;
    }
  } else {
    console.log('No pending replies to review.');
  }

  const pendingMessages = messages.filter((m) => m.status === 'pending');
  if (pendingMessages.length > 0) {
    console.log(chalk.bold(`\n=== Reviewing ${pendingMessages.length} DMs ===`));

    for (const msg of pendingMessages) {
      const result = await reviewItem(
        'DM',
        msg.recipientName,
        commentMap.get(msg.commentId)?.content || '',
        msg.generatedContent
      );
      msg.status = result.status;
      msg.finalContent = result.finalContent;
    }
  } else {
    console.log('No pending DMs to review.');
  }

  writeReplies(replies);
  writeMessages(messages);

  const approvedReplies = replies.filter((r) => r.status === 'approved' || r.status === 'modified').length;
  const approvedDMs = messages.filter((m) => m.status === 'approved' || m.status === 'modified').length;
  console.log(chalk.bold(`\nSummary: ${approvedReplies} replies and ${approvedDMs} DMs approved for sending.`));
}
