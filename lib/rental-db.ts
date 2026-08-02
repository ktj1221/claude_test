import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

let rentalSchemaInitialized = false;

export function initRentalSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      serial_number TEXT,
      image_data TEXT,
      image_mime TEXT DEFAULT 'image/jpeg',
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rental_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT NOT NULL UNIQUE,
      equipment_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_phone TEXT NOT NULL,
      requester_email TEXT,
      purpose TEXT NOT NULL,
      rental_start_date TEXT,
      rental_end_date TEXT,
      request_photo TEXT,
      request_photo_mime TEXT DEFAULT 'image/jpeg',
      approval_photo TEXT,
      approval_photo_mime TEXT DEFAULT 'image/jpeg',
      return_photo TEXT,
      return_photo_mime TEXT DEFAULT 'image/jpeg',
      completion_photo TEXT,
      completion_photo_mime TEXT DEFAULT 'image/jpeg',
      status TEXT NOT NULL DEFAULT 'pending',
      requester_notes TEXT,
      admin_notes TEXT,
      approval_notes TEXT,
      rejection_notes TEXT,
      return_notes TEXT,
      completion_notes TEXT,
      approved_at TEXT,
      returned_at TEXT,
      completed_at TEXT,
      rejected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    );

    CREATE TABLE IF NOT EXISTS request_counters (
      date TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_rental_requests_status ON rental_requests(status);
    CREATE INDEX IF NOT EXISTS idx_rental_requests_equipment_id ON rental_requests(equipment_id);

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Column migrations for existing installations
  const migrations = [
    'ALTER TABLE rental_requests ADD COLUMN approval_notes TEXT',
    'ALTER TABLE rental_requests ADD COLUMN rejection_notes TEXT',
    'ALTER TABLE rental_requests ADD COLUMN completion_notes TEXT',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Seed request_counters from existing data
  db.exec(`
    INSERT OR IGNORE INTO request_counters (date, count)
    SELECT
      substr(request_number, 4, 8),
      MAX(CAST(substr(request_number, 13) AS INTEGER))
    FROM rental_requests
    WHERE request_number LIKE 'IG-________-%'
    GROUP BY substr(request_number, 4, 8)
  `);
}

export function getRentalDb() {
  const db = getDb();
  if (!rentalSchemaInitialized) {
    initRentalSchema();
    rentalSchemaInitialized = true;
  }
  return db;
}

export function generateRequestNumber(): string {
  const db = getRentalDb();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Atomic increment — single statement, no TOCTOU race
  const row = db.prepare(`
    INSERT INTO request_counters (date, count) VALUES (?, 1)
    ON CONFLICT(date) DO UPDATE SET count = count + 1
    RETURNING count
  `).get(today) as { count: number };

  return `IG-${today}-${String(row.count).padStart(5, '0')}`;
}

export function createAdminSession(): string {
  const db = getRentalDb();
  // Clean up expired sessions on every new login
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();

  const id = uuidv4();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO admin_sessions (id, token, expires_at) VALUES (?, ?, ?)'
  ).run(id, token, expiresAt);

  return token;
}

let verifyCallCount = 0;
export function verifyAdminSession(token: string): boolean {
  const db = getRentalDb();
  // Opportunistic cleanup every 100 verifications to keep the sessions table small
  if (++verifyCallCount % 100 === 0) {
    db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
  }
  const session = db.prepare(
    "SELECT id FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(token) as { id: string } | undefined;
  return !!session;
}

export function deleteAdminSession(token: string): void {
  const db = getRentalDb();
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

export interface Equipment {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  serial_number: string | null;
  image_data: string | null;
  image_mime: string;
  is_available: number;
  created_at: string;
}

export type RentalStatus = 'pending' | 'approved' | 'returned' | 'completed' | 'rejected';

export interface RentalRequest {
  id: string;
  request_number: string;
  equipment_id: string;
  requester_name: string;
  requester_phone: string;
  requester_email: string | null;
  purpose: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  request_photo: string | null;
  request_photo_mime: string;
  approval_photo: string | null;
  approval_photo_mime: string;
  return_photo: string | null;
  return_photo_mime: string;
  completion_photo: string | null;
  completion_photo_mime: string;
  status: RentalStatus;
  requester_notes: string | null;
  approval_notes: string | null;
  rejection_notes: string | null;
  return_notes: string | null;
  completion_notes: string | null;
  approved_at: string | null;
  returned_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  equipment_name?: string;
  equipment_category?: string;
}
