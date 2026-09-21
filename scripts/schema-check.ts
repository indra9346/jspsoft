/* Database review: every school-owned table has school_id, a foreign key to "School", and an index that leads with it.
   npm run test:schema */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const db = new PrismaClient();
let fails = 0;
const check = (ok: boolean, label: string) => { if (!ok) fails++; console.log(`${ok ? "  ok  " : " FAIL "} ${label}`); };

async function main() {
  const tables = await db.$queryRaw<{ t: string }[]>`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations' ORDER BY 1`;
  const names = tables.map((x) => x.t);
  console.log(`Tables (${names.length}): ${names.join(", ")}\n`);
  for (const t of names.filter((n) => n !== "School")) {
    const col = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*) c FROM information_schema.columns WHERE table_name='${t}' AND column_name='schoolId'`);
    const hasCol = Number(col[0].c) === 1;
    const fk = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*) c FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage k USING (constraint_name, table_schema) WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='${t}' AND k.column_name='schoolId'`);
    const idx = await db.$queryRawUnsafe<{ c: bigint }[]>(`SELECT count(*) c FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=i.indkey[0] WHERE c.relname='${t}' AND a.attname='schoolId'`);
    check(hasCol && Number(fk[0].c) >= 1 && Number(idx[0].c) >= 1, `${t}: school_id column + FK + leading index`);
  }
  const ts = await db.$queryRaw<{ t: string }[]>`SELECT table_name AS t FROM information_schema.columns WHERE table_schema='public' AND column_name='createdAt' GROUP BY 1`;
  console.log(`\nTables with createdAt: ${ts.length}`);
  const dupe = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM (SELECT "schoolId","admissionNo" FROM "Student" GROUP BY 1,2 HAVING count(*)>1) x`;
  check(Number(dupe[0].n) === 0, "no duplicate admission numbers within a school");
  const orphan = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "Student" s JOIN "ClassRoom" c ON c.id=s."classId" WHERE c."schoolId" <> s."schoolId"`;
  check(Number(orphan[0].n) === 0, "no student points at another school's class");
  const orphan2 = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "Mark" m JOIN "Student" s ON s.id=m."studentId" WHERE s."schoolId" <> m."schoolId"`;
  check(Number(orphan2[0].n) === 0, "no mark points at another school's student");
  const orphan3 = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM "Allocation" a JOIN "Staff" s ON s.id=a."teacherId" JOIN "ClassRoom" c ON c.id=a."classId" WHERE s."schoolId" <> a."schoolId" OR c."schoolId" <> a."schoolId"`;
  check(Number(orphan3[0].n) === 0, "no allocation crosses schools");
  console.log(fails ? `\n${fails} FAILURES` : "\nSchema review OK");
  await db.$disconnect();
  process.exit(fails ? 1 : 0);
}
main();
