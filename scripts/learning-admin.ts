import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const [command, email, materialId, ...extra] = process.argv.slice(2);
  if (command !== "share" || !email?.includes("@") || !materialId || extra.length) throw new Error("Usage: npm run learning:admin -- share owner@example.com material-id");
  const { getDb } = await import("../lib/db/client"); const db = getDb();
  try {
    const owner = await db.user.findUnique({ where: { email } });
    const material = owner && await db.learningMaterial.findFirst({ where: { id: materialId, ownerId: owner.id, archived: false }, include: { chapters: { include: { exercises: true } } } });
    if (!material) throw new Error("No active material belongs to the selected account.");
    if (!material.chapters.some(c => !c.archived && c.exercises.some(e => !e.archived && e.publishedId))) throw new Error("Publish at least one exercise before sharing curated material.");
    // CLI access is the explicit operator boundary; no browser/API user can set shared.
    await db.learningMaterial.update({ where: { id: material.id }, data: { shared: true, revision: { increment: 1 } } });
    console.log("Material shared as read-only curated content. Learner progress remains private; source PDFs remain owner-only.");
  } finally { await db.$disconnect(); }
}
main().catch(error => {
  const known = ["Usage:", "No active material", "Publish at least"];
  console.error(error instanceof Error && known.some(prefix => error.message.startsWith(prefix)) ? error.message : "Learning maintenance failed. Check PostgreSQL and migrations.");
  process.exitCode = 1;
});
