import Link from "next/link";
import { Bus as BusIcon, Clock, Lock, MapPin, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, Modal, SubmitButton } from "@/components/form";
import { addStopAction, deleteBusAction, deleteDriverAction, deleteStopAction, saveBusAction, saveDriverAction } from "@/actions/transport";
import { className } from "@/lib/utils";

export const metadata = { title: "Transport" };

const STATUS = { ACTIVE: "#059669", MAINTENANCE: "#d97706", INACTIVE: "#6b6ea6" } as const;

export default async function TransportPage() {
  const user = await requireUser(["ADMIN", "TEACHER", "STUDENT"], "transport");
  if (user.role === "STUDENT") return <MyTransport user={user} />;
  return <TransportOverview isAdmin={user.role === "ADMIN"} />;
}

/* ------------------------------------------------------------ student */
async function MyTransport({ user }: { user: SessionUser }) {
  const st = user.student!; // own bus only — from the session, never from the URL
  const bus = st.busId ? await db.bus.findUnique({ where: { id: st.busId }, include: { driver: true, stops: { orderBy: { sequence: "asc" } } } }) : null;
  return (
    <div>
      <PageHeader title="My Transport" subtitle="Your school bus, driver, route and stops" icon="bus" color="linear-gradient(135deg,#0d9488,#06b6d4)" />
      {!bus ? <Empty title="You are not assigned to a school bus" hint="If you need school transport, please contact the school office." /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-4 p-5 text-white" style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/25"><BusIcon size={28} /></span>
              <div><div className="text-2xl font-extrabold">Bus {bus.busNumber}</div><div className="text-sm text-white/90">{bus.registrationNo}</div></div>
              <span className="ml-auto badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>{bus.status}</span>
            </div>
            <div className="space-y-2 p-5 text-sm">
              {[["Driver", bus.driver ? bus.driver.name : "Not assigned"], ["Driver phone", bus.driver?.phone ?? "—"], ["Route", bus.routeName], ["Departure", bus.departureTime], ["Arrival at school", bus.arrivalTime]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-[color:var(--line)] pb-2"><span className="font-semibold text-[color:var(--ink-soft)]">{k}</span><span className="font-bold text-[color:var(--ink-strong)]">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <h2 className="section-title mb-4">Route & stops</h2>
            <ol className="relative space-y-4 border-l-2 border-dashed border-[color:var(--line)] pl-6">
              {bus.stops.map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: s.id === st.busStopId ? "#e11d48" : "#0d9488" }}>{s.sequence}</span>
                  <div className="flex items-center gap-2"><b className="text-[color:var(--ink-strong)]">{s.name}</b>{s.id === st.busStopId && <Badge color="#e11d48">Your stop</Badge>}</div>
                  <div className="flex items-center gap-1 text-xs text-[color:var(--ink-soft)]"><Clock size={11} /> Pick-up {s.pickupTime}</div>
                </li>
              ))}
              <li className="relative"><span className="absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-white"><MapPin size={12} /></span><b className="text-[color:var(--ink-strong)]">School</b><div className="text-xs text-[color:var(--ink-soft)]">Arrival {bus.arrivalTime}</div></li>
            </ol>
          </div>
        </div>
      )}
      <AdvancedTeaser />
    </div>
  );
}

function AdvancedTeaser() {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm">
      <Lock size={16} className="text-amber-600" />
      <span className="flex-1 text-amber-800"><b>Live GPS & real-time bus tracking</b> are an additional subscription feature.</span>
      <Link href="/transport/gps" className="btn btn-soft btn-sm">See preview</Link>
    </div>
  );
}

