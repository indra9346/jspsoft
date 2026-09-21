import { Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { visibleClasses } from "@/lib/access";
import { getAnnouncements } from "@/lib/announcements";
import { AnnouncementCards } from "@/components/announcement-list";
import { AnnouncementForm } from "@/components/announcement-form";
import { ConfirmButton, Modal } from "@/components/form";
import { Empty, PageHeader } from "@/components/ui";
import { deleteAnnouncementAction } from "@/actions/announcements";
import { className, todayISO } from "@/lib/utils";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "announcements");
  const canPost = user.role !== "STUDENT";
  const [items, classes] = await Promise.all([getAnnouncements(user), canPost ? visibleClasses(user) : Promise.resolve([])]);

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle={canPost ? "Share important updates with everyone or target specific classes / sections" : "Important updates from your school"}
        icon="announce"
        color="linear-gradient(135deg,#10b981,#06b6d4)"
        actions={canPost && (
          <Modal title="New announcement" wide trigger={<button className="btn btn-primary"><Plus size={16} /> New announcement</button>}>
            <AnnouncementForm isAdmin={user.role === "ADMIN"} today={todayISO()} classes={classes.map((c) => ({ id: c.id, grade: c.grade, label: className(c) }))} />
          </Modal>
        )}
      />
      {items.length === 0 ? (
        <Empty title="No announcements yet" hint={canPost ? "Publish your first announcement." : "New updates will appear here."} />
      ) : (
        <AnnouncementCards
          items={items}
          actions={canPost ? (a) => (user.role === "ADMIN" || a.authorId === user.id ? (
            <ConfirmButton confirm={`Delete "${a.title}"?`} action={deleteAnnouncementAction.bind(null, a.id)}><Trash2 size={14} /></ConfirmButton>
          ) : null) : undefined}
        />
      )}
    </div>
  );
}
