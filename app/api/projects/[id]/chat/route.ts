import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    const db = getDb();
    let messages;
    if (since) {
      messages = db.prepare(`
        SELECT cm.*, u.name as user_name, u.color as user_color
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.project_id = ? AND cm.created_at > ?
        ORDER BY cm.created_at ASC
        LIMIT 100
      `).all(id, since);
    } else {
      messages = db.prepare(`
        SELECT cm.*, u.name as user_name, u.color as user_color
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.project_id = ?
        ORDER BY cm.created_at DESC
        LIMIT 50
      `).all(id);
      messages = (messages as unknown[]).reverse();
    }
    return NextResponse.json(messages);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '채팅을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, content } = await req.json();

    if (!userId) return NextResponse.json({ error: '사용자를 선택해주세요.' }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });

    const db = getDb();
    const msgId = uuidv4();
    db.prepare(
      'INSERT INTO chat_messages (id, project_id, user_id, content) VALUES (?, ?, ?, ?)'
    ).run(msgId, id, userId, content.trim());

    const message = db.prepare(`
      SELECT cm.*, u.name as user_name, u.color as user_color
      FROM chat_messages cm JOIN users u ON cm.user_id = u.id
      WHERE cm.id = ?
    `).get(msgId);
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }
}
