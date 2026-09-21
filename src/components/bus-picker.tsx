"use client";

import { useState } from "react";

interface BusOpt {
  id: string;
  label: string;
  stops: { id: string; name: string }[];
}

/** Bus select + dependent stop select. */
export function BusPicker({ buses, busId, stopId }: { buses: BusOpt[]; busId?: string | null; stopId?: string | null }) {
  const [bus, setBus] = useState(busId ?? "");
  const stops = buses.find((b) => b.id === bus)?.stops ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="busId">School bus (optional)</label>
        <select id="busId" name="busId" className="select" value={bus} onChange={(e) => setBus(e.target.value)}>
          <option value="">— Does not use school transport —</option>
          {buses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="busStopId">Pick-up stop</label>
        <select id="busStopId" name="busStopId" className="select" defaultValue={stopId ?? ""} key={bus} disabled={!bus}>
          <option value="">— Select stop —</option>
          {stops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}
