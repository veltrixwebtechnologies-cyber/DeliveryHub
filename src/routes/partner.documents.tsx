import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, FileText, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const load = useCallback(async () => {
    if (!partner) return;
    const { data } = await db.from("delivery_documents").select("*").eq("partner_id", partner.id);
    setDocs(data ?? []);
  }, [partner?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(docType: string, file: File) {
    if (!partner) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Upload a PDF/JPEG/PNG/WebP file under 10 MB");
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
      { partner_id: partner.id, doc_type: docType, file_path: path, status: "pending" },
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
    const { data, error } = await supabase.storage
      .from("delivery-docs")
      .createSignedUrl(path, 120);
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification status</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {relevant.map((type) => {
            const doc = docs.find((d) => d.doc_type === type);
            return (
              <div key={type} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  {doc ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {DOC_LABELS[type] ?? type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc?.reviewer_note ??
                      (doc?.expiry_date ? `Expires ${doc.expiry_date}` : "Required")}
                  </p>
                </div>
                <StatusBadge status={doc?.status ?? "missing"} kind="plain" />
                {doc ? (
                  <Button size="sm" variant="secondary" onClick={() => view(doc.file_path)}>
                    View
                  </Button>
                ) : null}
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
                      if (f) upload(type, f);
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
