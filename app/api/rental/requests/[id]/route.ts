import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession, RentalStatus } from '@/lib/rental-db';

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('rental_admin_token')?.value;
  return !!token && verifyAdminSession(token);
}

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
    const request = db.prepare(`
      SELECT r.*, e.name as equipment_name, e.category as equipment_category
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = ?
    `).get(id);

    if (!request) {
      return NextResponse.json({ error: '대여 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(request);
  } catch {
    return NextResponse.json({ error: '대여 신청 정보를 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, admin_notes, return_notes, photo, photo_mime } = body;

    const db = getRentalDb();
    const existing = db.prepare(`
      SELECT r.*, e.id as equip_id
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = ?
    `).get(id) as { status: RentalStatus; equip_id: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: '대여 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === 'approve') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: '대기 중인 신청만 승인할 수 있습니다.' }, { status: 400 });
      }
      db.prepare(`
        UPDATE rental_requests SET
          status = 'approved', admin_notes = ?, approval_photo = ?,
          approval_photo_mime = ?, approved_at = ?
        WHERE id = ?
      `).run(admin_notes || null, photo || null, photo_mime || 'image/jpeg', now, id);

      db.prepare('UPDATE equipment SET is_available = 0 WHERE id = ?').run(existing.equip_id);

    } else if (action === 'reject') {
      if (existing.status !== 'pending') {
        return NextResponse.json({ error: '대기 중인 신청만 거절할 수 있습니다.' }, { status: 400 });
      }
      db.prepare(`
        UPDATE rental_requests SET
          status = 'rejected', admin_notes = ?, rejected_at = ?
        WHERE id = ?
      `).run(admin_notes || null, now, id);

    } else if (action === 'mark_returned') {
      if (existing.status !== 'approved') {
        return NextResponse.json({ error: '승인된 대여만 반납 처리할 수 있습니다.' }, { status: 400 });
      }
      db.prepare(`
        UPDATE rental_requests SET
          status = 'returned', return_notes = ?, return_photo = ?,
          return_photo_mime = ?, returned_at = ?
        WHERE id = ?
      `).run(return_notes || null, photo || null, photo_mime || 'image/jpeg', now, id);

    } else if (action === 'complete') {
      if (existing.status !== 'returned') {
        return NextResponse.json({ error: '반납 완료된 대여만 반납 승인할 수 있습니다.' }, { status: 400 });
      }
      db.prepare(`
        UPDATE rental_requests SET
          status = 'completed', admin_notes = ?, completion_photo = ?,
          completion_photo_mime = ?, completed_at = ?
        WHERE id = ?
      `).run(admin_notes || null, photo || null, photo_mime || 'image/jpeg', now, id);

      db.prepare('UPDATE equipment SET is_available = 1 WHERE id = ?').run(existing.equip_id);

    } else {
      return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 });
    }

    const updated = db.prepare(`
      SELECT r.*, e.name as equipment_name, e.category as equipment_category
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = ?
    `).get(id);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '상태 변경에 실패했습니다.' }, { status: 500 });
  }
}
