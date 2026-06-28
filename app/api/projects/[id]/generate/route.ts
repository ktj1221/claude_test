import { NextRequest, NextResponse } from 'next/server';
import { getDb, ReferenceScreen } from '@/lib/db';
import { generateMockup } from '@/lib/generate';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { proposalContent, description } = await req.json();

    if (!proposalContent?.trim()) {
      return NextResponse.json({ error: '기획안 내용을 입력해주세요.' }, { status: 400 });
    }

    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Load reference screens with image data
    const refScreens = db.prepare(
      'SELECT * FROM reference_screens WHERE project_id = ? ORDER BY created_at ASC'
    ).all(id) as ReferenceScreen[];

    // Generate mockup using Claude
    const htmlContent = await generateMockup(proposalContent, refScreens);

    // Determine version number
    const lastVersion = db.prepare(
      'SELECT MAX(version) as max_version FROM mockup_versions WHERE project_id = ?'
    ).get(id) as { max_version: number | null };

    const version = (lastVersion.max_version ?? 0) + 1;
    const mockupId = uuidv4();

    db.prepare(`
      INSERT INTO mockup_versions (id, project_id, version, proposal_content, html_content, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(mockupId, id, version, proposalContent.trim(), htmlContent, description?.trim() || null);

    return NextResponse.json({ id: mockupId, version, htmlContent }, { status: 201 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '목업 생성에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
