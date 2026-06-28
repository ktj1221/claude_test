import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  verifyAdminSession,
  deleteAdminSession,
  getRentalDb,
} from '@/lib/rental-db';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.RENTAL_ADMIN_PASSWORD;

function checkPassword(input: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(input.padEnd(128).slice(0, 128));
    const b = Buffer.from(ADMIN_PASSWORD.padEnd(128).slice(0, 128));
    return (
      a.length === b.length &&
      crypto.timingSafeEqual(a, b) &&
      input === ADMIN_PASSWORD
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'RENTAL_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { password } = await req.json();
    if (!checkPassword(password ?? '')) {
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
