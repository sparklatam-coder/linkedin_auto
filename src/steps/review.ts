import chalk from 'chalk';
import { readContacts, writeContacts } from '../data.js';

// 자동 승인 — pending → approved
export async function autoApprove(): Promise<void> {
  const contacts = readContacts();
  let replyCount = 0;
  let dmCount = 0;

  for (const c of contacts) {
    if (c.reply.status === 'pending' && c.reply.content) {
      c.reply.status = 'approved';
      replyCount++;
    }
    if (c.dm.status === 'pending' && c.dm.content) {
      c.dm.status = 'approved';
      dmCount++;
    }
  }

  writeContacts(contacts);
  console.log(`Auto-approved ${replyCount} replies and ${dmCount} DMs.`);
}

// 상태 요약 표시
export async function review(): Promise<void> {
  const contacts = readContacts();

  console.log(chalk.bold('\n=== Contact Status ===\n'));

  for (const c of contacts) {
    const replyIcon = c.reply.status === 'sent' ? '✓' : c.reply.status === 'skipped' ? '–' : c.reply.status === 'approved' ? '◎' : '○';
    const dmIcon = c.dm.status === 'sent' ? '✓' : c.dm.status === 'not-connected' ? '✗' : c.dm.status === 'approved' ? '◎' : '○';
    const connIcon = c.isConnected === true ? '1촌' : c.isConnected === false ? '2촌+' : '?';

    console.log(`${replyIcon} Reply | ${dmIcon} DM | [${connIcon}] ${c.authorName}: "${c.commentContent.slice(0, 30)}"`);
  }

  const summary = {
    total: contacts.length,
    replySent: contacts.filter(c => c.reply.status === 'sent').length,
    replySkipped: contacts.filter(c => c.reply.status === 'skipped').length,
    replyPending: contacts.filter(c => c.reply.status === 'pending').length,
    replyApproved: contacts.filter(c => c.reply.status === 'approved').length,
    dmSent: contacts.filter(c => c.dm.status === 'sent').length,
    dmNotConn: contacts.filter(c => c.dm.status === 'not-connected').length,
    dmPending: contacts.filter(c => c.dm.status === 'pending').length,
    dmApproved: contacts.filter(c => c.dm.status === 'approved').length,
  };

  console.log(chalk.bold(`\nSummary: ${summary.total} contacts`));
  console.log(`  Reply: ${summary.replySent} sent, ${summary.replyApproved} approved, ${summary.replyPending} pending, ${summary.replySkipped} skipped`);
  console.log(`  DM: ${summary.dmSent} sent, ${summary.dmApproved} approved, ${summary.dmPending} pending, ${summary.dmNotConn} not connected`);
}