/* ------------------------------------------------------- admin & teacher */
async function TransportOverview({ isAdmin }: { isAdmin: boolean }) {
  const [buses, drivers] = await Promise.all([
    db.bus.findMany({ include: { driver: true, stops: { orderBy: { sequence: "asc" } }, students: { include: { user: true, classRoom: true }, orderBy: { rollNo: "asc" } } }, orderBy: { busNumber: "asc" } }),
    db.driver.findMany({ include: { bus: true }, orderBy: { driverCode: "asc" } }),
  ]);
  const assigned = buses.reduce((a, b) => a + b.students.length, 0);

  const busForm = (b?: (typeof buses)[number]) => (
    <ActionForm action={saveBusAction.bind(null, b?.id ?? null)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bus number" name="busNumber"><input id="busNumber" name="busNumber" className="input" placeholder="SW-06" defaultValue={b?.busNumber} required /></Field>
        <Field label="Registration number" name="registrationNo"><input id="registrationNo" name="registrationNo" className="input" placeholder="TN 09 AB 1234" defaultValue={b?.registrationNo} required /></Field>
        <Field label="Capacity" name="capacity"><input id="capacity" name="capacity" type="number" min={1} className="input" defaultValue={b?.capacity ?? 40} required /></Field>
        <Field label="Status" name="status"><select id="status" name="status" className="select" defaultValue={b?.status ?? "ACTIVE"}><option value="ACTIVE">Active</option><option value="MAINTENANCE">Maintenance</option><option value="INACTIVE">Inactive</option></select></Field>
        <Field label="Departure time" name="departureTime"><input id="departureTime" name="departureTime" type="time" className="input" defaultValue={b?.departureTime ?? "07:00"} required /></Field>
        <Field label="Arrival time (school)" name="arrivalTime"><input id="arrivalTime" name="arrivalTime" type="time" className="input" defaultValue={b?.arrivalTime ?? "08:15"} required /></Field>
      </div>
      <Field label="Route" name="routeName"><input id="routeName" name="routeName" className="input" placeholder="Anna Nagar – Kilpauk – School" defaultValue={b?.routeName} required /></Field>
      <Field label="Driver" name="driverId">
        <select id="driverId" name="driverId" className="select" defaultValue={b?.driverId ?? ""}>
          <option value="">— Not assigned —</option>
          {drivers.filter((d) => !d.bus || d.bus.id === b?.id).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.driverCode})</option>)}
        </select>
      </Field>
      <div className="flex justify-end"><SubmitButton>{b ? "Save bus" : "Add bus"}</SubmitButton></div>
    </ActionForm>
  );

  const driverForm = (d?: (typeof drivers)[number]) => (
    <ActionForm action={saveDriverAction.bind(null, d?.id ?? null)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Driver ID" name="driverCode"><input id="driverCode" name="driverCode" className="input" placeholder="D006" defaultValue={d?.driverCode} required /></Field>
        <Field label="Driver name" name="name"><input id="name" name="name" className="input" defaultValue={d?.name} required /></Field>
        <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" defaultValue={d?.phone} required /></Field>
        <Field label="Licence number" name="licenseNo"><input id="licenseNo" name="licenseNo" className="input" defaultValue={d?.licenseNo} required /></Field>
      </div>
      <Field label="Status" name="status"><select id="status" name="status" className="select" defaultValue={d?.status ?? "ACTIVE"}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></Field>
      <div className="flex justify-end"><SubmitButton>{d ? "Save driver" : "Add driver"}</SubmitButton></div>
    </ActionForm>
  );

  return (
    <div>
      <PageHeader
        title="Transport" subtitle={`${buses.length} buses · ${drivers.length} drivers · ${assigned} students using school transport`}
        icon="bus" color="linear-gradient(135deg,#0d9488,#06b6d4)"
        actions={isAdmin && (
          <>
            <Modal title="Add driver" trigger={<button className="btn btn-ghost"><Plus size={16} /> Add driver</button>}>{driverForm()}</Modal>
            <Modal title="Add bus" wide trigger={<button className="btn btn-primary"><Plus size={16} /> Add bus</button>}>{busForm()}</Modal>
          </>
        )}
      />

      {buses.length === 0 ? <Empty title="No buses yet" hint={isAdmin ? "Add your first bus, driver and route." : "Transport details have not been set up yet."} /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          {buses.map((b) => (
            <div key={b.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 p-4 text-white" style={{ background: "linear-gradient(135deg,#0d9488,#06b6d4)" }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/25"><BusIcon size={24} /></span>
                <div className="min-w-0 flex-1"><div className="text-xl font-extrabold">{b.busNumber}</div><div className="text-xs text-white/90">{b.registrationNo}</div></div>
                <span className="badge" style={{ background: "rgba(255,255,255,.25)", color: "#fff" }}>{b.status}</span>
                {isAdmin && (
                  <div className="flex gap-1.5">
                    <Modal title={`Edit bus ${b.busNumber}`} wide trigger={<button className="btn btn-sm bg-white/25 text-white hover:bg-white/40"><Pencil size={14} /></button>}>{busForm(b)}</Modal>
                    <ConfirmButton className="btn btn-sm bg-white/25 text-white hover:bg-white/40" confirm={`Delete bus ${b.busNumber}? Students on it will be unassigned.`} action={deleteBusAction.bind(null, b.id)}><Trash2 size={14} /></ConfirmButton>
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-[color:var(--brand2-soft)] p-3"><div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">Route</div><div className="font-bold text-[color:var(--ink-strong)]">{b.routeName}</div></div>
                  <div className="rounded-xl bg-[color:var(--brand2-soft)] p-3"><div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">Timings</div><div className="font-bold text-[color:var(--ink-strong)]">Departs {b.departureTime} · Arrives {b.arrivalTime}</div></div>
                  <div className="rounded-xl bg-[color:var(--brand2-soft)] p-3"><div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">Driver</div><div className="font-bold text-[color:var(--ink-strong)]">{b.driver ? b.driver.name : "Not assigned"}</div>{b.driver && <div className="flex items-center gap-1 text-xs text-[color:var(--ink-soft)]"><Phone size={11} /> {b.driver.phone}</div>}</div>
                  <div className="rounded-xl bg-[color:var(--brand2-soft)] p-3"><div className="text-[11px] font-bold uppercase text-[color:var(--ink-soft)]">Seats</div><div className="font-bold text-[color:var(--ink-strong)]">{b.students.length} / {b.capacity} filled</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.students.length / b.capacity) * 100)}%`, background: "linear-gradient(90deg,#10b981,#06b6d4)" }} /></div></div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--ink-soft)]">Stops</div>
                  <div className="flex flex-wrap gap-2">
                    {b.stops.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                        {s.sequence}. {s.name} · {s.pickupTime}
                        {isAdmin && <ConfirmButton className="text-rose-500" confirm={`Remove stop ${s.name}?`} action={deleteStopAction.bind(null, s.id)}>×</ConfirmButton>}
                      </span>
                    ))}
                    {isAdmin && (
                      <Modal title={`Add stop · ${b.busNumber}`} trigger={<button className="rounded-full border border-dashed border-teal-400 px-2.5 py-1 text-xs font-semibold text-teal-700">+ Add stop</button>}>
                        <ActionForm action={addStopAction.bind(null, b.id)} resetOnSuccess closeOnSuccess={false}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Stop name" name="name"><input id="name" name="name" className="input" required /></Field>
                            <Field label="Pick-up time" name="pickupTime"><input id="pickupTime" name="pickupTime" type="time" className="input" required /></Field>
                          </div>
                          <SubmitButton>Add stop</SubmitButton>
                        </ActionForm>
                      </Modal>
                    )}
                  </div>
                </div>
                {b.students.length > 0 && (
                  <details className="rounded-xl bg-white p-3 ring-1 ring-[color:var(--line)]">
                    <summary className="flex cursor-pointer items-center gap-2 font-bold text-[color:var(--ink-strong)]"><Users size={14} /> {b.students.length} students on this bus</summary>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {b.students.map((s) => (<li key={s.id} className="flex items-center gap-2 text-xs"><Avatar name={s.user.name} seed={s.user.email} size={22} photo={s.photoData} />{isAdmin ? <Link href={`/students/${s.id}`} className="font-semibold">{s.user.name}</Link> : <span className="font-semibold">{s.user.name}</span>}<span className="text-[color:var(--ink-soft)]">· {className(s.classRoom)}</span></li>))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card table-wrap mt-6">
        <div className="p-4 pb-0"><h2 className="section-title">Drivers</h2></div>
        <table className="table mt-3">
          <thead><tr><th>Driver ID</th><th>Name</th><th>Phone</th><th>Licence</th><th>Assigned bus</th><th>Status</th>{isAdmin && <th />}</tr></thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td className="font-bold">{d.driverCode}</td><td className="font-bold text-[color:var(--ink-strong)]">{d.name}</td><td>{d.phone}</td><td>{d.licenseNo}</td>
                <td>{d.bus ? <Badge color="#0d9488">{d.bus.busNumber}</Badge> : <span className="text-[color:var(--ink-soft)]">—</span>}</td>
                <td><Badge color={d.status === "ACTIVE" ? "#059669" : "#6b6ea6"}>{d.status}</Badge></td>
                {isAdmin && (
                  <td><div className="flex justify-end gap-1.5">
                    <Modal title="Edit driver" trigger={<button className="btn btn-soft btn-sm"><Pencil size={14} /></button>}>{driverForm(d)}</Modal>
                    <ConfirmButton confirm={`Remove driver ${d.name}?`} action={deleteDriverAction.bind(null, d.id)}><Trash2 size={14} /></ConfirmButton>
                  </div></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdvancedTeaser />
      <span className="hidden">{Object.keys(STATUS).length}</span>
    </div>
  );
}
