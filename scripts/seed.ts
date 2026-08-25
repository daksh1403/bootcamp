/**
 * Development-only seed: 10 teams / 20 participants with varied progress.
 * NEVER runs in production. Wipes participant/team/mission data first,
 * keeps admin accounts intact.
 */
import { getDb, now } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { ensureProgressRows, verifyMission } from "../src/lib/services/missions-service";
import { createTeam, addMember, generateToken } from "../src/lib/services/teams";
import { sha256, deploymentToken } from "../src/lib/ids";

const BRANCHES = ["CSE", "IT", "CSE-AI&ML", "AI&ML", "CSE-DS"];
const YEARS = ["2", "3", "2", "4", "3"];

export async function seedDemo(): Promise<{ participants: number; teams: number }> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data in production.");
  }
  const db = getDb();
  const t = now();

  // wipe event data (keep users that are organizers/super_admin)
  await db.exec(`DELETE FROM challenge_attempts; DELETE FROM verification_events; DELETE FROM mission_progress;
           DELETE FROM team_members; DELETE FROM certificates; DELETE FROM awards;
           DELETE FROM quiz_results; DELETE FROM announcements;
           DELETE FROM participants WHERE user_id IN (SELECT id FROM users WHERE role='participant');
           DELETE FROM users WHERE role='participant'; DELETE FROM teams;`);

  const passwordHash = await hashPassword("demo1234");
  const namesA = ["Aarav Sharma", "Diya Krishnan", "Rohan Iyer", "Sneha Nair", "Vikram Menon",
    "Ananya Rao", "Karthik Subramanian", "Priya Venkat", "Aditya Kumar", "Meera Pillai"];
  const namesB = ["Ishaan Gupta", "Tanvi Reddy", "Arjun Desai", "Kavya Balaji", "Nikhil Joshi",
    "Riya Chatterjee", "Sanjay Murthy", "Divya Ramesh", "Harish Selvam", "Lakshmi Narayanan"];

  const createdParticipants: number[] = [];
  for (let i = 0; i < 20; i++) {
    const name = i < 10 ? namesA[i] : namesB[i - 10];
    const email = `seed${i + 1}@vitstudent.ac.in`;
    const regNo = `26BCE${String(1000 + i)}`;
    const ui = (await db.prepare(`INSERT INTO users (email,password_hash,role,name,created_at) VALUES (?,?,?,?,?)`)
      .run(email, passwordHash, "participant", name, t));
    const pi = await db.prepare(
      `INSERT INTO participants (code,user_id,name,reg_no,email,phone,branch,year,ram,os,docker_installed,github_username,status,checked_in_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      `CYG26-S${String(i + 1).padStart(3, "0")}`, Number(ui.lastInsertRowid), name, regNo, email,
      `9${String(800000000 + i * 137)}`.slice(0, 10), BRANCHES[i % BRANCHES.length], YEARS[i % YEARS.length],
      i % 5 === 0 ? "4GB" : "8GB", i % 3 === 0 ? "Windows 11" : i % 3 === 1 ? "macOS" : "Linux",
      i % 4 === 0 ? "no" : "yes", `seeduser${i + 1}`,
      "checked_in", t - 3600_000, t, t
    );
    createdParticipants.push(Number(pi.lastInsertRowid));
  }

  for (let ti = 0; ti < 10; ti++) {
    const team = await createTeam(`Team ${ti + 1}`);
    await addMember(team.id, createdParticipants[ti]);
    await addMember(team.id, createdParticipants[ti + 10]);
    await ensureProgressRows(team.id);
    await generateToken(team.id, "seed");

    const scenario = ti % 5;
    const base = t - 90 * 60_000;
    try {
      if (scenario >= 1 || ti === 0) await verifyMission({ teamId: team.id, code: "M1", verifierLabel: "seed" });
      if (scenario >= 2) await verifyMission({ teamId: team.id, code: "M2", verifierLabel: "seed" });
      if (scenario >= 3) await verifyMission({ teamId: team.id, code: "M3", verifierLabel: "seed" });
      if (scenario >= 4) {
        (await db.prepare(`UPDATE teams SET challenge_started_at=? WHERE id=?`).run(base, team.id));
        const token = `SHIP-${sha256(String(ti)).slice(0, 4)}-${sha256(String(ti)).slice(4, 8)}`;
        void token;
        (await db.prepare(`UPDATE teams SET token_hash=?, token_hint=? WHERE id=?`)
          .run(sha256(deploymentToken()), "SEED", team.id));
        const realToken = (await db.prepare(`SELECT token_hash FROM teams WHERE id=?`).get(team.id)) as { token_hash: string };
        const hashMatch = realToken.token_hash;
        void hashMatch;
        // directly set deployment + verify to keep the seed deterministic
        await db.prepare(`UPDATE teams SET deployment_time=?, deployment_url=? WHERE id=?`).run(base + 30 * 60_000, `http://localhost:300${ti}`, team.id);
        (await db.prepare(`UPDATE mission_progress SET status='submitted', submitted_at=?, attempt_count=1 WHERE team_id=? AND mission_code='M4'`)
          .run(base + 30 * 60_000, team.id));
        await verifyMission({ teamId: team.id, code: "M4", verifierLabel: "seed" });
      }
    } catch {
      // scenarios tolerate partial progress
    }

    if (scenario === 0 && ti > 0) {
      // a couple of teams stuck at M1 with a failed M1 attempt
      if (ti === 1) {
        (await db.prepare(`UPDATE mission_progress SET status='failed', verifier_note='Container not running — check port mapping', updated_at=? WHERE team_id=? AND mission_code='M1'`)
          .run(t - 10 * 60_000, team.id));
      }
    }
  }

  // sample quiz questions
  const questions: [string, string[], number][] = [
    ["What does the Docker command `docker ps` show?", ["Running containers", "All images in registry", "Docker version", "Networks"], 0],
    ["Which file defines instructions to build a Docker image?", ["Dockerfile", "docker-compose.yml", ".dockercfg", "Makefile"], 0],
    ["Jenkins is primarily a ___ server.", ["CI/CD", "Database", "Web hosting", "DNS"], 0],
    ["COPY and ADD differ because ADD can also…", ["Extract tar archives & fetch URLs", "Delete files", "Set env vars", "Change user"], 0],
    ["Which Jenkins file defines a pipeline as code?", ["Jenkinsfile", "jenkins.json", "pipeline.conf", "ci.yaml"], 0],
    ["`docker run -p 8080:80` maps…", ["Host 8080 → container 80", "Container 8080 → host 80", "UDP only", "Nothing"], 0],
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
  for (const [q, opts, ans] of questions) {
    (await db.prepare(`INSERT INTO quiz_questions (question, options, answer_idx) VALUES (?,?,?)`).run(q, JSON.stringify(opts), ans));
  }

  return { participants: 20, teams: 10 };
}
