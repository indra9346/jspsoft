import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { toDate, todayISO } from "@/lib/utils";

/** Class-sections a teacher is responsible for (class teacher or allocated subject teacher). */
export async function teacherClassIds(staffId: string): Promise<string[]> {
  const [own, alloc] = await Promise.all([
    db.classRoom.findMany({ where: { classTeacherId: staffId }, select: { id: true } }),
    db.allocation.findMany({ where: { teacherId: staffId }, select: { classId: true } }),
  ]);
  return [...new Set([...own.map((c) => c.id), ...alloc.map((a) => a.classId)])];
}

/** Class-sections the user can work with: admin all, teacher assigned, student own. */
export async function visibleClasses(user: SessionUser) {
  const orderBy = [{ grade: "asc" as const }, { section: "asc" as const }];
  if (user.role === "ADMIN") return db.classRoom.findMany({ orderBy, where: await currentYearFilter() });
  if (user.role === "TEACHER" && user.staff) {
    const ids = await teacherClassIds(user.staff.id);
    return db.classRoom.findMany({ where: { id: { in: ids } }, orderBy });
  }
  if (user.role === "STUDENT" && user.student) return db.classRoom.findMany({ where: { id: user.student.classId } });
  return [];
}

async function currentYearFilter(): Promise<Prisma.ClassRoomWhereInput> {
  const y = await db.academicYear.findFirst({ where: { isCurrent: true } });
  return y ? { academicYearId: y.id } : {};
}

/**
 * Single authority for "may this user see this student's private data?"
 * Admin: any student of the school. Teacher: students of assigned sections only.
 * Student: only themselves. Everything else: no. (Cross-school ids are already invisible via the scoped client.)
 */
export async function canViewStudent(user: SessionUser, studentId: string): Promise<boolean> {
  if (user.role === "STUDENT") return user.student?.id === studentId;
  const s = await db.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!s) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER" && user.staff) return (await teacherClassIds(user.staff.id)).includes(s.classId);
  return false;
}

export async function announcementWhere(user: SessionUser): Promise<Prisma.AnnouncementWhereInput> {
  if (user.role === "ADMIN") return {};
  const today = toDate(todayISO());
  const live: Prisma.AnnouncementWhereInput = { publishDate: { lte: today }, OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] };
  const audience = async (): Promise<Prisma.AnnouncementWhereInput[]> => {
    if (user.role === "TEACHER" && user.staff) {
      const ids = await teacherClassIds(user.staff.id);
      return [
        { audience: { in: ["ALL", "TEACHERS", "STAFF"] } },
        { audience: { in: ["CLASSES", "SECTIONS"] }, targets: { some: { classId: { in: ids } } } },
        { authorId: user.id },
      ];
    }
    if (user.role === "STUDENT" && user.student) {
      return [
        { audience: { in: ["ALL", "STUDENTS"] } },
        { audience: { in: ["CLASSES", "SECTIONS"] }, targets: { some: { classId: user.student.classId } } },
      ];
    }
    return [{ id: "none" }];
  };
  return { AND: [live, { OR: await audience() }] };
}
