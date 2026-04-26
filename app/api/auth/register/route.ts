import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    if (!email?.includes('@') || !password || password.length < 6) {
      return NextResponse.json({ error: '邮箱格式错误或密码太短（至少6位）' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 });
    }

    const hashed = await hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        tier: 'free',
        credits: 10,
      },
      select: { id: true, email: true, tier: true, credits: true },
    });

    const token = await createToken({ userId: user.id, email: user.email, tier: user.tier });
    
    return NextResponse.json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}