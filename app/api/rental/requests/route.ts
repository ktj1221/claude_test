import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession, generateRequestNumber } from '@/lib/rental-db';
import { MAX_PHOTO_B64_LEN } from '@/lib/constants';
import { v4 as uuidv4 } from 'uuid';

function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('rental_admin_token')?.value;
  return !!token && verifyAdminSession(token);
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const db = getRentalDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const VALID_STATUSES = new Set(['all', 'pending', 'approved', 'returned', 'completed', 'rejected']);
    if (status && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    let query = `
      SELECT r.id, r.request_number, r.equipment_id, r.requester_name, r.requester_phone,
             r.requester_email, r.purpose, r.rental_start_date, r.rental_end_date,
             r.status, r.requester_notes,
             r.approval_notes, r.rejection_notes, r.return_notes, r.completion_notes,
             r.approved_at, r.returned_at, r.completed_at, r.rejected_at, r.created_at,
             e.name as equipment_name, e.category as equipment_category
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
    `;
    const params: string[] = [];

    if (status && status !== 'all') {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const requests = db.prepare(query).all(...params);
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json({ error: '대여 신청 목록을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      equipment_id,
      requester_name,
      requester_phone,
      requester_email,
      purpose,
      rental_start_date,
      rental_end_date,
      requester_notes,
      request_photo,
      request_photo_mime,
    } = body;

    if (!equipment_id || !requester_name?.trim() || !requester_phone?.trim() || !purpose?.trim()) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // Server-side photo size guard
    if (request_photo && request_photo.length > MAX_PHOTO_B64_LEN) {
      return NextResponse.json({ error: '사진 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }
    const VALID_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (request_photo && request_photo_mime && !VALID_MIMES.includes(request_photo_mime)) {
      return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
    }

    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (rental_start_date && !ISO_DATE.test(rental_start_date)) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (rental_end_date && !ISO_DATE.test(rental_end_date)) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (rental_start_date && rental_end_date && rental_end_date < rental_start_date) {
      return NextResponse.json({ error: '반납 예정일은 대여 시작일 이후여야 합니다.' }, { status: 400 });
    }

    const db = getRentalDb();

    // Atomic: check availability + insert in one transaction to prevent double-booking
    const id = uuidv4();
    let requestNumber = '';

    const createRequest = db.transaction(() => {
      const equipment = db.prepare(
        'SELECT id FROM equipment WHERE id = ? AND is_available = 1'
      ).get(equipment_id) as { id: string } | undefined;

      if (!equipment) throw new Error('unavailable');

      requestNumber = generateRequestNumber();

      db.prepare(`
        INSERT INTO rental_requests (
          id, request_number, equipment_id, requester_name, requester_phone,
          requester_email, purpose, rental_start_date, rental_end_date,
          requester_notes, request_photo, request_photo_mime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        requestNumber,
        equipment_id,
        requester_name.trim(),
        requester_phone.trim(),
        requester_email?.trim() || null,
        purpose.trim(),
        rental_start_date || null,
        rental_end_date || null,
        requester_notes?.trim() || null,
        request_photo || null,
        request_photo_mime || 'image/jpeg',
      );
    });

    try {
      createRequest();
    } catch (err) {
      if (err instanceof Error && err.message === 'unavailable') {
        return NextResponse.json({ error: '대여 가능한 장비가 아닙니다.' }, { status: 400 });
      }
      throw err;
    }

    const request = db.prepare(`
      SELECT r.*, e.name as equipment_name, e.category as equipment_category
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.id = ?
    `).get(id);

    return NextResponse.json(request, { status: 201 });
  } catch {
    return NextResponse.json({ error: '대여 신청에 실패했습니다.' }, { status: 500 });
  }
}
