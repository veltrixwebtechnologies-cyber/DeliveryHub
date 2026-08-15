import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bike, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partner sign in — Local Shore Delivery" },
      {
        name: "description",
        content:
          "Sign in to your Local Shore delivery partner account to go online and accept nearby delivery requests.",
      },
      { property: "og:title", content: "Partner sign in — Local Shore Delivery" },
      {
        property: "og:description",
        content:
          "Approved delivery partners sign in here to manage deliveries, earnings and documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    await routeSignedInUser(data.user.id);
    setBusy(false);
  }

  async function routeSignedInUser(userId: string) {
    const [{ data: roleRow }, { data: partner }] = await Promise.all([
      db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      db
        .from("delivery_partners")
        .select("status,registration_step")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (roleRow) return void navigate({ to: "/admin" });
    if (!partner) return void navigate({ to: "/register" });
    if (partner.status === "draft") {
      toast.info("Finish your registration to continue.");
      return void navigate({ to: "/register" });
    }
    navigate({ to: "/partner" });
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setOtpSent(true);
    toast.success("Verification code sent to your email.");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return void toast.error("Enter the 6-digit verification code.");
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: "email",
    });
    if (error || !data.user) {
      setBusy(false);
      return void toast.error(error?.message ?? "That code could not be verified.");
    }
    await routeSignedInUser(data.user.id);
    setBusy(false);
  }

  async function sendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset link sent. Check your email.");
    setForgotPassword(false);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated successfully.");
    navigate({ to: "/partner" });
  }

  const title = recoveryMode
    ? "Set a new password"
    : forgotPassword
      ? "Reset your password"
      : "Sign in";
  const description = recoveryMode
    ? "Choose a new password for your delivery partner account."
    : forgotPassword
      ? "Enter your email and we will send you a secure reset link."
      : "Approved partners can go online and receive delivery requests.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bike className="h-5 w-5" />
          </span>
          <span className="font-semibold text-foreground">Local Shore Partners</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {recoveryMode ? (
              <form className="space-y-4" onSubmit={updatePassword}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update password
                </Button>
              </form>
            ) : forgotPassword ? (
              <form className="space-y-4" onSubmit={sendResetEmail}>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-primary hover:underline"
                  onClick={() => setForgotPassword(false)}
                >
                  Back to sign in
                </button>
              </form>
            ) : authMode === "otp" ? (
              <form className="space-y-4" onSubmit={otpSent ? verifyOtp : sendOtp}>
                <div className="space-y-2">
                  <Label htmlFor="otp-email">Email</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={otpSent}
                  />
                </div>
                {otpSent ? (
                  <div className="space-y-2">
                    <Label htmlFor="partner-otp">Verification code</Label>
                    <Input
                      id="partner-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                ) : null}
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {otpSent ? "Verify and sign in" : "Send one-time code"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-primary hover:underline"
                  onClick={() => {
                    setAuthMode("password");
                    setOtpSent(false);
                    setOtp("");
                  }}
                >
                  Use password instead
                </button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={signIn}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setForgotPassword(true)}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="block text-sm text-primary hover:underline"
                  onClick={() => setAuthMode("otp")}
                >
                  Sign in with OTP instead
                </button>
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            )}
            {!recoveryMode && !forgotPassword ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                New here?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Register as a delivery partner
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
