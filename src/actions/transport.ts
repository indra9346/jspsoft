"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, requireActionUser } from "@/lib/auth";
import { ok, parse, run, UserError, type ActionState } from "@/lib/action";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the 24-hour format HH:MM");

/* ---------------------------------------------------------------- drivers */
const driverSchema = z.object({
  driverCode: z.string().min(2, "Enter a driver ID").max(12),
  name: z.string().min(2, "Enter the driver's name"),
  phone: z.string().min(7, "Enter a valid phone number").max(20),
  licenseNo: z.string().min(6, "Enter the licence number").max(30),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function saveDriverAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "transport");
    const d = parse(driverSchema, fd);
    if (id) await db.driver.update({ where: { id }, data: d });
    else await db.driver.create({ data: { ...d, schoolId: user.schoolId } });
    revalidatePath("/transport");
    return ok(id ? "Driver updated." : "Driver added.");
  });
}

export async function deleteDriverAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "transport");
    await db.driver.delete({ where: { id } });
    revalidatePath("/transport");
    return ok("Driver removed.");
  });
}

/* ------------------------------------------------------------------ buses */
const busSchema = z.object({
  busNumber: z.string().min(2, "Enter the bus number").max(12),
  registrationNo: z.string().min(4, "Enter the registration number").max(20),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(120),
  routeName: z.string().min(3, "Enter the route").max(100),
  departureTime: time,
  arrivalTime: time,
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
  driverId: z.string().optional(),
});

export async function saveBusAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "transport");
    const d = parse(busSchema, fd);
    if (d.driverId) {
      const driver = await db.driver.findUnique({ where: { id: d.driverId }, include: { bus: true } });
      if (!driver) throw new UserError("Driver not found.");
      if (driver.bus && driver.bus.id !== id) throw new UserError(`${driver.name} is already assigned to bus ${driver.bus.busNumber}.`);
    }
    if (id) {
      const used = await db.student.count({ where: { busId: id } });
      if (d.capacity < used) throw new UserError(`${used} students use this bus — capacity can't be lower than that.`);
    }
    const { driverId, ...rest } = d;
    const data = { ...rest, driverId: driverId || null };
    if (id) await db.bus.update({ where: { id }, data });
    else await db.bus.create({ data: { ...data, schoolId: user.schoolId } });
    revalidatePath("/transport");
    return ok(id ? "Bus updated." : "Bus added.");
  });
}

export async function deleteBusAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "transport");
    await db.bus.delete({ where: { id } });
    revalidatePath("/transport");
    return ok("Bus removed. Students on it are now unassigned.");
  });
}

/* ------------------------------------------------------------------ stops */
export async function addStopAction(busId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireActionUser(["ADMIN"], "transport");
    const d = parse(z.object({ name: z.string().min(2, "Enter the stop name").max(60), pickupTime: time }), fd);
    const bus = await db.bus.findUnique({ where: { id: busId }, include: { stops: true } });
    if (!bus) throw new UserError("Bus not found.");
    const sequence = bus.stops.reduce((m, s) => Math.max(m, s.sequence), 0) + 1;
    await db.busStop.create({ data: { schoolId: user.schoolId, busId, name: d.name, pickupTime: d.pickupTime, sequence } });
    revalidatePath("/transport");
    return ok("Stop added.");
  });
}

export async function deleteStopAction(id: string): Promise<ActionState> {
  return run(async () => {
    await requireActionUser(["ADMIN"], "transport");
    await db.busStop.delete({ where: { id } });
    revalidatePath("/transport");
    return ok("Stop removed.");
  });
}
