/* eslint-disable @typescript-eslint/no-explicit-any -- registration draft fields are dynamic by wizard step. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bike, Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { SHIFTS, VEHICLES, DOC_LABELS } from "@/lib/delivery";
import { useSessionUser } from "@/hooks/usePartner";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Delivery partner registration — Local Shore" },
      {
        name: "description",
        content:
          "Register as a Local Shore delivery partner in nine steps: account, personal details, address, vehicle, licence, identity, bank, zones and shifts.",
      },
      { property: "og:title", content: "Delivery partner registration — Local Shore" },
      {
        property: "og:description",
        content: "Complete your rider onboarding and submit your documents for verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const STEP_TITLES = [
  "Create account",
  "Personal details",
  "Address",
  "Vehicle",
  "Driving licence",
  "Identity verification",
  "Bank details",
  "Preferred zones",
  "Working preferences",
];

type Doc = { doc_type: string; file_path: string; expiry_date: string | null };

// Columns the wizard is allowed to write while the draft is in progress.
const AUTOSAVE_FIELDS = [
  "date_of_birth",
  "gender",
  "emergency_contact_name",
  "emergency_contact_number",
  "house_number",
  "street",
  "area",
  "city",
  "state",
  "pincode",
  "vehicle_type",
  "vehicle_number",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_color",
  "licence_number",
  "licence_expiry",
  "aadhaar_number",
  "pan_number",
  "bank_account_holder",
  "bank_name",
  "bank_account_number",
  "bank_ifsc",
  "upi_id",
  "employment_type",
] as const;

const DATE_FIELDS = new Set(["date_of_birth", "licence_expiry"]);

function draftPayload(form: Record<string, string>) {
  const payload: Record<string, unknown> = {};
  for (const key of AUTOSAVE_FIELDS) {
    const value = (form[key] ?? "").trim();
    if (!value && !DATE_FIELDS.has(key)) continue;
    payload[key] = value ? value : null;
  }
  return payload;
}

function RegisterPage() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [partner, setPartner] = useState<Record<string, any> | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string; city: string }[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const lastSaved = useRef<string>("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isBicycle = (form["vehicle_type"] ?? partner?.["vehicle_type"]) === "bicycle";

  // Autosave the draft ~1s after typing stops, so a refresh never loses progress.
  const draftKey = JSON.stringify(draftPayload(form));
  useEffect(() => {
    if (!partner || loading || partner["status"] !== "draft") return;
    if (!lastSaved.current) {
      lastSaved.current = draftKey;
      return;
    }
    if (draftKey === lastSaved.current) return;

    const timer = setTimeout(async () => {
      setSaveState("saving");
      const { error } = await db
        .from("delivery_partners")
        .update(JSON.parse(draftKey))
        .eq("id", partner["id"]);
      if (error) {
        setSaveState("error");
        return;
      }
      lastSaved.current = draftKey;
      setSavedAt(new Date());
      setSaveState("saved");
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftKey, partner, loading]);

  useEffect(() => {
    if (user === undefined) return;
    (async () => {
      const { data: zoneRows } = await db
        .from("delivery_zones")
        .select("id,name,city")
        .eq("is_active", true)
        .order("name");
      setZones(zoneRows ?? []);

      if (!user) {
        setLoading(false);
        return;
      }
      const { data: p } = await db
        .from("delivery_partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (p) {
        setPartner(p);
        setForm(
          Object.fromEntries(
            Object.entries(p).filter(([, v]) => typeof v === "string" && v !== null),
          ) as Record<string, string>,
        );
        setStep(Math.min(9, Math.max(2, p.registration_step ?? 2)));
        const [{ data: d }, { data: pz }, { data: sh }] = await Promise.all([
          db
            .from("delivery_documents")
            .select("doc_type,file_path,expiry_date")
            .eq("partner_id", p.id),
          db.from("delivery_partner_zones").select("zone_id").eq("partner_id", p.id),
          db.from("delivery_shifts").select("slot").eq("partner_id", p.id),
        ]);
        setDocs(d ?? []);
        setSelectedZones((pz ?? []).map((r: any) => r.zone_id));
        setSelectedShifts((sh ?? []).map((r: any) => r.slot));
        if (p.status !== "draft") navigate({ to: "/partner" });
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  async function savePartner(patch: Record<string, unknown>, nextStep: number) {
    if (!partner) return;
    setBusy(true);
    const { data, error } = await db
      .from("delivery_partners")
      .update({
        ...patch,
        registration_step: Math.max(partner["registration_step"] ?? 1, nextStep),
      })
      .eq("id", partner["id"])
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPartner(data);
    if (nextStep > 9) {
      toast.success("Application submitted for verification");
      navigate({ to: "/partner" });
    } else {
      setStep(nextStep);
    }
  }

  async function uploadDoc(docType: string, file: File, expiry?: string) {
    if (!user || !partner) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Upload a PDF/JPEG/PNG/WebP file under 10 MB");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${docType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("delivery-docs").upload(path, file, {
      upsert: true,
    });
    if (upErr) {
      setBusy(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await db.from("delivery_documents").upsert(
      {
        partner_id: partner["id"],
        doc_type: docType,
        file_path: path,
        expiry_date: expiry || null,
        status: "pending",
      },
      { onConflict: "partner_id,doc_type" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDocs((d) => [
      ...d.filter((x) => x.doc_type !== docType),
      { doc_type: docType, file_path: path, expiry_date: expiry ?? null },
    ]);
    toast.success(`${DOC_LABELS[docType] ?? docType} uploaded`);
  }

  const hasDoc = (t: string) => docs.some((d) => d.doc_type === t);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-16">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bike className="h-5 w-5" />
          </span>
          <span className="font-semibold text-foreground">Local Shore Partners</span>
        </Link>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Step {step} of 9 · {STEP_TITLES[step - 1]}
            </span>
            <span className="text-muted-foreground">{Math.round((step / 9) * 100)}%</span>
          </div>
          <Progress className="mt-2" value={(step / 9) * 100} />
          <div className="mt-2 flex h-5 items-center gap-1.5 text-xs text-muted-foreground transition-smooth">
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving draft…
              </>
            ) : null}
            {saveState === "saved" ? (
              <>
                <Check className="h-3 w-3 text-primary" />
                Draft saved{savedAt ? ` at ${savedAt.toLocaleTimeString()}` : ""}
              </>
            ) : null}
            {saveState === "error" ? (
              <span className="text-destructive">
                Couldn’t autosave — your next step will retry.
              </span>
            ) : null}
            {saveState === "idle" && partner ? (
              <span>Your progress saves automatically.</span>
            ) : null}
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            {step === 1 ? (
              <StepAccount
                existingUser={!!user && !!partner}
                currentUserId={user?.id}
                currentUserEmail={user?.email}
                currentUserName={
                  user?.user_metadata?.full_name ?? user?.user_metadata?.display_name
                }
                busy={busy}
                setBusy={setBusy}
                onDone={(p) => {
                  setPartner(p);
                  setStep(2);
                }}
              />
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <Field label="Profile photo">
                  <FileInput
                    done={hasDoc("profile_photo")}
                    busy={busy}
                    onFile={(f) => uploadDoc("profile_photo", f)}
                  />
                </Field>
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={form["date_of_birth"] ?? ""}
                    onChange={(e) => set("date_of_birth", e.target.value)}
                  />
                </Field>
                <Field label="Gender">
                  <Select value={form["gender"] ?? ""} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Emergency contact name">
                  <Input
                    value={form["emergency_contact_name"] ?? ""}
                    onChange={(e) => set("emergency_contact_name", e.target.value)}
                  />
                </Field>
                <Field label="Emergency contact number">
                  <Input
                    value={form["emergency_contact_number"] ?? ""}
                    onChange={(e) => set("emergency_contact_number", e.target.value)}
                  />
                </Field>
                <Nav
                  busy={busy}
                  onBack={() => setStep(1)}
                  onNext={() =>
                    savePartner(
                      {
                        date_of_birth: form["date_of_birth"] || null,
                        gender: form["gender"] || null,
                        emergency_contact_name: form["emergency_contact_name"] || null,
                        emergency_contact_number: form["emergency_contact_number"] || null,
                      },
                      3,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                {[
                  ["house_number", "House number"],
                  ["street", "Street"],
                  ["area", "Area"],
                  ["city", "City"],
                  ["state", "State"],
                  ["pincode", "Pincode"],
                ].map(([k, label]) => (
                  <Field key={k} label={label!}>
                    <Input value={form[k!] ?? ""} onChange={(e) => set(k!, e.target.value)} />
                  </Field>
                ))}
                <Nav
                  busy={busy}
                  onBack={() => setStep(2)}
                  onNext={() =>
                    savePartner(
                      {
                        house_number: form["house_number"] || null,
                        street: form["street"] || null,
                        area: form["area"] || null,
                        city: form["city"] || null,
                        state: form["state"] || null,
                        pincode: form["pincode"] || null,
                      },
                      4,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <Field label="Vehicle type">
                  <RadioGroup
                    className="grid grid-cols-2 gap-2"
                    value={form["vehicle_type"] ?? ""}
                    onValueChange={(v) => set("vehicle_type", v)}
                  >
                    {VEHICLES.map((v) => (
                      <label
                        key={v.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm"
                      >
                        <RadioGroupItem value={v.value} /> {v.label}
                      </label>
                    ))}
                  </RadioGroup>
                </Field>
                <Field label="Vehicle number">
                  <Input
                    placeholder={isBicycle ? "Not required for bicycle" : "TN 37 AB 1234"}
                    value={form["vehicle_number"] ?? ""}
                    onChange={(e) => set("vehicle_number", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Brand">
                    <Input
                      value={form["vehicle_brand"] ?? ""}
                      onChange={(e) => set("vehicle_brand", e.target.value)}
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={form["vehicle_model"] ?? ""}
                      onChange={(e) => set("vehicle_model", e.target.value)}
                    />
                  </Field>
                  <Field label="Colour">
                    <Input
                      value={form["vehicle_color"] ?? ""}
                      onChange={(e) => set("vehicle_color", e.target.value)}
                    />
                  </Field>
                </div>
                {!isBicycle ? (
                  <>
                    <Field label="Registration certificate (RC)">
                      <FileInput
                        done={hasDoc("rc")}
                        busy={busy}
                        onFile={(f) => uploadDoc("rc", f)}
                      />
                    </Field>
                    <Field label="Insurance">
                      <FileInput
                        done={hasDoc("insurance")}
                        busy={busy}
                        onFile={(f) => uploadDoc("insurance", f, form["insurance_expiry"])}
                      />
                      <Input
                        className="mt-2"
                        type="date"
                        value={form["insurance_expiry"] ?? ""}
                        onChange={(e) => set("insurance_expiry", e.target.value)}
                      />
                    </Field>
                  </>
                ) : (
                  <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                    RC and insurance are not required for bicycles.
                  </p>
                )}
                <Field label="Vehicle photo">
                  <FileInput
                    done={hasDoc("vehicle_photo")}
                    busy={busy}
                    onFile={(f) => uploadDoc("vehicle_photo", f)}
                  />
                </Field>
                <Nav
                  busy={busy}
                  onBack={() => setStep(3)}
                  disabled={!form["vehicle_type"]}
                  onNext={() =>
                    savePartner(
                      {
                        vehicle_type: form["vehicle_type"],
                        vehicle_number: form["vehicle_number"] || null,
                        vehicle_brand: form["vehicle_brand"] || null,
                        vehicle_model: form["vehicle_model"] || null,
                        vehicle_color: form["vehicle_color"] || null,
                      },
                      5,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                {isBicycle ? (
                  <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                    A driving licence is not required for bicycle deliveries. Continue to the next
                    step.
                  </p>
                ) : (
                  <>
                    <Field label="Licence number">
                      <Input
                        value={form["licence_number"] ?? ""}
                        onChange={(e) => set("licence_number", e.target.value)}
                      />
                    </Field>
                    <Field label="Expiry date">
                      <Input
                        type="date"
                        value={form["licence_expiry"] ?? ""}
                        onChange={(e) => set("licence_expiry", e.target.value)}
                      />
                    </Field>
                    <Field label="Licence photo">
                      <FileInput
                        done={hasDoc("licence")}
                        busy={busy}
                        onFile={(f) => uploadDoc("licence", f, form["licence_expiry"])}
                      />
                    </Field>
                  </>
                )}
                <Nav
                  busy={busy}
                  onBack={() => setStep(4)}
                  onNext={() =>
                    savePartner(
                      isBicycle
                        ? {}
                        : {
                            licence_number: form["licence_number"] || null,
                            licence_expiry: form["licence_expiry"] || null,
                          },
                      6,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-4">
                <Field label="Aadhaar number">
                  <Input
                    inputMode="numeric"
                    maxLength={12}
                    value={form["aadhaar_number"] ?? ""}
                    onChange={(e) => set("aadhaar_number", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Field label="PAN number">
                  <Input
                    maxLength={10}
                    value={form["pan_number"] ?? ""}
                    onChange={(e) => set("pan_number", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Aadhaar front">
                  <FileInput
                    done={hasDoc("aadhaar_front")}
                    busy={busy}
                    onFile={(f) => uploadDoc("aadhaar_front", f)}
                  />
                </Field>
                <Field label="Aadhaar back">
                  <FileInput
                    done={hasDoc("aadhaar_back")}
                    busy={busy}
                    onFile={(f) => uploadDoc("aadhaar_back", f)}
                  />
                </Field>
                <Field label="PAN card">
                  <FileInput done={hasDoc("pan")} busy={busy} onFile={(f) => uploadDoc("pan", f)} />
                </Field>
                <Nav
                  busy={busy}
                  onBack={() => setStep(5)}
                  disabled={(form["aadhaar_number"] ?? "").length !== 12 || !form["pan_number"]}
                  onNext={() =>
                    savePartner(
                      {
                        aadhaar_number: form["aadhaar_number"],
                        pan_number: form["pan_number"],
                      },
                      7,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 7 ? (
              <div className="space-y-4">
                {[
                  ["bank_account_holder", "Account holder name"],
                  ["bank_name", "Bank name"],
                  ["bank_account_number", "Account number"],
                  ["bank_ifsc", "IFSC"],
                  ["upi_id", "UPI ID"],
                ].map(([k, label]) => (
                  <Field key={k} label={label!}>
                    <Input value={form[k!] ?? ""} onChange={(e) => set(k!, e.target.value)} />
                  </Field>
                ))}
                <Nav
                  busy={busy}
                  onBack={() => setStep(6)}
                  disabled={!form["bank_account_number"] || !form["bank_ifsc"]}
                  onNext={() =>
                    savePartner(
                      {
                        bank_account_holder: form["bank_account_holder"] || null,
                        bank_name: form["bank_name"] || null,
                        bank_account_number: form["bank_account_number"] || null,
                        bank_ifsc: (form["bank_ifsc"] ?? "").toUpperCase() || null,
                        upi_id: form["upi_id"] || null,
                      },
                      8,
                    )
                  }
                />
              </div>
            ) : null}

            {step === 8 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Pick the areas you want to deliver in. You can change these later.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {zones.map((z) => (
                    <label
                      key={z.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <Checkbox
                        checked={selectedZones.includes(z.id)}
                        onCheckedChange={(c) =>
                          setSelectedZones((s) => (c ? [...s, z.id] : s.filter((x) => x !== z.id)))
                        }
                      />
                      <span>
                        <span className="font-medium text-foreground">{z.name}</span>
                        <span className="block text-xs text-muted-foreground">{z.city}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Nav
                  busy={busy}
                  onBack={() => setStep(7)}
                  disabled={selectedZones.length === 0}
                  onNext={async () => {
                    setBusy(true);
                    await db
                      .from("delivery_partner_zones")
                      .delete()
                      .eq("partner_id", partner!["id"]);
                    await db
                      .from("delivery_partner_zones")
                      .insert(
                        selectedZones.map((z) => ({ partner_id: partner!["id"], zone_id: z })),
                      );
                    setBusy(false);
                    savePartner({}, 9);
                  }}
                />
              </div>
            ) : null}

            {step === 9 ? (
              <div className="space-y-4">
                <Field label="Employment type">
                  <RadioGroup
                    className="grid grid-cols-2 gap-2"
                    value={form["employment_type"] ?? ""}
                    onValueChange={(v) => set("employment_type", v)}
                  >
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                      <RadioGroupItem value="full_time" /> Full time
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                      <RadioGroupItem value="part_time" /> Part time
                    </label>
                  </RadioGroup>
                </Field>
                <Field label="Preferred shifts">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SHIFTS.map((s) => (
                      <label
                        key={s.value}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
                      >
                        <Checkbox
                          checked={selectedShifts.includes(s.value)}
                          onCheckedChange={(c) =>
                            setSelectedShifts((x) =>
                              c ? [...x, s.value] : x.filter((y) => y !== s.value),
                            )
                          }
                        />
                        <span>
                          <span className="font-medium text-foreground">{s.label}</span>
                          <span className="block text-xs text-muted-foreground">{s.time}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Nav
                  busy={busy}
                  onBack={() => setStep(8)}
                  nextLabel="Submit for verification"
                  disabled={!form["employment_type"] || selectedShifts.length === 0}
                  onNext={async () => {
                    setBusy(true);
                    await db.from("delivery_shifts").delete().eq("partner_id", partner!["id"]);
                    await db
                      .from("delivery_shifts")
                      .insert(selectedShifts.map((s) => ({ partner_id: partner!["id"], slot: s })));
                    setBusy(false);
                    savePartner({ employment_type: form["employment_type"] }, 10);
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FileInput({
  onFile,
  done,
  busy,
}: {
  onFile: (f: File) => void;
  done: boolean;
  busy: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:bg-muted">
      {done ? <Check className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4" />}
      <span>{done ? "Uploaded — tap to replace" : "Choose a file"}</span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function Nav({
  onBack,
  onNext,
  busy,
  disabled,
  nextLabel = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  disabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex justify-between gap-3 pt-2">
      <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
        Back
      </Button>
      <Button type="button" onClick={onNext} disabled={busy || disabled}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {nextLabel}
      </Button>
    </div>
  );
}

function StepAccount({
  existingUser,
  currentUserId,
  currentUserEmail,
  currentUserName,
  busy,
  setBusy,
  onDone,
}: {
  existingUser: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: (p: Record<string, any>) => void;
}) {
  const [values, setValues] = useState({
    full_name: currentUserName ?? "",
    mobile: "",
    email: currentUserEmail ?? "",
    password: "",
  });

  const valid = useMemo(
    () =>
      values.full_name.trim().length > 2 &&
      /^[0-9]{10}$/.test(values.mobile.replace(/\D/g, "").slice(-10)) &&
      /\S+@\S+\.\S+/.test(values.email) &&
      (Boolean(currentUserId) || values.password.length >= 8),
    [values, currentUserId],
  );

  async function createAccount() {
    setBusy(true);
    let userId = currentUserId;
    if (!userId) {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error || !data.user) {
        setBusy(false);
        if (error?.message.toLowerCase().includes("already registered")) {
          toast.error(
            "This email is already registered. Sign in first, then continue registration.",
          );
        } else {
          toast.error(error?.message ?? "Could not create the account");
        }
        return;
      }
      userId = data.user.id;
    }
    const { data: p, error: pErr } = await db
      .from("delivery_partners")
      .insert({
        user_id: userId,
        full_name: values.full_name.trim(),
        mobile: values.mobile.trim(),
        email: values.email.trim(),
        mobile_verified: false,
        email_verified: Boolean(currentUserId),
        registration_step: 2,
      })
      .select("*")
      .single();
    setBusy(false);
    if (pErr) {
      toast.error(pErr.message);
      return;
    }
    toast.success("Account created");
    onDone(p);
  }

  if (existingUser) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You are already signed in. Continue to your partner area.
        </p>
        <Button asChild>
          <Link to="/partner">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Full name">
        <Input
          value={values.full_name}
          onChange={(e) => setValues({ ...values, full_name: e.target.value })}
        />
      </Field>
      <Field label="Mobile number">
        <Input
          inputMode="tel"
          value={values.mobile}
          onChange={(e) => setValues({ ...values, mobile: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Mobile verification is completed during document review.
        </p>
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={values.email}
          disabled={!!currentUserId}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {currentUserId
            ? "Using your signed-in LocalShoree account."
            : "Supabase Auth will create this account securely."}
        </p>
      </Field>
      {!currentUserId ? (
        <Field label="Password">
          <Input
            type="password"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">Using your existing Local Shore account.</p>
      )}
      <Button className="w-full" disabled={!valid || busy} onClick={createAccount}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/auth" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
