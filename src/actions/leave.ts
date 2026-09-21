"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";
import { LEAVE_TYPES, addDays, inclusiveDays, todayISO, toDate, weekday } from "@/lib/utils";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose valid dates");

export async function applyLeaveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["TEACHER"], "leave");
    const staff = user.staff!;
    const d = parse(
      z.object({
        type: z.enum(["CASUAL", "SICK", "EARNED"], { message: "Choose a leave type" }),
        fromDate: dateStr,
        toDate: dateStr,
        reason: z.string().min(5, "Please give a reason").max(500),
      }),
      fd,
    );
    if (d.toDate < d.fromDate) throw new UserError("The end date can't be before the start date.");
    if (d.fromDate < addDays(todayISO(), -7)) throw new UserError("You can't apply for leave more than 7 days in the past.");
    const days = inclusiveDays(d.fromDate, d.toDate);
    if (days > 30) throw new UserError("A single request can't exceed 30 days.");

    const overlap = await db.leaveRequest.findFirst({
      where: { staffId: staff.id, status: { in: ["PENDING", "APPROVED"] }, fromDate: { lte: toDate(d.toDate) }, toDate: { gte: toDate(d.fromDate) } },
    });
    if (overlap) throw new UserError("You already have a leave request covering these dates.");

    const year = d.fromDate.slice(0, 4);
    const used = await db.leaveRequest.aggregate({
      where: { staffId: staff.id, type: d.type, status: { in: ["PENDING", "APPROVED"] }, fromDate: { gte: toDate(`${year}-01-01`), lte: toDate(`${year}-12-31`) } },
      _sum: { days: true },
    });
    const left = LEAVE_TYPES[d.type].quota - (used._sum.days ?? 0);
    if (days > left) throw new UserError(`Only ${left} day(s) of ${LEAVE_TYPES[d.type].label} left this year.`);

    await db.leaveRequest.create({ data: { schoolId: user.schoolId, staffId: staff.id, type: d.type, fromDate: toDate(d.fromDate), toDate: toDate(d.toDate), days, reason: d.reason } });
    revalidatePath("/leave");
    revalidatePath("/dashboard");
    return ok("Leave request submitted for admin approval.");
  });
}

export async function cancelLeaveAction(id: string): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["TEACHER"], "leave");
    const l = await db.leaveRequest.findUnique({ where: { id } });
    if (!l || l.staffId !== user.staff!.id) throw new UserError("Request not found.");
    if (l.status !== "PENDING") throw new UserError("Only pending requests can be cancelled.");
    await db.leaveRequest.delete({ where: { id } });
    revalidatePath("/leave");
    return ok("Request cancelled.");
  });
}

export async function reviewLeaveAction(id: string, decision: "APPROVED" | "REJECTED", _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await requireActionUser(["ADMIN"], "leave");
    const remark = String(fd.get("remark") ?? "").trim().slice(0, 300);
    const l = await db.leaveRequest.findUnique({ where: { id } });
    if (!l) throw new UserError("Request not found.");
    if (l.status !== "PENDING") throw new UserError("This request has already been reviewed.");

    await db.leaveRequest.update({ where: { id }, data: { status: decision, reviewedById: admin.id, remark: remark || null } });

    if (decision === "APPROVED") {
      const from = l.fromDate.toISOString().slice(0, 10);
      const ops = [];
      for (let i = 0; i < l.days; i++) {
        const day = addDays(from, i);
        if (weekday(day) === 0) continue;
        ops.push(
          db.staffAttendance.upsert({
            where: { staffId_date: { staffId: l.staffId, date: toDate(day) } },
            update: { status: "LEAVE", note: "Approved leave" },
            create: { schoolId: admin.schoolId, staffId: l.staffId, date: toDate(day), status: "LEAVE", note: "Approved leave" },
          }),
        );
      }
      await db.$transaction(ops);
    }
    revalidatePath("/leave");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    return ok(decision === "APPROVED" ? "Leave approved and marked in attendance." : "Leave rejected.");
  });
}
