import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession } from '@/lib/rental-db';

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('rental_admin_token')?.value;
  return !!token && verifyAdminSession(token);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getRentalDb();
    const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
    if (!equipment) {
      return NextResponse.json({ error: '장비를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(equipment);
  } catch {
    return NextResponse.json({ error: '장비 정보를 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, category, serial_number, image_data, image_mime, is_available } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '장비 이름을 입력해주세요.' }, { status: 400 });
    }

    const db = getRentalDb();
    const existing = db.prepare('SELECT id FROM equipment WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: '장비를 찾을 수 없습니다.' }, { status: 404 });
    }

    db.prepare(`
      UPDATE equipment SET
        name = ?, description = ?, category = ?, serial_number = ?,
        image_data = ?, image_mime = ?, is_available = ?
      WHERE id = ?
    `).run(
      name.trim(),
      description?.trim() || null,
      category?.trim() || null,
      serial_number?.trim() || null,
      image_data !== undefined ? image_data : null,
      image_mime || 'image/jpeg',
      is_available !== undefined ? (is_available ? 1 : 0) : 1,
      id,
    );

    const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(id);
    return NextResponse.json(equipment);
  } catch {
    return NextResponse.json({ error: '장비 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getRentalDb();

    const activeRentals = db.prepare(`
      SELECT id FROM rental_requests
      WHERE equipment_id = ? AND status IN ('pending', 'approved', 'returned')
    `).get(id);

    if (activeRentals) {
      return NextResponse.json(
        { error: '진행 중인 대여가 있는 장비는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '장비 삭제에 실패했습니다.' }, { status: 500 });
  }
}
