import { renderMissionPage } from "@/components/mission-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mission M1" };

export default function Page() {
  return renderMissionPage("M1");
}
