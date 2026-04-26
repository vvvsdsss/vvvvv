export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyToken } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    const payload = token ? await verifyToken(token) : null;
    if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID_PRO!,
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_URL}/?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/?canceled=1`,
      client_reference_id: payload.userId,
      metadata: { userId: payload.userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: '支付初始化失败' }, { status: 500 });
  }
}