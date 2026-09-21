/* For Swan Digital Solutions staff: unlock / lock add-on features per school, and manage unlock requests.

   npx tsx scripts/feature.ts unlock <school-slug> <feature>     e.g.  unlock swan-school parent_portal
   npx tsx scripts/feature.ts lock   <school-slug> <feature>
   npx tsx scripts/feature.ts list   <school-slug>               shows unlocked features + open requests
   npx tsx scripts/feature.ts request <request-id> CONTACTED|APPROVED|REJECTED */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const KEYS = ["fees", "payments", "receipts", "parent_portal", "non_teaching_staff", "advanced_transport", "gps", "notifications", "biometric", "payroll", "library", "inventory", "hostel", "custom_integrations"];
const db = new PrismaClient();

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "request") {
    if (!a || !["CONTACTED", "APPROVED", "REJECTED", "PENDING"].includes(b)) throw new Error("Usage: request <id> CONTACTED|APPROVED|REJECTED");
    await db.featureUnlockRequest.update({ where: { id: a }, data: { status: b as "CONTACTED" } });
    return console.log(`Request ${a} → ${b}`);
  }
  const school = await db.school.findUnique({ where: { slug: a ?? "" } });
  if (!school) throw new Error("School not found. Usage: <unlock|lock|list> <school-slug> [feature]");
  if (cmd === "list") {
    const on = await db.schoolFeature.findMany({ where: { schoolId: school.id, enabled: true } });
    console.log("Unlocked:", on.map((f) => f.featureKey).join(", ") || "(none — Default Package)");
    for (const r of await db.featureUnlockRequest.findMany({ where: { schoolId: school.id }, orderBy: { createdAt: "desc" } }))
      console.log(`  [${r.status}] ${r.requestedFeature} · ${r.administratorName} · ${r.email} · ${r.phone} · id=${r.id}`);
    return;
  }
  if (!KEYS.includes(b)) throw new Error(`Unknown feature. Valid: ${KEYS.join(", ")}`);
  if (cmd === "unlock") {
    await db.schoolFeature.upsert({ where: { schoolId_featureKey: { schoolId: school.id, featureKey: b } }, update: { enabled: true }, create: { schoolId: school.id, featureKey: b } });
    await db.featureUnlockRequest.updateMany({ where: { schoolId: school.id, requestedFeature: b, status: { in: ["PENDING", "CONTACTED"] } }, data: { status: "APPROVED" } });
    console.log(`Unlocked ${b} for ${school.name}`);
  } else if (cmd === "lock") {
    await db.schoolFeature.updateMany({ where: { schoolId: school.id, featureKey: b }, data: { enabled: false } });
    console.log(`Locked ${b} for ${school.name}`);
  } else throw new Error("Commands: unlock | lock | list | request");
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
