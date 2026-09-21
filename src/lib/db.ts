import "server-only";
import { PrismaClient } from "@prisma/client";
import { getTenantId } from "@/lib/tenant";

/**
 * Two clients:
 *  - `db`    : school-scoped. Every query on a school-owned model is forced to the
 *              school in the signed session cookie (school_id is injected into
 *              where / data). One school can never read or write another's rows.
 *  - `rawDb` : unscoped. Only for login, tenant lookup, seeding and admin scripts.
 */
const TENANT_MODELS = new Set([
  "User", "AcademicYear", "Staff", "ClassRoom", "Student", "Subject", "StudentSubject", "Allocation",
  "StudentAttendance", "StaffAttendance", "Exam", "Mark", "TimetableSlot", "Announcement",
  "AnnouncementTarget", "LeaveRequest", "Bus", "BusStop", "Driver", "FeatureUnlockRequest", "SchoolFeature",
]);

const WHERE_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate",
  "groupBy", "update", "updateMany", "delete", "deleteMany",
]);

function make() {
  const base = new PrismaClient();
  const scoped = base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const schoolId = await getTenantId();
          const a = args as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), schoolId };
          else if (operation === "create") a.data = { ...a.data, schoolId };
          else if (operation === "createMany")
            a.data = Array.isArray(a.data) ? a.data.map((d: object) => ({ ...d, schoolId })) : { ...a.data, schoolId };
          else if (operation === "upsert") {
            a.where = { ...a.where, schoolId };
            a.create = { ...a.create, schoolId };
          }
          return query(a);
        },
      },
    },
  });
  return { base, scoped };
}

const g = globalThis as unknown as { swanDb?: ReturnType<typeof make> };
const clients = g.swanDb ?? make();
if (process.env.NODE_ENV !== "production") g.swanDb = clients;

export const db = clients.scoped;
export const rawDb = clients.base;
