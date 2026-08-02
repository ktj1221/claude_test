import { NextRequest } from 'next/server';
import { verifyAdminSession } from './rental-db';

export function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('rental_admin_token')?.value;
  return !!token && verifyAdminSession(token);
}
