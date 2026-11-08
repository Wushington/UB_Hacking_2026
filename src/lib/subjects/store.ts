import "server-only";
import { and, asc, eq, gt, lt, max, desc } from "drizzle-orm";
import type { Divider, UpdateDivider } from "@/contracts/dividers";
import { getDb, schema } from "@/db";
import { ensureUser } from "@/lib/users";

// In code a subject is a "category".
const { categories, subjectDividers } = schema;

export type SubjectRow = { id: string; name: string; dividerId: string | null };

/** All of the user's subjects (including ones with no notes yet), alphabetical. */
export async function listSubjects(userId: string): Promise<SubjectRow[]> {
  return getDb()
    .select({ id: categories.id, name: categories.name, dividerId: categories.dividerId })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.normalizedName));
}

export async function listDividers(userId: string): Promise<Divider[]> {
  return getDb()
    .select({ id: subjectDividers.id, name: subjectDividers.name, position: subjectDividers.position, collapsed: subjectDividers.collapsed })
    .from(subjectDividers)
    .where(eq(subjectDividers.userId, userId))
    .orderBy(asc(subjectDividers.position), asc(subjectDividers.createdAt));
}

/** Adds a divider at the end. */
export async function createDivider(userId: string, name: string): Promise<Divider> {
  const db = getDb();
  await ensureUser(userId);
  return db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(subjectDividers.position) }).from(subjectDividers).where(eq(subjectDividers.userId, userId));
    const [row] = await tx
      .insert(subjectDividers)
      .values({ userId, name, position: (last ?? -1) + 1 })
      .returning({ id: subjectDividers.id, name: subjectDividers.name, position: subjectDividers.position, collapsed: subjectDividers.collapsed });
    return row;
  });
}

/** Renames, collapses/expands, or swaps a divider with its neighbour. False if it isn't the user's. */
export async function updateDivider(userId: string, id: string, change: UpdateDivider): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const owned = and(eq(subjectDividers.id, id), eq(subjectDividers.userId, userId));
    const [divider] = await tx.select({ position: subjectDividers.position }).from(subjectDividers).where(owned).for("update");
    if (!divider) return false;

    const fields: Partial<{ name: string; collapsed: boolean }> = {};
    if (change.name !== undefined) fields.name = change.name;
    if (change.collapsed !== undefined) fields.collapsed = change.collapsed;
    if (Object.keys(fields).length) await tx.update(subjectDividers).set(fields).where(owned);

    if (change.move) {
      const up = change.move === "up";
      const [neighbour] = await tx
        .select({ id: subjectDividers.id, position: subjectDividers.position })
        .from(subjectDividers)
        .where(and(eq(subjectDividers.userId, userId), up ? lt(subjectDividers.position, divider.position) : gt(subjectDividers.position, divider.position)))
        .orderBy(up ? desc(subjectDividers.position) : asc(subjectDividers.position))
        .limit(1);
      if (neighbour) {
        await tx.update(subjectDividers).set({ position: neighbour.position }).where(owned);
        await tx.update(subjectDividers).set({ position: divider.position }).where(eq(subjectDividers.id, neighbour.id));
      }
    }
    return true;
  });
}

/** Deletes a divider; its subjects move back above the dividers (the FK sets their divider to null). */
export async function deleteDivider(userId: string, id: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(subjectDividers)
    .where(and(eq(subjectDividers.id, id), eq(subjectDividers.userId, userId)))
    .returning({ id: subjectDividers.id });
  return deleted.length > 0;
}

/** Puts a subject under one of the user's dividers, or back above them (null). */
export async function moveSubject(userId: string, subjectId: string, dividerId: string | null): Promise<"ok" | "subject-not-found" | "divider-not-found"> {
  const db = getDb();
  if (dividerId) {
    const [divider] = await db
      .select({ id: subjectDividers.id })
      .from(subjectDividers)
      .where(and(eq(subjectDividers.id, dividerId), eq(subjectDividers.userId, userId)));
    if (!divider) return "divider-not-found";
  }
  const updated = await db
    .update(categories)
    .set({ dividerId })
    .where(and(eq(categories.id, subjectId), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  return updated.length ? "ok" : "subject-not-found";
}
