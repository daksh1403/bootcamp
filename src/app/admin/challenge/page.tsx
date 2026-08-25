import ChallengeControl from "@/components/challenge-control";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ship It Control" };

export default async function AdminChallengePage() {
  const settings = await getSettings();
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// M4 — independent final deployment"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Ship It Challenge Control</h1>
      </header>
      <ChallengeControl challengeDurationMin={settings.challengeDurationMin} />
    </div>
  );
}
