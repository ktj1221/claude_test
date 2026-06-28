import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  try {
    const { screenId } = await params;
    const db = getDb();
    const screen = db.prepare('SELECT image_data, mime_type FROM reference_screens WHERE id = ?').get(screenId) as
      | { image_data: string; mime_type: string }
      | undefined;

    if (!screen) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const buffer = Buffer.from(screen.image_data, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': screen.mime_type,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '이미지를 불러올 수 없습니다.' }, { status: 500 });
  }
}
