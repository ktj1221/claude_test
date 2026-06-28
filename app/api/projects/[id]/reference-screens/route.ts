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
    const screens = db.prepare(
      'SELECT id, project_id, name, mime_type, created_at FROM reference_screens WHERE project_id = ? ORDER BY created_at ASC'
    ).all(id);
    return NextResponse.json(screens);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '참조 화면 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const existingCount = (db.prepare(
      'SELECT COUNT(*) as count FROM reference_screens WHERE project_id = ?'
    ).get(id) as { count: number }).count;

    if (existingCount >= 3) {
      return NextResponse.json({ error: '참조 화면은 최대 3개까지 등록할 수 있습니다.' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: '파일을 선택해주세요.' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, GIF, WEBP 형식만 지원합니다.' }, { status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const screenId = uuidv4();
    const screenName = name?.trim() || file.name || `참조화면 ${existingCount + 1}`;

    db.prepare(`
      INSERT INTO reference_screens (id, project_id, name, image_data, mime_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(screenId, id, screenName, base64, file.type);

    return NextResponse.json({ id: screenId, name: screenName }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '참조 화면 업로드에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { screenId } = await req.json();
    const db = getDb();
    db.prepare('DELETE FROM reference_screens WHERE id = ? AND project_id = ?').run(screenId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
