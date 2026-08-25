/**
 * Bootstrap: create the first super admin (and optionally the ops lead).
 * Usage:
 *   ADMIN_EMAIL=lead@codeygen.dev ADMIN_PASSWORD=... pnpm bootstrap
 */
import { ensureSuperAdmin, ensureOrganizer } from "../src/lib/bootstrap";
import { getDb } from "../src/lib/db";

const QUIZ_BANK: [string, string[], number][] = [
  ["What does the Docker command `docker ps` show?", ["Running containers", "All images in registry", "Docker version", "Networks"], 0],
  ["Which file defines instructions to build a Docker image?", ["Dockerfile", "docker-compose.yml", ".dockercfg", "Makefile"], 0],
  ["Jenkins is primarily a ___ server.", ["CI/CD", "Database", "Web hosting", "DNS"], 0],
  ["COPY and ADD differ because ADD can also…", ["Extract tar archives & fetch URLs", "Delete files", "Set env vars", "Change user"], 0],
  ["Which Jenkins file defines a pipeline as code?", ["Jenkinsfile", "jenkins.json", "pipeline.conf", "ci.yaml"], 0],
  ["`docker run -p 8080:80` maps…", ["Host 8080 to container 80", "Container 8080 to host 80", "UDP only", "Nothing"], 0],
  ["A Docker image is…", ["A read-only template of layers", "A running process", "A VM snapshot", "A volume"], 0],
  ["Which stage typically runs automated unit tests?", ["Test stage", "Deploy stage", "Cleanup stage", "Init stage"], 0],
  ["`docker stop` sends which signal by default?", ["SIGTERM", "SIGKILL", "SIGINT", "SIGHUP"], 0],
  ["Kubernetes is best described as…", ["Container orchestration platform", "Code editor", "Image registry", "Shell"], 0],
  ["In CI/CD, 'CD' commonly stands for…", ["Continuous Delivery/Deployment", "Code Deployer", "Central Daemon", "Change Directory"], 0],
  ["`EXPOSE` in a Dockerfile actually publishes the port.", ["False — it documents it", "True always", "Only on Linux", "Only with -P"], 0],
  ["Jenkins credentials are best stored…", ["In the credentials store", "Hardcoded in Jenkinsfile", "In Slack", "In the repo README"], 0],
  ["Docker layers are…", ["Cached and shared between builds", "Rebuilt every time", "Only for base images", "Random"], 0],
  ["Which is NOT a valid pipeline stage pattern?", ["Coffee break", "Build", "Test", "Deploy"], 0],
];

async function ensureQuizContent(): Promise<number> {
  const db = getDb();
  const existing = (await db.prepare(`SELECT COUNT(*) c FROM quiz_questions`).get()) as { c: number };
  if (existing.c > 0) return 0;
  const ins = db.prepare(`INSERT INTO quiz_questions (question, options, answer_idx) VALUES (?,?,?)`);
  for (const [q, o, a] of QUIZ_BANK) await ins.run(q, JSON.stringify(o), a);
  return QUIZ_BANK.length;
}

async function main() {
  getDb();
  const res = await ensureSuperAdmin();
  if (res.created) {
    console.log(`✓ Super Admin created: ${res.email}`);
  } else {
    console.log("• Super Admin already exists — skipping");
  }
  if (process.env.OPS_EMAIL && process.env.OPS_PASSWORD) {
    const ok = await ensureOrganizer(process.env.OPS_EMAIL, process.env.OPS_NAME || "Operations Lead", process.env.OPS_PASSWORD);
    console.log(ok ? `✓ Organizer created: ${process.env.OPS_EMAIL}` : `• Organizer already exists`);
  }
  const q = await ensureQuizContent();
  console.log(q > 0 ? `✓ Loaded ${q} trivia questions` : `• Trivia bank already loaded (${QUIZ_BANK.length} questions)`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ bootstrap failed:", e.message);
  process.exit(1);
});
