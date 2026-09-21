/* Production bootstrap: creates a school (tenant), its current academic year and the first admin account.
   Never touches existing data and adds no demo records. Run once per school:

   SCHOOL_SLUG=my-school SCHOOL_NAME="My School" ADMIN_EMAIL=principal@myschool.in ADMIN_PASSWORD='strong-password' npm run db:init */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const slug = process.env.SCHOOL_SLUG ?? "swan-school";
  const name = process.env.SCHOOL_NAME ?? "SwanSchoolERP";
  if (!email || !password || password.length < 8) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 characters) before running db:init.");

  const school = await db.school.upsert({ where: { slug }, update: {}, create: { slug, name } });
  const year = new Date().getUTCFullYear();
  const yearName = `${year}-${year + 1}`;
  await db.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: yearName } }, update: {},
    create: { schoolId: school.id, name: yearName, startDate: new Date(`${year}-06-01`), endDate: new Date(`${year + 1}-03-31`), isCurrent: true },
  });
  if (await db.user.findUnique({ where: { email } })) return console.log(`Admin ${email} already exists — nothing changed.`);
  await db.user.create({ data: { schoolId: school.id, email, name: "School Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) } });
  console.log(`School "${name}" (${slug}) ready. Admin: ${email}. Sign in and change the password from My Profile.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
