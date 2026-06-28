import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'pink'];

export async function GET() {
  try {
    const db = getDb();
    const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '사용자 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, role } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const color = COLORS[count % COLORS.length];
    const id = uuidv4();

    db.prepare('INSERT INTO users (id, name, role, color) VALUES (?, ?, ?, ?)').run(
      id, name.trim(), role?.trim() || 'member', color
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '사용자 생성에 실패했습니다.' }, { status: 500 });
  }
}
