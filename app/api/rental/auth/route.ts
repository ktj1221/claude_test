import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  verifyAdminSession,
  deleteAdminSession,
  getRentalDb,
} from '@/lib/rental-db';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.RENTAL_ADMIN_PASSWORD;

// Module-level key so HMAC output is always 32 bytes regardless of input length,
// making the timingSafeEqual comparison constant-time and safe from truncation.
const HMAC_KEY = crypto.randomBytes(32);

// Simple in-memory rate limit: max 5 login attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;
  const MAX_ATTEMPTS = 5;

  // Opportunistic cleanup to prevent unbounded map growth
  if (loginAttempts.size > 500) {
    for (const [k, v] of loginAttempts) {
      if (now >= v.resetAt) loginAttempts.delete(k);
    }
  }

  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

function hmac(val: string): Buffer {
  return crypto.createHmac('sha256', HMAC_KEY).update(val, 'utf8').digest();
}

function checkPassword(input: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  try {
    return crypto.timingSafeEqual(hmac(input), hmac(ADMIN_PASSWORD));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: '서버 설정 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: '잠시 후 다시 시도해주세요. (15분간 5회 제한)' },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    if (typeof password !== 'string' || password.length > 1000) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    if (!checkPassword(password)) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    getRentalDb();
    const token = createAdminSession();

    const res = NextResponse.json({ success: true });
    res.cookies.set('rental_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: '로그인에 실패했습니다.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('rental_admin_token')?.value;
  if (!token || !verifyAdminSession(token)) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('rental_admin_token')?.value;
  if (token) {
    deleteAdminSession(token);
  }
  const res = NextResponse.json({ success: true });
  res.cookies.delete('rental_admin_token');
  return res;
}
