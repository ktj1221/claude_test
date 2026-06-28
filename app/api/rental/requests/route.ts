import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, verifyAdminSession, generateRequestNumber } from '@/lib/rental-db';
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

    let query = `
      SELECT r.*, e.name as equipment_name, e.category as equipment_category
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

    const db = getRentalDb();
    const equipment = db.prepare(
      'SELECT * FROM equipment WHERE id = ? AND is_available = 1'
    ).get(equipment_id) as { id: string } | undefined;

    if (!equipment) {
      return NextResponse.json({ error: '대여 가능한 장비가 아닙니다.' }, { status: 400 });
    }

    const id = uuidv4();
    const requestNumber = generateRequestNumber();

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
