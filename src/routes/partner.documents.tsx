import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Clock, FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { usePartner } from "@/hooks/usePartner";
import { DOC_LABELS } from "@/lib/delivery";

export const Route = createFileRoute("/partner/documents")({
  component: Documents,
  head: () => ({
    meta: [
      { title: "Documents & Verification | Delivery Partner" },
      {
        name: "description",
        content:
          "Upload and renew your licence, RC, insurance and ID documents to stay eligible for deliveries.",
      },
      { property: "og:title", content: "Documents & Verification | Delivery Partner" },
      {
        property: "og:description",
        content: "Rider document upload and admin verification status tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const REQUIRED = [
  "profile_photo",
  "aadhaar_front",
  "aadhaar_back",
  "pan",
  "licence",
  "rc",
  "insurance",
  "vehicle_photo",
];

function Documents() {
  const { partner } = usePartner();
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [expiryByType, setExpiryByType] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!partner) return;
    const { data } = await db.from("delivery_documents").select("*").eq("partner_id", partner.id);
    setDocs(data ?? []);
  }, [partner?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(docType: string, file: File, expiryDate?: string) {
    if (!partner) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Upload a PDF/JPEG/PNG/WebP file under 10 MB");
      return;
    }
    if (expiryDate && new Date(`${expiryDate}T23:59:59`).getTime() <= Date.now()) {
      toast.error("Document expiry date must be in the future");
      return;
    }
    setBusy(docType);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${partner.user_id}/${docType}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("delivery-docs")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(null);
      toast.error(upErr.message);
      return;
    }
    const { error } = await db.from("delivery_documents").upsert(
      {
        partner_id: partner.id,
        doc_type: docType,
        file_path: path,
        status: "pending",
        expiry_date: expiryDate || null,
      },
      { onConflict: "partner_id,doc_type" },
    );
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Document submitted for review");
    load();
  }

  async function view(path: string) {
    const { data, error } = await supabase.storage.from("delivery-docs").createSignedUrl(path, 120);
    if (error || !data) {
      toast.error("Could not open the file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (!partner) return null;
  const relevant = REQUIRED.filter(
    (d) => partner.vehicle_type !== "bicycle" || !["licence", "rc", "insurance"].includes(d),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Keep these current — expired documents pause new delivery requests.
        </p>
      </div>

      {partner.status !== "approved" ? (
        <Card className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-200 shadow-sm">
          <CardContent className="flex items-start gap-3.5 p-4">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">
                ⏳ Application & Document Verification Pending
              </h3>
              <p className="text-xs opacity-90 mt-1">
                Your profile and uploaded documents are currently being reviewed by the LocalShore
                Admin team. It will take up to 24 hours to review and wait for admin approval. Once
                approved, all delivery features will unlock automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification status</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {relevant.map((type) => {
            const doc = docs.find((d) => d.doc_type === type);
            const expiry = doc?.expiry_date ? new Date(`${doc.expiry_date}T23:59:59`) : null;
            const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
            const rawStatus = doc?.status ?? "missing";
            const displayStatus =
              partner.status === "approved" && doc && rawStatus !== "rejected"
                ? "approved"
                : rawStatus;

            return (
              <div key={type} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  {doc ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{DOC_LABELS[type] ?? type}</p>
                  <p
                    className={`text-xs ${daysLeft !== null && daysLeft <= 30 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {doc?.reviewer_note ??
                      (daysLeft === null
                        ? "Required"
                        : daysLeft < 0
                          ? `Expired ${doc.expiry_date}`
                          : `Expires ${doc.expiry_date} (${daysLeft} days)`)}
                  </p>
                </div>
                <StatusBadge status={displayStatus} kind="plain" />
                {doc ? (
                  <Button size="sm" variant="secondary" onClick={() => view(doc.file_path)}>
                    View
                  </Button>
                ) : null}
                <Input
                  type="date"
                  className="w-[150px]"
                  value={expiryByType[type] ?? doc?.expiry_date ?? ""}
                  onChange={(e) =>
                    setExpiryByType((current) => ({ ...current, [type]: e.target.value }))
                  }
                  aria-label={`${DOC_LABELS[type] ?? type} expiry date`}
                />
                <label className="cursor-pointer">
                  <Button size="sm" variant="ghost" asChild disabled={busy === type}>
                    <span>
                      <Upload className="mr-1 h-3.5 w-3.5" />
                      {doc ? "Replace" : "Upload"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(type, f, expiryByType[type] ?? doc?.expiry_date ?? undefined);
                    }}
                  />
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
