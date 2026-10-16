"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UserRound,
  ShieldCheck,
  Clock,
  MapPin,
  KeyRound,
  LogIn,
  CalendarDays,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  useToast,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";

interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  status: string;
  lastLogin?: string | null;
  createdAt: string;
  branch?: { id: string; name: string; address?: string } | null;
}

interface AttendanceRecord {
  id: string;
  clockIn: string;
  clockOut: string | null;
  shiftType?: string | null;
}

export default function ProfilePage() {
  const toast = useToast();
  const { user: authUser } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shift, setShift] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await api.get<Profile>("/auth/staff/profile");
      setProfile(me);
      try {
        const att = await api.get<{ data: AttendanceRecord[] }>(
          `/attendance?userId=${me.id}&limit=1`,
        );
        setShift(att.data?.[0] ?? null);
      } catch {
        setShift(null);
      }
    } catch {
      toast.error("Could not load your profile.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onShift = !!shift && !shift.clockOut;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.warning("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/staff/change-password", { currentPassword, newPassword });
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout title="Profile" subtitle="Your account, shift status and security">
      <div className="space-y-6">
        <PageHeader
          title="My Profile"
          description="Details for the signed-in staff account."
          icon={<UserRound className="w-5 h-5" />}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Account */}
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-600 text-white">
                <span className="text-sm font-bold">
                  {(authUser?.firstName?.[0] || "S") + (authUser?.lastName?.[0] || "")}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-navy-900">
                  {profile?.fullName || authUser?.firstName || "Staff"}
                </p>
                <p className="truncate text-sm text-slate-500">{profile?.email || authUser?.email}</p>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Role</dt>
                <dd>
                  <Badge tone="navy">
                    {(profile?.role || authUser?.role || "staff").replace("_", " ")}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Account status</dt>
                <dd>
                  <Badge tone={profile?.status === "active" ? "green" : "slate"} dot>
                    {profile?.status || "—"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500">
                  <PhoneIcon /> Phone
                </dt>
                <dd className="text-navy-900">{profile?.phone || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500">
                  <CalendarDays className="h-4 w-4" /> Member since
                </dt>
                <dd className="text-navy-900">{formatDateTime(profile?.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-slate-500">
                  <LogIn className="h-4 w-4" /> Last login
                </dt>
                <dd className="text-navy-900">{formatDateTime(profile?.lastLogin)}</dd>
              </div>
            </dl>

            {profile?.branch && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-navy-900">{profile.branch.name}</p>
                  {profile.branch.address && (
                    <p className="text-xs text-slate-500">{profile.branch.address}</p>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Shift + password */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <h3 className="text-sm font-semibold text-navy-900">Current Shift</h3>
                </div>
                {loading ? (
                  <Badge tone="slate">Checking…</Badge>
                ) : onShift ? (
                  <Badge tone="green" dot>On shift</Badge>
                ) : (
                  <Badge tone="slate" dot>Off shift</Badge>
                )}
              </div>
              {shift ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Clocked in</dt>
                    <dd className="text-navy-900">{formatDateTime(shift.clockIn)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Clocked out</dt>
                    <dd className="text-navy-900">
                      {shift.clockOut ? formatDateTime(shift.clockOut) : "— (still on shift)"}
                    </dd>
                  </div>
                  {shift.shiftType && (
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Shift type</dt>
                      <dd className="capitalize text-navy-900">{shift.shiftType}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No attendance record found. You may need to clock in from the admin portal.
                </p>
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-slate-400" />
                <h3 className="text-sm font-semibold text-navy-900">Change Password</h3>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <Input
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Input
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  hint="At least 6 characters"
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  error={
                    confirmPassword && confirmPassword !== newPassword
                      ? "Passwords do not match"
                      : undefined
                  }
                />
                <Button type="submit" loading={saving} disabled={!currentPassword || !newPassword}>
                  Update Password
                </Button>
              </form>
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Your counter transactions are logged against your account for auditing and shift reconciliation.
        </div>
      </div>
    </DashboardLayout>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
