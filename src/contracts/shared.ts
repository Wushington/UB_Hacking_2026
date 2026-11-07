import { z } from "zod";

/** True when every value is distinct. */
export const isUnique = <T>(values: T[]) => new Set(values).size === values.length;

export const nonEmptyText = z.string().trim().min(1);
