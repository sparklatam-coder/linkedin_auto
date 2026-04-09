import fs from 'fs';
import path from 'path';
import type { Contact } from './types.js';

const DATA_DIR = path.resolve('data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readContacts(): Contact[] {
  const filepath = path.join(DATA_DIR, 'contacts.json');
  if (!fs.existsSync(filepath)) return [];
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

export function writeContacts(contacts: Contact[]): void {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, 'contacts.json');
  fs.writeFileSync(filepath, JSON.stringify(contacts, null, 2), 'utf-8');
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
