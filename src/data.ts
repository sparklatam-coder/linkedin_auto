import fs from 'fs';
import path from 'path';
import type { Comment, Reply, DirectMessage } from './types.js';

const DATA_DIR = path.resolve('data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

function writeJson<T>(filename: string, data: T[]): void {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readComments(): Comment[] {
  return readJson<Comment>('comments.json');
}

export function writeComments(comments: Comment[]): void {
  writeJson('comments.json', comments);
}

export function readReplies(): Reply[] {
  return readJson<Reply>('replies.json');
}

export function writeReplies(replies: Reply[]): void {
  writeJson('replies.json', replies);
}

export function readMessages(): DirectMessage[] {
  return readJson<DirectMessage>('messages.json');
}

export function writeMessages(messages: DirectMessage[]): void {
  writeJson('messages.json', messages);
}

export function readSession(): Record<string, unknown>[] | null {
  const filepath = path.join(DATA_DIR, 'session.json');
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

export function writeSession(cookies: Record<string, unknown>[]): void {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, 'session.json');
  fs.writeFileSync(filepath, JSON.stringify(cookies, null, 2), 'utf-8');
}
