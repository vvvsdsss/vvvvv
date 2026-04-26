import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
    const { success: ipAllowed } = await rateLimit(`ip:${ip}`);
    if (!ipAllowed) {
      return NextResponse.json({ error: '当前IP请求过于频繁，请1分钟后再试' }, { status: 429 });
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.credits <= 0) {
      return NextResponse.json({ error: '今日额度已用完，请升级Pro套餐或明日再来' }, { status: 403 });
    }

    const { messages, model = 'gpt-4o-mini' } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: '消息格式错误' }, { status: 400 });
    }

    const allowedModels = getAllowedModels(user.tier);
    if (!allowedModels.includes(model)) {
      return NextResponse.json({ error: '该模型为Pro专属，请升级后使用' }, { status: 403 });
    }

    const stream = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              credits: { decrement: 1 },
              totalUsed: { increment: 1 },
            },
          });
          
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Remaining-Credits': String(user.credits - 1),
        'Cache-Control': 'no-cache, no-transform',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

function getAllowedModels(tier: string): string[] {
  const base = ['gpt-4o-mini'];
  if (tier === 'pro' || tier === 'ultra') base.push('gpt-4o');
  if (tier === 'ultra') base.push('claude-3-sonnet', 'gpt-4-turbo');
  return base;
}