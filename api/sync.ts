/**
 * The library shared between devices (Vercel Function + Neon Postgres).
 *
 *   GET  /api/sync?since=<rev>   → { rows: Row[], rev, more }   rows changed after `since`
 *   POST /api/sync { pieces }    → { rev }                       newer pieces win (by `updated`)
 *
 * Every request carries `Authorization: Bearer <sync code>`; the one code is the project's
 * SYNC_KEY. A piece is stored whole (the app's SavedPiece JSON); a deleted one stays as a
 * tombstone (`deleted`, no piece) so every device hears about it. `rev` comes from a sequence and
 * is bumped on every accepted write, so a device asks only for what changed since it last looked.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

interface Incoming {
  id: string;
  name: string;
  updated: number;
  deleted: boolean;
  piece: unknown;
}

const PAGE = 200;
const MAX_PIECES = 100;
const MAX_PIECE_BYTES = 512 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const digest = (s: string) => createHash('sha256').update(s).digest();
/** Codes are typed by hand: case, spaces and dashes do not matter. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function authorized(req: Request): boolean {
  const key = process.env.SYNC_KEY;
  if (!key) return false;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return timingSafeEqual(digest(norm(given)), digest(norm(key)));
}

function db() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return url ? neon(url) : undefined;
}

let ready: Promise<unknown> | undefined;
/** The table, made on first use (once per instance). */
function setup(sql: NonNullable<ReturnType<typeof db>>) {
  ready ??= (async () => {
    await sql`create sequence if not exists piece_rev`;
    await sql`create table if not exists pieces (
      id text primary key,
      name text not null default '',
      updated bigint not null,
      deleted boolean not null default false,
      piece jsonb,
      rev bigint not null default nextval('piece_rev')
    )`;
    await sql`create index if not exists pieces_rev on pieces (rev)`;
  })().catch((e: unknown) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

function valid(p: unknown): p is Incoming {
  const x = p as Partial<Incoming> | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    /^[\w-]{1,200}$/.test(x.id) &&
    typeof x.updated === 'number' &&
    Number.isFinite(x.updated) &&
    typeof x.deleted === 'boolean' &&
    (x.deleted || (typeof x.piece === 'object' && x.piece !== null)) &&
    JSON.stringify(x.piece ?? null).length <= MAX_PIECE_BYTES
  );
}

async function guard(req: Request) {
  if (!authorized(req))
    return { error: json({ error: process.env.SYNC_KEY ? 'bad-code' : 'not-set-up' }, 401) };
  const sql = db();
  if (!sql) return { error: json({ error: 'not-set-up' }, 503) };
  await setup(sql);
  return { sql };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { sql, error } = await guard(req);
    if (error) return error;
    const since = Math.max(0, Number(new URL(req.url).searchParams.get('since')) || 0);
    const rows = (await sql`
      select id, name, updated, deleted, piece, rev from pieces
      where rev > ${since} order by rev limit ${PAGE + 1}`) as Record<string, unknown>[];
    const more = rows.length > PAGE;
    const page = rows.slice(0, PAGE).map((r) => ({
      id: r.id,
      name: r.name,
      updated: Number(r.updated),
      deleted: r.deleted,
      piece: r.piece,
      rev: Number(r.rev),
    }));
    const [top] = (await sql`select coalesce(max(rev), 0) as rev from pieces`) as { rev: string }[];
    return json({
      rows: page,
      rev: more ? page[page.length - 1]!.rev : Number(top?.rev ?? 0),
      more,
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'server' }, 500);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { sql, error } = await guard(req);
    if (error) return error;
    const body = (await req.json().catch(() => null)) as { pieces?: unknown[] } | null;
    const pieces = Array.isArray(body?.pieces) ? body.pieces : null;
    if (!pieces || pieces.length > MAX_PIECES || !pieces.every(valid))
      return json({ error: 'bad-request' }, 400);
    if (pieces.length) {
      const rows = pieces.map((p) => ({
        id: p.id,
        name: String(p.name ?? '').slice(0, 200),
        updated: Math.round(p.updated),
        deleted: p.deleted,
        piece: p.deleted ? null : p.piece,
      }));
      // the newer edit wins; an older one (or the same one sent again) changes nothing
      await sql`
        insert into pieces (id, name, updated, deleted, piece)
        select id, name, updated, deleted, piece
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          as x(id text, name text, updated bigint, deleted boolean, piece jsonb)
        on conflict (id) do update set
          name = excluded.name, updated = excluded.updated, deleted = excluded.deleted,
          piece = excluded.piece, rev = nextval('piece_rev')
        where pieces.updated < excluded.updated`;
    }
    const [top] = (await sql`select coalesce(max(rev), 0) as rev from pieces`) as { rev: string }[];
    return json({ rev: Number(top?.rev ?? 0) });
  } catch (e) {
    console.error(e);
    return json({ error: 'server' }, 500);
  }
}
