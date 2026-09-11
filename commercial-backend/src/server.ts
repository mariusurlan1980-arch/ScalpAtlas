import express, { type NextFunction, type Request, type Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 8080);
const DATABASE_URL = process.env.DATABASE_URL || '';
const AUTH_INTROSPECTION_URL = (process.env.AUTH_INTROSPECTION_URL || '').trim();
const STORE_VERIFIER_URL = (process.env.STORE_VERIFIER_URL || '').trim();
const DEV_USER_ID = (process.env.DEV_USER_ID || '').trim();

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL este obligatoriu.');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.use(express.json({ limit: '512kb' }));

type AuthenticatedRequest = Request & { scalpUserId?: string };

async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

  if (!token && process.env.NODE_ENV !== 'production' && DEV_USER_ID) {
    req.scalpUserId = DEV_USER_ID;
    next();
    return;
  }

  if (!token || !AUTH_INTROSPECTION_URL) {
    res.status(401).json({ error: 'authentication_required' });
    return;
  }

  try {
    const response = await fetch(AUTH_INTROSPECTION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    const payload = await response.json() as { userId?: unknown; active?: unknown };
    if (payload.active === false || typeof payload.userId !== 'string' || !payload.userId) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    req.scalpUserId = payload.userId;
    next();
  } catch {
    res.status(503).json({ error: 'authentication_unavailable' });
  }
}

async function ensureUser(userId: string) {
  await pool.query('INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING', [userId]);
  await pool.query(
    `INSERT INTO access_state(user_id) VALUES($1)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId]
  );
}

function accessPayload(row: {
  free_analyses_used: number;
  subscription_active: boolean;
  subscription_product_id: string | null;
  subscription_expires_at: Date | null;
}) {
  const activeByDate = !row.subscription_expires_at || row.subscription_expires_at.getTime() > Date.now();
  const subscriptionActive = row.subscription_active && activeByDate;
  return {
    freeAnalysesUsed: row.free_analyses_used,
    freeAnalysesRemaining: Math.max(0, 5 - row.free_analyses_used),
    subscriptionActive,
    subscriptionProductId: row.subscription_product_id,
    subscriptionExpiresAt: row.subscription_expires_at?.toISOString() || null,
    canAnalyze: subscriptionActive || row.free_analyses_used < 5,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'scalp-atlas-commercial-backend' });
});

app.get('/v1/access', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.scalpUserId!;
    await ensureUser(userId);
    const result = await pool.query(
      `SELECT free_analyses_used, subscription_active, subscription_product_id, subscription_expires_at
       FROM access_state WHERE user_id=$1`,
      [userId]
    );
    res.json(accessPayload(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'access_state_failed' });
  }
});

const completedAnalysisSchema = z.object({
  clientAnalysisId: z.string().min(8).max(128),
});

app.post('/v1/analyses/complete', authenticate, async (req: AuthenticatedRequest, res) => {
  const parsed = completedAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const userId = req.scalpUserId!;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING', [userId]);
    await client.query(
      'INSERT INTO access_state(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',
      [userId]
    );

    const accessResult = await client.query(
      `SELECT free_analyses_used, subscription_active, subscription_product_id, subscription_expires_at
       FROM access_state WHERE user_id=$1 FOR UPDATE`,
      [userId]
    );
    const access = accessResult.rows[0];
    const current = accessPayload(access);

    const existing = await client.query(
      'SELECT id FROM completed_analyses WHERE user_id=$1 AND client_analysis_id=$2',
      [userId, parsed.data.clientAnalysisId]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      res.json({ ...current, duplicate: true });
      return;
    }

    if (!current.canAnalyze) {
      await client.query('ROLLBACK');
      res.status(402).json({ error: 'subscription_required', ...current });
      return;
    }

    await client.query(
      `INSERT INTO completed_analyses(user_id, client_analysis_id) VALUES($1,$2)`,
      [userId, parsed.data.clientAnalysisId]
    );

    if (!current.subscriptionActive) {
      await client.query(
        `UPDATE access_state
         SET free_analyses_used=LEAST(5, free_analyses_used+1), updated_at=now()
         WHERE user_id=$1`,
        [userId]
      );
    }

    const updatedResult = await client.query(
      `SELECT free_analyses_used, subscription_active, subscription_product_id, subscription_expires_at
       FROM access_state WHERE user_id=$1`,
      [userId]
    );
    await client.query('COMMIT');
    res.json({ ...accessPayload(updatedResult.rows[0]), duplicate: false });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(error);
    res.status(500).json({ error: 'analysis_completion_failed' });
  } finally {
    client.release();
  }
});

const subscriptionVerifySchema = z.object({
  platform: z.enum(['android', 'ios']),
  packageId: z.literal('com.scalpatlas.app'),
  productId: z.enum([
    'com.scalpatlas.app.premium.monthly',
    'com.scalpatlas.app.premium.annual',
  ]),
  purchase: z.unknown(),
});

app.post('/v1/subscriptions/verify', authenticate, async (req: AuthenticatedRequest, res) => {
  const parsed = subscriptionVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  if (!STORE_VERIFIER_URL) {
    res.status(503).json({ error: 'store_verifier_not_configured' });
    return;
  }

  try {
    const verifyResponse = await fetch(STORE_VERIFIER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    if (!verifyResponse.ok) {
      res.status(502).json({ error: 'store_verification_failed' });
      return;
    }

    const verified = await verifyResponse.json() as {
      active?: unknown;
      productId?: unknown;
      transactionId?: unknown;
      expiresAt?: unknown;
      rawStatus?: unknown;
    };
    if (
      verified.active !== true ||
      typeof verified.productId !== 'string' ||
      typeof verified.transactionId !== 'string'
    ) {
      res.json({ subscriptionActive: false, productId: null, expiresAt: null });
      return;
    }

    const userId = req.scalpUserId!;
    await ensureUser(userId);
    const expiresAt = typeof verified.expiresAt === 'string' ? verified.expiresAt : null;

    await pool.query(
      `INSERT INTO store_purchases(user_id, platform, product_id, store_transaction_id, expires_at, active, raw_status)
       VALUES($1,$2,$3,$4,$5,TRUE,$6)
       ON CONFLICT(platform, store_transaction_id)
       DO UPDATE SET product_id=EXCLUDED.product_id, expires_at=EXCLUDED.expires_at,
                     active=TRUE, raw_status=EXCLUDED.raw_status, updated_at=now()`,
      [userId, parsed.data.platform, verified.productId, verified.transactionId, expiresAt, verified.rawStatus || null]
    );

    await pool.query(
      `UPDATE access_state
       SET subscription_active=TRUE, subscription_product_id=$2,
           subscription_expires_at=$3, updated_at=now()
       WHERE user_id=$1`,
      [userId, verified.productId, expiresAt]
    );

    res.json({
      subscriptionActive: true,
      productId: verified.productId,
      expiresAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'subscription_verification_failed' });
  }
});

app.listen(PORT, () => {
  console.log(`SCALP ATLAS commercial backend listening on :${PORT}`);
});
