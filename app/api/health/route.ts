import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  return NextResponse.json({
    status: 'ok',
    received: body
  })
}
