import VerificationQueue from "@/components/verification-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification Queue" };

export default function AdminVerificationsPage() {
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// official verification — organizer authority"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Verification Queue</h1>
        <p className="text-sm text-muted mt-1">
          Verify stamps the timestamp, updates the dashboard + leaderboard + Excel export, and unlocks the next mission. Participants can never verify themselves.
        </p>
      </header>
      <VerificationQueue />
    </div>
  );
}
