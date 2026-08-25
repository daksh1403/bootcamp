import SiteNav from "@/components/site-nav";
import { Panel } from "@/components/ui";
import { CopyButton } from "@/components/client-bits";

export const metadata = { title: "Setup Guide" };

function Cmd({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#0a0f15] border border-edge rounded px-3 py-2">
      <code className="font-mono text-[12px] text-[#c9d6e2] break-all">{children}</code>
      <CopyButton text={children} />
    </div>
  );
}

const CHECKLIST = [
  "Docker installed and running (docker version shows client AND server)",
  "`docker run hello-world` succeeds",
  "Git installed (git --version)",
  "GitHub account ready and you can log in",
  "git user.name and user.email configured",
  "Laptop charged + charger packed (4 GB RAM min, 8 GB preferred)",
];

export default function SetupPage() {
  return (
    <>
      <SiteNav />
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="font-mono text-xs text-muted tracking-[0.2em] mb-2">{"// sh pre-flight-setup.sh"}</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Pre-Event Setup Guide</h1>
        <p className="mt-3 text-muted max-w-2xl text-sm leading-relaxed">
          Complete this before event day. Every minute saved here is a minute spent deploying on Monday.
          Stuck? Bring the error to the lab — mentors will unblock you fast.
        </p>

        {/* OS Tabs as stacked sections */}
        <div className="mt-10 space-y-6">
          <Panel title="WINDOWS 10 / 11 — DOCKER DESKTOP" right={<span className="font-mono text-[10px] text-muted">WSL2 BACKEND</span>}>
            <ol className="space-y-3 text-sm list-decimal list-inside marker:font-mono marker:text-term-cyan">
              <li>Enable virtualization in BIOS if prompted (most VIT laptops have it on).</li>
              <li>Install <b>WSL2</b>: open PowerShell as Administrator and run the command below.</li>
              <li>Download <b>Docker Desktop for Windows</b> from docker.com, choose WSL2 backend during install.</li>
              <li>Launch Docker Desktop and wait for the whale icon to show “running”.</li>
            </ol>
            <div className="mt-4"><Cmd>wsl --install</Cmd></div>
          </Panel>

          <Panel title="MACOS — DOCKER DESKTOP">
            <ol className="space-y-3 text-sm list-decimal list-inside marker:font-mono marker:text-term-cyan">
              <li>Download <b>Docker Desktop for Mac</b> (Apple Silicon or Intel chip version).</li>
              <li>Drag to Applications, launch once, grant permissions.</li>
              <li>The menu-bar whale must say “Docker Desktop is running”.</li>
            </ol>
            <p className="mt-3 text-xs text-muted">Check your chip via  → About This Mac.</p>
          </Panel>

          <Panel title="LINUX — DOCKER ENGINE">
            <ol className="space-y-3 text-sm list-decimal list-inside marker:font-mono marker:text-term-cyan">
              <li>Install Docker Engine from your distro&apos;s official repository.</li>
              <li>Add yourself to the docker group so you don&apos;t need sudo each time.</li>
              <li>Log out and back in for group changes to apply.</li>
            </ol>
            <div className="mt-4 space-y-2">
              <Cmd>curl -fsSL https://get.docker.com | sudo sh</Cmd>
              <Cmd>sudo usermod -aG docker $USER</Cmd>
            </div>
          </Panel>

          <Panel title="GIT + GITHUB">
            <div className="space-y-2">
              <Cmd>git --version</Cmd>
              <Cmd>git config --global user.name &quot;Your Name&quot;</Cmd>
              <Cmd>git config --global user.email &quot;you@vitstudent.ac.in&quot;</Cmd>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[#b7c4d0]">
              <li>• Create/verify your GitHub account at github.com — note your exact username.</li>
              <li>• If your repo will be private in Jenkins later, generate a Personal Access Token (classic, repo scope) and keep it safe.</li>
            </ul>
          </Panel>

          <Panel title="HARDWARE REQUIREMENTS">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="border border-edge rounded p-3"><span className="font-mono text-xs text-term-cyan block">LAPTOP</span><span className="text-muted">Mandatory — no laptop, no mission.</span></div>
              <div className="border border-edge rounded p-3"><span className="font-mono text-xs text-term-cyan block">RAM</span><span className="text-muted">4 GB minimum · 8 GB preferred</span></div>
              <div className="border border-edge rounded p-3"><span className="font-mono text-xs text-term-cyan block">CHARGER</span><span className="text-muted">Bring it. Lab sockets are limited.</span></div>
            </div>
          </Panel>

          <section className="border border-term-green/30 bg-term-green/5 rounded-lg p-6">
            <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-term-green mb-4">Run this checklist before coming to the event</h2>
            <ol className="space-y-2 text-sm">
              {CHECKLIST.map((c, i) => (
                <li key={c} className="flex gap-3">
                  <span className="font-mono text-term-green shrink-0">{String(i + 1).padStart(2, "0")}</span>{c}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">
              Verify everything automatically at <a href="/health-check" className="text-term-cyan hover:underline font-mono">/health-check →</a>
            </p>
          </section>

          <Panel title="TROUBLESHOOTING QUICK HITS">
            <ul className="space-y-3 text-sm">
              <li><span className="font-mono text-term-red">Docker Desktop stuck starting</span><br /><span className="text-muted">Restart your machine once after first install — fixes 90% of cases.</span></li>
              <li><span className="font-mono text-term-red">WSL2 installation errors</span><br /><span className="text-muted">Run `wsl --update` then reboot. Ensure Windows is fully updated.</span></li>
              <li><span className="font-mono text-term-red">permission denied … docker.sock</span><br /><span className="text-muted">You skipped the docker-group step (Linux) or need to quit and reopen Docker Desktop.</span></li>
              <li><span className="font-mono text-term-red">Low disk space</span><br /><span className="text-muted">Free 10 GB+ before event day; images take room.</span></li>
            </ul>
          </Panel>
        </div>
      </main>
    </>
  );
}
