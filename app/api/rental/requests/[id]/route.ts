import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession, RentalStatus } from '@/lib/rental-db';
import { MAX_PHOTO_B64_LEN } from '@/lib/constants';

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
    const { action, note, photo, photo_mime } = body;

    if (photo && photo.length > MAX_PHOTO_B64_LEN) {
      return NextResponse.json({ error: '사진 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    const db = getRentalDb();

    const performAction = db.transaction(() => {
      const existing = db.prepare(`
        SELECT r.status, e.id as equip_id
        FROM rental_requests r
        JOIN equipment e ON r.equipment_id = e.id
        WHERE r.id = ?
      `).get(id) as { status: RentalStatus; equip_id: string } | undefined;

      if (!existing) throw Object.assign(new Error('not_found'), { code: 'not_found' });

      const now = new Date().toISOString();

      if (action === 'approve') {
        if (existing.status !== 'pending') {
          throw Object.assign(new Error('대기 중인 신청만 승인할 수 있습니다.'), { code: 'invalid_state' });
        }
        db.prepare(`
          UPDATE rental_requests SET
            status = 'approved', approval_notes = ?,
            approval_photo = ?, approval_photo_mime = ?, approved_at = ?
          WHERE id = ?
        `).run(note || null, photo || null, photo_mime || 'image/jpeg', now, id);

        db.prepare('UPDATE equipment SET is_available = 0 WHERE id = ?').run(existing.equip_id);

      } else if (action === 'reject') {
        if (existing.status !== 'pending') {
          throw Object.assign(new Error('대기 중인 신청만 거절할 수 있습니다.'), { code: 'invalid_state' });
        }
        db.prepare(`
          UPDATE rental_requests SET
            status = 'rejected', rejection_notes = ?, rejected_at = ?
          WHERE id = ?
        `).run(note || null, now, id);

      } else if (action === 'mark_returned') {
        if (existing.status !== 'approved') {
          throw Object.assign(new Error('승인된 대여만 반납 처리할 수 있습니다.'), { code: 'invalid_state' });
        }
        db.prepare(`
          UPDATE rental_requests SET
            status = 'returned', return_notes = ?,
            return_photo = ?, return_photo_mime = ?, returned_at = ?
          WHERE id = ?
        `).run(note || null, photo || null, photo_mime || 'image/jpeg', now, id);

      } else if (action === 'complete') {
        if (existing.status !== 'returned') {
          throw Object.assign(new Error('반납 완료된 대여만 반납 승인할 수 있습니다.'), { code: 'invalid_state' });
        }
        db.prepare(`
          UPDATE rental_requests SET
            status = 'completed', completion_notes = ?,
            completion_photo = ?, completion_photo_mime = ?, completed_at = ?
          WHERE id = ?
        `).run(note || null, photo || null, photo_mime || 'image/jpeg', now, id);

        db.prepare('UPDATE equipment SET is_available = 1 WHERE id = ?').run(existing.equip_id);

      } else {
        throw Object.assign(new Error('유효하지 않은 액션입니다.'), { code: 'invalid_action' });
      }
    });

    try {
      performAction();
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'not_found') {
        return NextResponse.json({ error: '대여 신청을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (e.code === 'invalid_state' || e.code === 'invalid_action') {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw err;
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
