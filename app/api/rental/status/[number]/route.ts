import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb } from '@/lib/rental-db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;
    const { searchParams } = new URL(req.url);
    const verify = searchParams.get('verify')?.trim(); // last 4 digits of phone

    const db = getRentalDb();

    // Always return basic status info (no PII)
    const basic = db.prepare(`
      SELECT
        r.request_number, r.status,
        r.rental_start_date, r.rental_end_date,
        r.approved_at, r.returned_at, r.completed_at, r.rejected_at, r.created_at,
        e.name as equipment_name, e.category as equipment_category,
        e.image_data as equipment_image, e.image_mime as equipment_image_mime
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.request_number = ?
    `).get(number);

    if (!basic) {
      return NextResponse.json({ error: '해당 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Full details only when phone last-4 matches (exact suffix, no LIKE wildcards)
    if (verify) {
      // Validate: must be exactly 4 digits to prevent wildcard/injection abuse
      if (!/^\d{4}$/.test(verify)) {
        return NextResponse.json({ error: '연락처가 일치하지 않습니다.' }, { status: 403 });
      }

      const full = db.prepare(`
        SELECT
          r.request_number, r.requester_name, r.purpose,
          r.rental_start_date, r.rental_end_date, r.status,
          r.requester_notes, r.approval_notes, r.rejection_notes,
          r.return_notes, r.completion_notes,
          r.request_photo, r.request_photo_mime,
          r.approval_photo, r.approval_photo_mime,
          r.return_photo, r.return_photo_mime,
          r.completion_photo, r.completion_photo_mime,
          r.approved_at, r.returned_at, r.completed_at, r.rejected_at, r.created_at,
          e.name as equipment_name, e.category as equipment_category,
          e.image_data as equipment_image, e.image_mime as equipment_image_mime
        FROM rental_requests r
        JOIN equipment e ON r.equipment_id = e.id
        WHERE r.request_number = ? AND SUBSTR(r.requester_phone, -4) = ?
      `).get(number, verify);

      if (!full) {
        return NextResponse.json({ error: '연락처가 일치하지 않습니다.' }, { status: 403 });
      }

      return NextResponse.json({ ...full, verified: true });
    }

    return NextResponse.json({ ...basic, verified: false });
  } catch {
    return NextResponse.json({ error: '대여 현황을 불러올 수 없습니다.' }, { status: 500 });
  }
}
