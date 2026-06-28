import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const refScreens = db.prepare(
      'SELECT id, project_id, name, mime_type, created_at FROM reference_screens WHERE project_id = ? ORDER BY created_at ASC'
    ).all(id);

    const mockups = db.prepare(
      'SELECT id, project_id, version, proposal_content, description, created_at FROM mockup_versions WHERE project_id = ? ORDER BY version DESC'
    ).all(id);

    return NextResponse.json({ project, refScreens, mockups });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '프로젝트 정보를 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '프로젝트 삭제에 실패했습니다.' }, { status: 500 });
  }
}
