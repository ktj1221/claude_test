import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb, generateRequestNumber } from '@/lib/rental-db';
import { MAX_PHOTO_B64_LEN, VALID_IMAGE_MIMES } from '@/lib/constants';
import { isAdmin } from '@/lib/admin-auth';
import { v4 as uuidv4 } from 'uuid';

// In-memory rate limit: max 5 submissions per IP per 10 minutes
const submitAttempts = new Map<string, { count: number; resetAt: number }>();

function checkSubmitRateLimit(ip: string): boolean {
  const now = Date.now();
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 5;

  if (submitAttempts.size > 1000) {
    for (const [k, v] of submitAttempts) {
      if (now >= v.resetAt) submitAttempts.delete(k);
    }
  }

  const entry = submitAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    submitAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkSubmitRateLimit(ip)) {
    return NextResponse.json(
      { error: '잠시 후 다시 시도해주세요. (10분간 5회 제한)' },
      { status: 429 }
    );
  }

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

    if (requester_name.trim().length > 100) {
      return NextResponse.json({ error: '이름은 100자 이하여야 합니다.' }, { status: 400 });
    }
    if (requester_phone.trim().length < 4) {
      return NextResponse.json({ error: '연락처는 4자 이상 입력해주세요.' }, { status: 400 });
    }
    if (requester_phone.trim().length > 20) {
      return NextResponse.json({ error: '연락처는 20자 이하여야 합니다.' }, { status: 400 });
    }
    if (requester_email && requester_email.trim().length > 200) {
      return NextResponse.json({ error: '이메일은 200자 이하여야 합니다.' }, { status: 400 });
    }
    if (requester_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requester_email.trim())) {
      return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    if (purpose.trim().length > 1000) {
      return NextResponse.json({ error: '사용 목적은 1000자 이하여야 합니다.' }, { status: 400 });
    }
    if (requester_notes && requester_notes.trim().length > 500) {
      return NextResponse.json({ error: '메모는 500자 이하여야 합니다.' }, { status: 400 });
    }

    // Server-side photo size guard
    if (request_photo && request_photo.length > MAX_PHOTO_B64_LEN) {
      return NextResponse.json({ error: '사진 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }
    if (request_photo && request_photo_mime && !(VALID_IMAGE_MIMES as readonly string[]).includes(request_photo_mime)) {
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
