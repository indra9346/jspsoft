import "server-only";
import { cache } from "react";
import { db, rawDb } from "@/lib/db";
import { readSession } from "@/lib/tenant";

/** Branding/settings of the current school (session school, or the default school on the login page). */
export const getSchool = cache(async () => {
  try {
    const s = await readSession();
    const school = s
      ? await rawDb.school.findUnique({ where: { id: s.sid } })
      : await rawDb.school.findFirst({
          where: process.env.DEFAULT_SCHOOL_SLUG ? { slug: process.env.DEFAULT_SCHOOL_SLUG } : undefined,
          orderBy: { createdAt: "asc" },
        });
    if (school) return school;
  } catch (err) {
    console.error("getSchool lookup fallback:", err);
  }
  return {
    id: "",
    slug: "js-public-school",
    name: "J S Public Pre Primary School",
    tagline: "Nurturing Young Minds for a Brighter Tomorrow",
    primaryColor: "#0284c7",
    secondaryColor: "#10b929ff",
    logoData: null as string | null,
    signatureData: null as string | null,
    address: "Gollahalli, Gauribidanur Main Road, Doddaballapura – 561203",
    phone: "7975135781, 9187678257",
    email: "jspublicschool.edu@gmail.com",
    website: "https://jspublicschool.edu.in",
    principalName: "Headmistress Smt. Lakshmi Devi",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
});

/** The academic year marked as current for the signed-in school. */
export const getCurrentYear = cache(async () => {
  try {
    return (await db.academicYear.findFirst({ where: { isCurrent: true } })) ?? (await db.academicYear.findFirst({ orderBy: { startDate: "desc" } }));
  } catch {
    return null;
  }
});
