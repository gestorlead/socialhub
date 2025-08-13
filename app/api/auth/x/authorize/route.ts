import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sha256(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

function hmac(data: string, secret: string) {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest())
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      client_id,
      redirect_uri,
      scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'],
      user_id,
      client_type = 'public'
    } = body || {}

    if (!client_id || !redirect_uri || !user_id) {
      return NextResponse.json({ error: 'client_id, redirect_uri e user_id são obrigatórios' }, { status: 400 })
    }

    // PKCE
    const code_verifier = base64url(crypto.randomBytes(64))
    const code_challenge = base64url(sha256(Buffer.from(code_verifier)))

    // State assinado (inclui client_id e redirect_uri para callback)
    const statePayload = {
      u: user_id,
      v: code_verifier,
      c: client_id,
      r: redirect_uri,
      t: Date.now()
    }
    const stateRaw = base64url(Buffer.from(JSON.stringify(statePayload)))
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const signature = secret ? hmac(stateRaw, secret) : ''
    const state = signature ? `${stateRaw}.${signature}` : stateRaw

    const scopeParam = encodeURIComponent(scopes.join(' '))
    const authorizeUrl = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(
      client_id
    )}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=${scopeParam}&state=${encodeURIComponent(
      state
    )}&code_challenge=${encodeURIComponent(code_challenge)}&code_challenge_method=S256`

    return NextResponse.json({ success: true, authorize_url: authorizeUrl })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate authorize URL' }, { status: 500 })
  }
}

