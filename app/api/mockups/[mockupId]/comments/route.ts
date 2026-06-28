import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mockupId: string }> }
) {
  try {
    const { mockupId } = await params;
    const db = getDb();
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.color as user_color
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.mockup_version_id = ?
      ORDER BY c.created_at ASC
    `).all(mockupId);
    return NextResponse.json(comments);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '의견 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mockupId: string }> }
) {
  try {
    const { mockupId } = await params;
    const { userId, content } = await req.json();

    if (!userId) return NextResponse.json({ error: '사용자를 선택해주세요.' }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });

    const db = getDb();

    const mockup = db.prepare('SELECT id FROM mockup_versions WHERE id = ?').get(mockupId);
    if (!mockup) return NextResponse.json({ error: '목업을 찾을 수 없습니다.' }, { status: 404 });

    const commentId = uuidv4();
    db.prepare(
      'INSERT INTO comments (id, mockup_version_id, user_id, content) VALUES (?, ?, ?, ?)'
    ).run(commentId, mockupId, userId, content.trim());

    const comment = db.prepare(`
      SELECT c.*, u.name as user_name, u.color as user_color
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '의견 작성에 실패했습니다.' }, { status: 500 });
  }
}
