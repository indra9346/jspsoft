"use client";

import { useState } from "react";
import { Upload, RotateCcw } from "lucide-react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Logo } from "@/components/logo";
import { saveBrandingAction } from "@/actions/branding";

const PRESETS = [
  { name: "Swan Crimson", a: "#e11d48", b: "#7c3aed" },
  { name: "Ocean", a: "#0ea5e9", b: "#6366f1" },
  { name: "Emerald", a: "#10b981", b: "#0891b2" },
  { name: "Sunset", a: "#f97316", b: "#ec4899" },
  { name: "Royal", a: "#7c3aed", b: "#2563eb" },
  { name: "Berry", a: "#db2777", b: "#f59e0b" },
];

interface School {
  name: string; tagline: string; primaryColor: string; secondaryColor: string; logoData: string | null;
  address: string; phone: string; email: string; website: string; principalName: string; signatureData: string | null;
}

export function BrandingForm({ school }: { school: School }) {
  const [name, setName] = useState(school.name);
  const [tagline, setTagline] = useState(school.tagline);
  const [a, setA] = useState(school.primaryColor);
  const [b, setB] = useState(school.secondaryColor);
  const [logo, setLogo] = useState<string | null>(school.logoData);
  const [reset, setReset] = useState(false);
  const [sign, setSign] = useState<string | null>(school.signatureData);
  const [resetSign, setResetSign] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="card card-pad">
        <ActionForm action={saveBrandingAction} closeOnSuccess={false}>
          <input type="hidden" name="resetLogo" value={reset ? "1" : "0"} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="School name" name="name"><input id="name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Principal name" name="principalName"><input id="principalName" name="principalName" className="input" defaultValue={school.principalName} /></Field>
          </div>
          <Field label="Tagline" name="tagline"><input id="tagline" name="tagline" className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>

          <div>
            <div className="label">Colour theme</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => { setA(p.a); setB(p.b); }} className="flex items-center gap-2 rounded-xl border-2 bg-white px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: a === p.a && b === p.b ? p.a : "var(--line)" }}>
                  <span className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg,${p.a},${p.b})` }} /> {p.name}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary colour" name="primaryColor">
                <div className="flex items-center gap-2"><input type="color" value={a} onChange={(e) => setA(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Primary colour" /><input id="primaryColor" name="primaryColor" className="input" value={a} onChange={(e) => setA(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" /></div>
              </Field>
              <Field label="Accent colour" name="secondaryColor">
                <div className="flex items-center gap-2"><input type="color" value={b} onChange={(e) => setB(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Accent colour" /><input id="secondaryColor" name="secondaryColor" className="input" value={b} onChange={(e) => setB(e.target.value)} pattern="^#[0-9a-fA-F]{6}$" /></div>
              </Field>
            </div>
            <p className="mt-1 text-xs text-[color:var(--ink-soft)]">Bright, colourful shades only — very dark colours are not accepted.</p>
          </div>

          <div>
            <div className="label">School logo</div>
            <div className="flex flex-wrap items-center gap-3">
              <Logo src={reset ? null : logo} size={64} className="ring-1 ring-[color:var(--line)]" />
              <label className="btn btn-soft cursor-pointer"><Upload size={16} /> Upload logo
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReset(false); setLogo(URL.createObjectURL(f)); } }} />
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => setReset(true)}><RotateCcw size={16} /> Use default swan logo</button>
            </div>
            <p className="mt-1 text-xs text-[color:var(--ink-soft)]">PNG, JPG, WebP or SVG · up to 400 KB · transparent PNG looks best.</p>
          </div>

          <div>
            <div className="label">Authorized signature (used on report cards & PDFs)</div>
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {sign && !resetSign ? <img src={sign} alt="Signature" className="h-14 rounded-lg bg-white object-contain p-1 ring-1 ring-[color:var(--line)]" /> : <span className="rounded-lg bg-white px-3 py-4 text-xs text-[color:var(--ink-soft)] ring-1 ring-[color:var(--line)]">No signature uploaded</span>}
              <input type="hidden" name="resetSignature" value={resetSign ? "1" : "0"} />
              <label className="btn btn-soft cursor-pointer"><Upload size={16} /> Upload signature
                <input type="file" name="signature" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setResetSign(false); setSign(URL.createObjectURL(f)); } }} />
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => setResetSign(true)}><RotateCcw size={16} /> Remove</button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Website" name="website"><input id="website" name="website" className="input" defaultValue={school.website} placeholder="https://" /></Field>
            <Field label="Phone" name="phone"><input id="phone" name="phone" className="input" defaultValue={school.phone} /></Field>
            <Field label="Email" name="email"><input id="email" name="email" className="input" defaultValue={school.email} /></Field>
          </div>
          <Field label="Address" name="address"><input id="address" name="address" className="input" defaultValue={school.address} /></Field>
          <div className="flex justify-end"><SubmitButton>Save branding</SubmitButton></div>
        </ActionForm>
      </div>

      <div className="space-y-4">
        <div className="text-sm font-bold text-[color:var(--ink-strong)]">Live preview</div>
        <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-[color:var(--line)]" style={{ ["--brand" as string]: a, ["--brand2" as string]: b }}>
          <div className="flex items-center gap-3 p-5 text-white" style={{ background: `linear-gradient(190deg, ${a}, ${b})` }}>
            <Logo src={reset ? null : logo} size={52} />
            <div><div className="text-lg font-extrabold">{name || "School name"}</div><div className="text-xs text-white/85">{tagline}</div></div>
          </div>
          <div className="space-y-3 bg-white p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="tile tile-blue !p-3"><div className="text-[11px] font-bold uppercase text-white/85">Students</div><div className="text-2xl font-extrabold">420</div></div>
              <div className="tile tile-green !p-3"><div className="text-[11px] font-bold uppercase text-white/85">Attendance</div><div className="text-2xl font-extrabold">96%</div></div>
            </div>
            <div className="flex gap-2">
              <span className="btn btn-primary btn-sm" style={{ background: `linear-gradient(135deg,${a},${b})` }}>Primary button</span>
              <span className="btn btn-sm" style={{ color: a, background: `color-mix(in srgb, ${a} 10%, white)` }}>Soft button</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
