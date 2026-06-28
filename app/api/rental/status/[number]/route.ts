import { NextRequest, NextResponse } from 'next/server';
import { getRentalDb } from '@/lib/rental-db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params;
    const db = getRentalDb();

    const request = db.prepare(`
      SELECT
        r.id, r.request_number, r.requester_name, r.purpose,
        r.rental_start_date, r.rental_end_date, r.status,
        r.requester_notes, r.admin_notes, r.return_notes,
        r.request_photo, r.request_photo_mime,
        r.approval_photo, r.approval_photo_mime,
        r.return_photo, r.return_photo_mime,
        r.completion_photo, r.completion_photo_mime,
        r.approved_at, r.returned_at, r.completed_at, r.rejected_at, r.created_at,
        e.name as equipment_name, e.category as equipment_category,
        e.image_data as equipment_image, e.image_mime as equipment_image_mime
      FROM rental_requests r
      JOIN equipment e ON r.equipment_id = e.id
      WHERE r.request_number = ?
    `).get(number);

    if (!request) {
      return NextResponse.json({ error: '해당 신청을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json(request);
  } catch {
    return NextResponse.json({ error: '대여 현황을 불러올 수 없습니다.' }, { status: 500 });
  }
}
