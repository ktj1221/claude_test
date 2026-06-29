import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession } from '@/lib/rental-db';
import { MAX_PHOTO_B64_LEN } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('rental_admin_token')?.value;
  return !!token && verifyAdminSession(token);
}

export async function GET(req: NextRequest) {
  try {
    const db = getRentalDb();
    const { searchParams } = new URL(req.url);
    const onlyAvailable = searchParams.get('available') === 'true';

    const query = onlyAvailable
      ? 'SELECT * FROM equipment WHERE is_available = 1 ORDER BY name ASC'
      : 'SELECT * FROM equipment ORDER BY name ASC';

    const equipment = db.prepare(query).all();
    return NextResponse.json(equipment);
  } catch {
    return NextResponse.json({ error: '장비 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, category, serial_number, image_data, image_mime } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '장비 이름을 입력해주세요.' }, { status: 400 });
    }

    if (image_data && image_data.length > MAX_PHOTO_B64_LEN) {
      return NextResponse.json({ error: '이미지 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    const db = getRentalDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO equipment (id, name, description, category, serial_number, image_data, image_mime)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      description?.trim() || null,
      category?.trim() || null,
      serial_number?.trim() || null,
      image_data || null,
      image_mime || 'image/jpeg',
    );

    const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
    return NextResponse.json(equipment, { status: 201 });
  } catch {
    return NextResponse.json({ error: '장비 추가에 실패했습니다.' }, { status: 500 });
  }
}
