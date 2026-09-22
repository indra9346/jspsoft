/* AWS RDS PostgreSQL automated deployment & initialization script for J S Public Pre-Primary & School
   Usage:
     DATABASE_URL="postgresql://USER:PASS@YOUR-RDS-HOST.ap-south-1.rds.amazonaws.com:5432/DATABASE?sslmode=require" npm run db:deploy:aws
*/
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ Error: DATABASE_URL is not defined in your environment or .env file.");
    process.exit(1);
  }

  console.log("🚀 Step 1/3: Pushing Prisma database schema to AWS RDS PostgreSQL...");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env: process.env });

  console.log("\n🌱 Step 2/3: Seeding J S Public Pre Primary School & academic records...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });

  console.log("\n🔍 Step 3/3: Verifying AWS database connection...");
  const db = new PrismaClient();
  try {
    const schoolCount = await db.school.count();
    const userCount = await db.user.count();
    const studentCount = await db.student.count();
    const jsSchool = await db.school.findUnique({ where: { slug: "js-public-school" } });

    console.log("\n✅ AWS RDS Deployment & Setup Successful!");
    console.log("--------------------------------------------------");
    console.log(`🏫 Primary Flagship School: ${jsSchool?.name || "J S Public Pre Primary School"}`);
    console.log(`📊 Total Schools in DB:     ${schoolCount}`);
    console.log(`👥 Total Users:              ${userCount}`);
    console.log(`🎒 Total Students:           ${studentCount}`);
    console.log("--------------------------------------------------");
    console.log("🔑 Default Login Credentials for J S Public School:");
    console.log("   Admin:   admin@jspublicschool.edu    / Swan@123");
    console.log("   Teacher: teacher1@jspublicschool.edu / Swan@123");
    console.log("   Student: student1@jspublicschool.edu / Swan@123");
    console.log("--------------------------------------------------");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err.message);
  process.exit(1);
});
