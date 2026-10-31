import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bike, Eye, EyeOff, Loader2 } from "lucide-react";
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

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sign in failed. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authSlow, setAuthSlow] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function verifyRecoveryCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "recovery",
        }),
        30_000,
        "Password recovery timed out. Please try again.",
      );
      if (error) throw error;
      if (!data.session) throw new Error("Recovery session was not established.");
      setPassword("");
      setConfirmPassword("");
      setRecoveryMode(true);
      setOtp("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Supabase can consume the recovery URL/hash before this route's effect is
    // mounted. Keep an explicit app marker in redirectTo and inspect both URL
    // formats so the reset form still opens when PASSWORD_RECOVERY was emitted
    // before we subscribed.
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (query.get("flow") === "partner-password-reset" || hash.get("type") === "recovery") {
      setRecoveryMode(true);
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAuthSlow(false);
    const slowTimer = window.setTimeout(() => setAuthSlow(true), 8_000);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        30_000,
        "Supabase sign-in did not respond within 30 seconds. Check Supabase Auth status and retry.",
      );
      if (error) throw error;
      if (!data.user) throw new Error("Sign in succeeded but no user session was returned.");
      await routeSignedInUser(data.user.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      window.clearTimeout(slowTimer);
      setBusy(false);
      setAuthSlow(false);
    }
  }

  async function routeSignedInUser(userId: string) {
    const [roleResult, partnerResult] = await withTimeout(
      Promise.all([
        db
          .from("user_roles")
          .select("role,status")
          .eq("user_id", userId)
          .eq("role", "admin")
          .eq("status", "active")
          .maybeSingle(),
        db
          .from("delivery_partners")
          .select("status,registration_step")
          .eq("user_id", userId)
          .maybeSingle(),
      ]),
      10_000,
      "Signed in, but account lookup did not respond within 10 seconds. Retry or check the Supabase project connection.",
    );
    if (roleResult.error) throw roleResult.error;
    if (partnerResult.error) throw partnerResult.error;
    const roleRow = roleResult.data;
    const partner = partnerResult.data;
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
    const redirectUrl = new URL("/auth", window.location.origin);
    redirectUrl.searchParams.set("flow", "partner-password-reset");
    try {
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl.toString(),
        }),
        30_000,
        "Password reset request timed out. Please try again.",
      );
      if (error) throw error;
      setResetSent(true);
      setOtp("");
      toast.success("Check your email for a password reset link or recovery code.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
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
    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ password }),
        30_000,
        "Password update timed out. Please try again.",
      );
      if (error) throw error;
      await supabase.auth.signOut();
      setRecoveryMode(false);
      setForgotPassword(false);
      setResetSent(false);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState({}, "", "/auth");
      toast.success("Password updated successfully.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const title = recoveryMode
    ? "Set a new password"
    : forgotPassword
      ? "Reset your password"
      : "Sign in";
  const description = recoveryMode
    ? "Choose a new password for your delivery partner account."
    : forgotPassword
      ? "Verify the recovery link or code from your email, then choose a new password."
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
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update password
                </Button>
              </form>
            ) : forgotPassword ? (
              <form
                className="space-y-4"
                onSubmit={resetSent ? verifyRecoveryCode : sendResetEmail}
              >
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={resetSent}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {resetSent ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Open the reset link in your email, or enter the recovery code below.
                    </p>
                    <Label htmlFor="recovery-code">Recovery code</Label>
                    <Input
                      id="recovery-code"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                ) : null}
                <Button
                  className="w-full"
                  disabled={busy || (resetSent && !/^\d{6,10}$/.test(otp))}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {resetSent ? "Verify code and reset password" : "Send recovery email"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-primary hover:underline"
                  onClick={() => {
                    setForgotPassword(false);
                    setResetSent(false);
                    setOtp("");
                  }}
                >
                  Back to sign in
                </button>
                {resetSent ? (
                  <button
                    type="button"
                    className="w-full text-sm text-primary"
                    onClick={() => {
                      setResetSent(false);
                      setOtp("");
                    }}
                  >
                    Change email / resend recovery email
                  </button>
                ) : null}
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                {busy && authSlow ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Supabase is responding slowly. Keep this page open while sign-in finishes.
                  </p>
                ) : null}
                <Button className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {busy ? "Connecting..." : "Sign in"}
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
