import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mockupId: string }> }
) {
  try {
    const { mockupId } = await params;
    const db = getDb();
    const mockup = db.prepare('SELECT * FROM mockup_versions WHERE id = ?').get(mockupId);
    if (!mockup) {
      return NextResponse.json({ error: '목업을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(mockup);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '목업을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ mockupId: string }> }
) {
  try {
    const { mockupId } = await params;
    const db = getDb();
    db.prepare('DELETE FROM mockup_versions WHERE id = ?').run(mockupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
