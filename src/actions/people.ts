"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { syncStudentSubjects } from "@/lib/enrollment";
import { toDate } from "@/lib/utils";

const DEFAULT_PASSWORD = "Swan@123";
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const email = z.string().email("Enter a valid email address").transform((s) => s.toLowerCase());
const phone = z.string().min(7, "Enter a valid phone number").max(20);
const MAX_PHOTO = 250 * 1024;

async function readPhoto(fd: FormData): Promise<string | undefined> {
  const f = fd.get("photo");
  if (!(f instanceof File) || f.size === 0) return undefined;
  if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) throw new UserError("Photo must be a PNG, JPG or WebP image.");
  if (f.size > MAX_PHOTO) throw new UserError("Photo must be smaller than 250 KB.");
  return `data:${f.type};base64,${Buffer.from(await f.arrayBuffer()).toString("base64")}`;
}

/* ------------------------------------------------------------- students */
const studentSchema = z.object({
  name: z.string().min(2, "Enter the student's name"),
  email,
  phone: phone.optional().or(z.literal("")),
  password: z.string().optional(),
  classId: z.string().min(1, "Choose a class and section"),
  academicYearId: z.string().min(1, "Choose an academic year"),
  rollNo: z.coerce.number().int().min(1, "Enter a roll number"),
  admissionNo: z.string().min(2, "Enter an admission number"),
  admissionDate: dateStr,
  gender: z.enum(["M", "F"], { message: "Choose gender" }),
  dob: dateStr,
  guardianName: z.string().min(2, "Enter the guardian's name"),
  guardianPhone: phone,
  address: z.string().default(""),
  bloodGroup: z.string().optional(),
  busId: z.string().optional(),
  busStopId: z.string().optional(),
});

export async function saveStudentAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await requireActionUser(["ADMIN"], "students");
    const d = parse(studentSchema, fd);
    const photoData = await readPhoto(fd);

    const [cls, year] = await Promise.all([db.classRoom.findUnique({ where: { id: d.classId } }), db.academicYear.findUnique({ where: { id: d.academicYearId } })]);
    if (!cls || !year) throw new UserError("Class or academic year not found.");
    if (cls.academicYearId !== year.id) throw new UserError(`That class belongs to a different academic year. Choose the class of ${year.name}, or change the academic year.`);

    let busId: string | null = null;
    let busStopId: string | null = null;
    if (d.busId) {
      const bus = await db.bus.findUnique({ where: { id: d.busId }, include: { stops: true, _count: { select: { students: true } } } });
      if (!bus) throw new UserError("Bus not found.");
      const already = id ? await db.student.count({ where: { id, busId: bus.id } }) : 0;
      if (!already && bus._count.students >= bus.capacity) throw new UserError(`Bus ${bus.busNumber} is full (capacity ${bus.capacity}).`);
      if (d.busStopId && !bus.stops.some((s) => s.id === d.busStopId)) throw new UserError("That stop does not belong to the selected bus.");
      busId = bus.id;
      busStopId = d.busStopId || null;
    }

    const profile = {
      classId: d.classId, academicYearId: d.academicYearId, rollNo: d.rollNo, admissionNo: d.admissionNo,
      admissionDate: toDate(d.admissionDate), gender: d.gender, dob: toDate(d.dob), guardianName: d.guardianName,
      guardianPhone: d.guardianPhone, address: d.address, bloodGroup: d.bloodGroup || null, busId, busStopId,
      ...(photoData ? { photoData } : {}),
    };

    let studentId = id;
    if (id) {
      const s = await db.student.findUnique({ where: { id } });
      if (!s) throw new UserError("Student not found.");
      await db.user.update({ where: { id: s.userId }, data: { name: d.name, email: d.email, phone: d.phone || null } });
      await db.student.update({ where: { id }, data: profile });
    } else {
      const u = await db.user.create({
        data: {
          schoolId: admin.schoolId, name: d.name, email: d.email, phone: d.phone || null, role: "STUDENT",
          passwordHash: await bcrypt.hash(d.password || DEFAULT_PASSWORD, 10),
          student: { create: { schoolId: admin.schoolId, ...profile } },
        },
        include: { student: true },
      });
      studentId = u.student!.id;
    }
    await syncStudentSubjects(studentId!, d.classId, admin.schoolId);
    revalidatePath("/students");
    revalidatePath("/classes");
    return ok(id ? "Student updated." : `Student added. Login password: ${d.password || DEFAULT_PASSWORD}`);
  });
}

