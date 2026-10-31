import { useState } from "react";
import { Database, RefreshCw, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isLocalDbEnabled } from "@/integrations/supabase/client";
import { pushLocalDbToSupabase, resetLocalDb } from "@/db";

export function LocalDbSyncWidget() {
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const isLocal = isLocalDbEnabled();

  if (!isLocal) return null;

  async function handleSync() {
    setSyncing(true);
    toast.loading("Syncing local database to Supabase Cloud...", { id: "sync-toast" });

    try {
      const report = await pushLocalDbToSupabase();
      if (report.success) {
        toast.success("Successfully pushed local data to Supabase Cloud!", {
          id: "sync-toast",
          description: `Synchronized ${Object.keys(report.tables).length} tables.`,
        });
      } else {
        const errorCount = Object.values(report.tables).filter((t) => t.error).length;
        toast.warning(`Sync completed with ${errorCount} table warning(s).`, {
          id: "sync-toast",
          description: "Check table permissions or RLS policies in Supabase.",
        });
      }
    } catch (err: any) {
      toast.error("Failed to sync to Supabase", {
        id: "sync-toast",
        description: err.message || "Network error",
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleReset() {
    if (confirm("Reset local database to initial clean seed state?")) {
      resetLocalDb();
      toast.success("Local DB reset to default seed data.");
      window.location.reload();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-72 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-foreground">Local DB Active</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Data is stored in browser storage. Zero email blocks, instant signups, and offline ready.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <Button
              size="sm"
              className="w-full justify-center gap-2 text-xs"
              onClick={handleSync}
              disabled={syncing}
            >
              <UploadCloud className={`h-3.5 w-3.5 ${syncing ? "animate-bounce" : ""}`} />
              {syncing ? "Pushing to Cloud..." : "Push DB to Supabase"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleReset}
            >
              <RefreshCw className="h-3 w-3" /> Reset Seed Data
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1.5 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur-md transition-all hover:bg-emerald-900/90 hover:scale-105"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>Local DB</span>
        </button>
      )}
    </div>
  );
}
