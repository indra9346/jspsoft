import "server-only";
import { db } from "@/lib/db";
import { announcementWhere } from "@/lib/access";
import { todayISO, toDate } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import type { AnnouncementView } from "@/components/announcement-list";

export async function getAnnouncements(user: SessionUser, take = 50): Promise<AnnouncementView[]> {
  const rows = await db.announcement.findMany({
    where: await announcementWhere(user),
    orderBy: [{ publishDate: "desc" }, { createdAt: "desc" }],
    take,
    include: { author: true, targets: { include: { classRoom: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    priority: a.priority,
    createdAt: a.createdAt,
    authorName: a.author.name,
    authorId: a.authorId,
    publishDate: a.publishDate,
    expiryDate: a.expiryDate,
    expired: !!a.expiryDate && a.expiryDate < toDate(todayISO()),
    classes: a.targets.map((t) => `${t.classRoom.grade}-${t.classRoom.section}`),
  }));
}
