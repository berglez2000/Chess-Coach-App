/** Never let an undefined Prisma filter turn a private query into a global one. */
export function requireOwnerId(ownerId: string): string {
  if (typeof ownerId !== "string" || !ownerId.trim()) throw new Error("A user ID is required.");
  return ownerId;
}
