import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb } from '@/lib/rental-db';
import { MAX_PHOTO_B64_LEN, VALID_IMAGE_MIMES } from '@/lib/constants';
import { isAdmin } from '@/lib/admin-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

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
    if (name.trim().length > 100) {
      return NextResponse.json({ error: '장비 이름은 100자 이하여야 합니다.' }, { status: 400 });
    }
    if (description && description.trim().length > 1000) {
      return NextResponse.json({ error: '설명은 1000자 이하여야 합니다.' }, { status: 400 });
    }
    if (category && category.trim().length > 50) {
      return NextResponse.json({ error: '카테고리는 50자 이하여야 합니다.' }, { status: 400 });
    }
    if (serial_number && serial_number.trim().length > 100) {
      return NextResponse.json({ error: '시리얼 번호는 100자 이하여야 합니다.' }, { status: 400 });
    }

    if (image_data && image_data.length > MAX_PHOTO_B64_LEN) {
      return NextResponse.json({ error: '이미지 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }
    if (image_data && image_mime && !(VALID_IMAGE_MIMES as readonly string[]).includes(image_mime)) {
      return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    }

    const db = getRentalDb();
    const existing = db.prepare('SELECT id, is_available FROM equipment WHERE id = ?').get(id) as
      { id: string; is_available: number } | undefined;
    if (!existing) {
      return NextResponse.json({ error: '장비를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Preserve current availability when the field is omitted; never silently restore a locked equipment
    const newAvailable = is_available !== undefined ? (is_available ? 1 : 0) : existing.is_available;
    if (newAvailable === 1) {
      const activeRental = db.prepare(`
        SELECT id FROM rental_requests
        WHERE equipment_id = ? AND status IN ('approved', 'returned') LIMIT 1
      `).get(id);
      if (activeRental) {
        return NextResponse.json({ error: '진행 중인 대여가 있어 대여 가능으로 변경할 수 없습니다.' }, { status: 400 });
      }
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
      newAvailable,
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

    const performDelete = db.transaction(() => {
      const activeRental = db.prepare(`
        SELECT id FROM rental_requests
        WHERE equipment_id = ? AND status IN ('pending', 'approved', 'returned')
        LIMIT 1
      `).get(id);
      if (activeRental) throw Object.assign(new Error('active_rental'), { code: 'active_rental' });

      const anyRental = db.prepare(
        'SELECT id FROM rental_requests WHERE equipment_id = ? LIMIT 1'
      ).get(id);
      if (anyRental) throw Object.assign(new Error('has_history'), { code: 'has_history' });

      const result = db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
      if (result.changes === 0) throw Object.assign(new Error('not_found'), { code: 'not_found' });
    });

    try {
      performDelete();
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'active_rental') {
        return NextResponse.json({ error: '진행 중인 대여가 있는 장비는 삭제할 수 없습니다.' }, { status: 400 });
      }
      if (e.code === 'has_history') {
        return NextResponse.json({ error: '대여 이력이 있는 장비는 삭제할 수 없습니다.' }, { status: 400 });
      }
      if (e.code === 'not_found') {
        return NextResponse.json({ error: '장비를 찾을 수 없습니다.' }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '장비 삭제에 실패했습니다.' }, { status: 500 });
  }
}
