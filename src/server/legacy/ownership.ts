import { eq, isNull } from 'drizzle-orm';
import * as s from '../../db/schema';
import type { AppContext } from '../env';
import { db } from '../middleware/auth';

const clean = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

/**
 * Claims any historical identity whose configured currentNick matches one of
 * this member's current site/Discord names. Safe to call on every login/profile
 * update; already-owned rows are untouched.
 */
export async function claimLegacyIdentities(
  env: AppContext['Bindings'],
  userId: number,
  names: Array<string | null | undefined>,
): Promise<number> {
  const keys = new Set(names.map(clean).filter((v): v is string => !!v));
  if (!keys.size) return 0;

  const database = db(env);
  const rows = await database
    .select({ id: s.legacyMembers.id, currentNick: s.legacyMembers.currentNick })
    .from(s.legacyMembers)
    .where(isNull(s.legacyMembers.ownerUserId));

  let claimed = 0;
  for (const row of rows) {
    if (!row.currentNick || !keys.has(row.currentNick.trim().toLowerCase())) continue;
    const result = await database
      .update(s.legacyMembers)
      .set({ ownerUserId: userId, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(s.legacyMembers.id, row.id))
      .returning({ id: s.legacyMembers.id });
    claimed += result.length;
  }
  return claimed;
}
