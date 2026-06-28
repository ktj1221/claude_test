import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM reference_screens WHERE project_id = p.id) as ref_count,
        (SELECT COUNT(*) FROM mockup_versions WHERE project_id = p.id) as mockup_count
      FROM projects p
      ORDER BY p.created_at DESC
    `).all();
    return NextResponse.json(projects);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '프로젝트 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: '프로젝트 이름을 입력해주세요.' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, name, description) VALUES (?, ?, ?)
    `).run(id, name.trim(), description?.trim() || null);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '프로젝트 생성에 실패했습니다.' }, { status: 500 });
  }
}
