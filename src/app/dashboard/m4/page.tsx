import { renderMissionPage } from "@/components/mission-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mission M4" };

export default function Page() {
  return renderMissionPage("M4");
}
