import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const members = db.prepare(`
      SELECT pm.*, u.name as user_name, u.color as user_color, u.role as user_role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY pm.joined_at ASC
    `).all(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '담당자 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: '사용자를 선택해주세요.' }, { status: 400 });
    }
    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(id, userId);
    if (existing) {
      return NextResponse.json({ error: '이미 추가된 담당자입니다.' }, { status: 409 });
    }
    const memberId = uuidv4();
    db.prepare(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)'
    ).run(memberId, id, userId, role || 'member');

    const member = db.prepare(`
      SELECT pm.*, u.name as user_name, u.color as user_color, u.role as user_role
      FROM project_members pm JOIN users u ON pm.user_id = u.id
      WHERE pm.id = ?
    `).get(memberId);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '담당자 추가에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await req.json();
    const db = getDb();
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '담당자 삭제에 실패했습니다.' }, { status: 500 });
  }
}
