import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bike, Package, ShieldCheck, Users, Wallet } from "lucide-react";
import { AppShell, EmptyState } from "@/components/delivery/AppShell";
import { StatCard } from "@/components/delivery/StatCard";
import { StatusBadge } from "@/components/delivery/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useIsAdmin, useSessionUser } from "@/hooks/usePartner";
import { DOC_LABELS, INR } from "@/lib/delivery";
import { DELIVERY_ORDER_SELECT, normalizeAssignment } from "@/lib/shared-orders";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Delivery admin — Local Shore" },
      {
        name: "description",
        content:
          "Approve delivery partners, review documents, monitor live deliveries and release rider payouts.",
      },
      { property: "og:title", content: "Delivery admin — Local Shore" },
      {
        property: "og:description",
        content: "Partner approvals, document verification, live delivery monitoring and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const user = useSessionUser();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [partners, setPartners] = useState<any[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: po }] = await Promise.all([
      db.from("delivery_partners").select("*").order("created_at", { ascending: false }),
      db
        .from("delivery_assignments")
        .select(`*, orders(${DELIVERY_ORDER_SELECT}), delivery_partners(full_name)`)
        .not("status", "in", "(delivered,cancelled,rejected,expired)")
        .order("created_at", { ascending: false }),
      db
        .from("delivery_payouts")
        .select("*, delivery_partners(full_name)")
        .order("created_at", { ascending: false }),
    ]);
    setPartners(p ?? []);
    setLive((l ?? []).map(normalizeAssignment));
    setPayouts(po ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user === undefined || isAdmin === undefined) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/partner" });
      return;
    }
    load();
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_assignments" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_partners" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, isAdmin, navigate, load]);

  async function openPartner(p: any) {
    setSelected(p);
    setNote(p.admin_note ?? "");
    const { data } = await db.from("delivery_documents").select("*").eq("partner_id", p.id);
    setDocs(data ?? []);
  }

  async function decide(status: "approved" | "rejected" | "info_requested" | "suspended") {
    if (!selected) return;
    const { error } = await db
      .from("delivery_partners")
      .update({
        status,
        admin_note: note || null,
        approved_at: status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await db.from("delivery_notifications").insert({
      partner_id: selected.id,
      title: `Application ${status.replace(/_/g, " ")}`,
      body: note || null,
      kind: "application",
    });
    toast.success(`Partner ${status.replace(/_/g, " ")}`);
    setSelected(null);
    load();
  }

  async function reviewDoc(docId: string, status: "verified" | "rejected") {
    await db.from("delivery_documents").update({ status }).eq("id", docId);
    setDocs((d) => d.map((x) => (x.id === docId ? { ...x, status } : x)));
  }

  async function viewDoc(path: string) {
    const { data } = await supabase.storage.from("delivery-docs").createSignedUrl(path, 120);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function markPaid(id: string) {
    await db
      .from("delivery_payouts")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Payout marked as paid");
    load();
  }

  if (loading || !isAdmin) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-12">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const pending = partners.filter((p) =>
    ["pending_verification", "info_requested"].includes(p.status),
  );
  const online = partners.filter((p) => p.availability === "online").length;

  return (
    <AppShell
      title="Local Shore Admin"
      nav={[{ to: "/admin", label: "Delivery operations", icon: <ShieldCheck className="h-4 w-4" /> }]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Partners" value={partners.length} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Pending approval" value={pending.length} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard label="Online now" value={online} icon={<Bike className="h-4 w-4" />} />
          <StatCard label="Live deliveries" value={live.length} icon={<Package className="h-4 w-4" />} />
        </div>

        {selected ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{selected.full_name}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Detail label="Mobile" value={selected.mobile} />
                <Detail label="Email" value={selected.email} />
                <Detail label="Vehicle" value={`${selected.vehicle_type ?? "—"} ${selected.vehicle_number ?? ""}`} />
                <Detail label="City" value={selected.city ?? "—"} />
                <Detail label="Aadhaar" value={selected.aadhaar_number ?? "—"} />
                <Detail label="PAN" value={selected.pan_number ?? "—"} />
                <Detail label="Bank" value={`${selected.bank_name ?? "—"} · ${selected.bank_ifsc ?? ""}`} />
                <Detail label="Employment" value={selected.employment_type ?? "—"} />
              </div>

              <div className="divide-y divide-border rounded-lg border border-border">
                {docs.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  docs.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-2 p-3">
                      <span className="flex-1 text-sm text-foreground">
                        {DOC_LABELS[d.doc_type] ?? d.doc_type}
                      </span>
                      <StatusBadge status={d.status} kind="plain" />
                      <Button size="sm" variant="secondary" onClick={() => viewDoc(d.file_path)}>
                        View
                      </Button>
                      <Button size="sm" onClick={() => reviewDoc(d.id, "verified")}>
                        Verify
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reviewDoc(d.id, "rejected")}>
                        Reject
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <Textarea
                placeholder="Note to the partner (shown on their dashboard)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => decide("approved")}>Approve</Button>
                <Button variant="secondary" onClick={() => decide("info_requested")}>
                  Request more info
                </Button>
                <Button variant="secondary" onClick={() => decide("suspended")}>
                  Suspend
                </Button>
                <Button variant="ghost" onClick={() => decide("rejected")}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="approvals">
          <TabsList>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="partners">All partners</TabsTrigger>
            <TabsTrigger value="live">Live deliveries</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="mt-4">
            {pending.length === 0 ? (
              <EmptyState title="Nothing pending" description="All partner applications are reviewed." />
            ) : (
              <PartnerTable rows={pending} onOpen={openPartner} />
            )}
          </TabsContent>

          <TabsContent value="partners" className="mt-4">
            <PartnerTable rows={partners} onOpen={openPartner} />
          </TabsContent>

          <TabsContent value="live" className="mt-4">
            {live.length === 0 ? (
              <EmptyState title="No live deliveries" description="Active pickups and drops appear here in realtime." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Shop</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {live.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.orders?.order_code}</TableCell>
                          <TableCell>{a.orders?.vendors?.shop_name}</TableCell>
                          <TableCell>{a.delivery_partners?.full_name ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            {payouts.length === 0 ? (
              <EmptyState title="No payouts yet" description="Weekly payout batches will appear here." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.delivery_partners?.full_name}</TableCell>
                          <TableCell>
                            {p.period_start} → {p.period_end}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} kind="plain" />
                          </TableCell>
                          <TableCell className="text-right">{INR(p.amount)}</TableCell>
                          <TableCell className="text-right">
                            {p.status !== "paid" ? (
                              <Button size="sm" onClick={() => markPaid(p.id)}>
                                <Wallet className="mr-1 h-3.5 w-3.5" /> Mark paid
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function PartnerTable({ rows, onOpen }: { rows: any[]; onOpen: (p: any) => void }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell>{p.mobile}</TableCell>
                <TableCell className="capitalize">{p.vehicle_type ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} kind="partner" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.availability} kind="partner" />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => onOpen(p)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
