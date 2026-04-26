export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: '登录已过期' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, tier: true, credits: true, totalUsed: true, createdAt: true },
    });

    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}