export async function deleteStudentAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "students");
    const s = await db.student.findUnique({ where: { id } });
    if (!s) throw new UserError("Student not found.");
    await db.user.delete({ where: { id: s.userId } });
    revalidatePath("/students");
    return ok("Student removed.");
  });
}

/* ------------------------------------------------- teaching staff */
const staffSchema = z.object({
  name: z.string().min(2, "Enter the staff member's name"),
  email,
  password: z.string().optional(),
  phone,
  employeeId: z.string().min(2, "Enter an employee ID"),
  designation: z.string().min(2, "Enter a designation"),
  department: z.string().optional(),
  qualification: z.string().optional(),
  gender: z.enum(["M", "F"], { message: "Choose gender" }),
  joinDate: dateStr,
});

export async function saveStaffAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await requireActionUser(["ADMIN"], "staff");
    const d = parse(staffSchema, fd);
    const profile = {
      employeeId: d.employeeId, designation: d.designation, department: d.department || null,
      qualification: d.qualification || null, gender: d.gender, joinDate: toDate(d.joinDate),
    };
    if (id) {
      const s = await db.staff.findUnique({ where: { id } });
      if (!s) throw new UserError("Staff member not found.");
      await db.user.update({ where: { id: s.userId }, data: { name: d.name, email: d.email, phone: d.phone } });
      await db.staff.update({ where: { id }, data: profile });
    } else {
      // Teaching staff only. Non-teaching staff is the locked "non_teaching_staff" add-on.
      await db.user.create({
        data: {
          schoolId: admin.schoolId, name: d.name, email: d.email, phone: d.phone, role: "TEACHER",
          passwordHash: await bcrypt.hash(d.password || DEFAULT_PASSWORD, 10),
          staff: { create: { schoolId: admin.schoolId, staffType: "TEACHING", ...profile } },
        },
      });
    }
    revalidatePath("/staff");
    return ok(id ? "Staff member updated." : `Teacher added. Login password: ${d.password || DEFAULT_PASSWORD}`);
  });
}

export async function deleteStaffAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "staff");
    const s = await db.staff.findUnique({ where: { id } });
    if (!s) throw new UserError("Staff member not found.");
    await db.user.delete({ where: { id: s.userId } });
    revalidatePath("/staff");
    return ok("Staff member removed.");
  });
}

export async function toggleUserActiveAction(userId: string): Promise<ActionState> {
  return run(async () => {
    const me = await requireActionUser(["ADMIN"]);
    if (me.id === userId) throw new UserError("You can't deactivate your own account.");
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) throw new UserError("User not found.");
    await db.user.update({ where: { id: userId }, data: { active: !u.active } });
    revalidatePath("/students");
    revalidatePath("/staff");
    return ok(u.active ? "Account deactivated." : "Account activated.");
  });
}

export async function resetPasswordAction(userId: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"]);
    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) throw new UserError("User not found.");
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10) } });
    return ok(`Password reset to ${DEFAULT_PASSWORD}`);
  });
}

/* -------------------------------------------------------------- profile */
export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const me = await requireActionUser();
    const d = parse(z.object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(8, "New password must be at least 8 characters"), confirm: z.string() }), fd);
    if (d.next !== d.confirm) throw new UserError("New passwords do not match.");
    const u = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(d.current, u.passwordHash))) throw new UserError("Current password is incorrect.");
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(d.next, 10) } });
    return ok("Password updated.");
  });
}
