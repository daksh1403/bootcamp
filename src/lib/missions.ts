export type MissionCode = "M1" | "M2" | "M3" | "M4";
export const MISSION_ORDER: MissionCode[] = ["M1", "M2", "M3", "M4"];

export interface MissionDef {
  code: MissionCode;
  name: string;
  tagline: string;
  phase: string;
  estMinutes: number;
  summary: string;
  prerequisites: string[];
  steps: { title: string; detail: string; commands?: string[] }[];
  expectedOutcome: string;
  verificationRequirement: string;
  submissionFields: { key: string; label: string; placeholder?: string; required: boolean; type?: "text" | "url" }[];
  hints: [string, string, string];
  commonErrors: { error: string; fix: string }[];
  resources: { label: string; url: string }[];
}

export const MISSIONS: Record<MissionCode, MissionDef> = {
  M1: {
    code: "M1",
    name: "CONTAINERIZE",
    tagline: "Run it. Then own the image.",
    phase: "MISSION: CONTAINERIZE — Guided Docker Lab",
    estMinutes: 45,
    summary:
      "Pull and run a public Docker image, then build your own image from a Dockerfile for the sample app. You will finish this mission understanding images vs containers.",
    prerequisites: [
      "Docker Desktop / Engine running (`docker version` works)",
      "Git installed and your GitHub account ready",
      "Sample repository cloned (link below)",
    ],
    steps: [
      {
        title: "Level 1 — Run an existing image",
        detail:
          "Start with a public image to confirm your Docker installation works end-to-end. Run it, inspect it, stop it.",
        commands: [
          "docker run -d -p 8080:80 docker/getting-started",
          "docker ps",
          "docker stop $(docker ps -q)",
        ],
      },
      {
        title: "Level 2 — Build your own image",
        detail:
          "From the sample app folder (contains a Dockerfile), build a local image tagged with YOUR GitHub username so it is unique in the room.",
        commands: [
          "cd sample-app",
          'docker build -t <github-username>/sample-app:v1 .',
          "docker images",
        ],
      },
      {
        title: "Level 3 — Customize the application",
        detail:
          "Edit the app (change the headline text or port response) so the running container is visibly yours. Rebuild with a new tag v2.",
        commands: ['docker build -t <github-username>/sample-app:v2 .', "docker run -d -p 3000:3000 <github-username>/sample-app:v2"],
      },
      {
        title: "Level 4 — Fully containerize",
        detail:
          "Verify the container restarts cleanly, logs stream, and the app responds. This is the state M2 builds on.",
        commands: ["docker ps", "docker logs <container-id>", "curl http://localhost:3000"],
      },
    ],
    expectedOutcome:
      "`docker ps` shows your container running from an image you built yourself, and http://localhost:3000 serves your customized app.",
    verificationRequirement:
      "Submit your image tag and a short description of what you changed. A mentor verifies at your desk or reviews your submitted evidence.",
    submissionFields: [
      { key: "imageTag", label: "Docker image tag", placeholder: "e.g. daksh/sample-app:v2", required: true },
      { key: "portUrl", label: "Local URL where it runs", placeholder: "http://localhost:3000", required: false, type: "url" },
      { key: "notes", label: "What did you customize?", placeholder: "One line is enough", required: true },
    ],
    hints: [
      "Is the Docker daemon actually running? `docker version` must show both client AND server sections before anything else works.",
      "The build context matters: run `docker build` from inside the folder that contains the Dockerfile, and don't forget the trailing dot.",
      "Port collision? Another process owns :3000. Either stop it or map a different host port like `-p 3001:3000`.",
    ],
    commonErrors: [
      { error: "Cannot connect to the Docker daemon", fix: "Start Docker Desktop (Windows/macOS) or `sudo systemctl start docker` (Linux). Check it shows green/running." },
      { error: "port is already allocated", fix: "Something else uses that port. Use `lsof -i :3000` to find it, or bind another host port." },
      { error: "permission denied while trying to connect to Docker socket (Linux)", fix: "`sudo usermod -aG docker $USER`, log out and back in." },
      { error: "image not found / pull access denied", fix: "Check the image name spelling and tag. Public images need no login; typos are the usual cause." },
    ],
    resources: [
      { label: "Docker Getting Started", url: "https://docs.docker.com/get-started/" },
      { label: "Dockerfile reference", url: "https://docs.docker.com/reference/dockerfile/" },
    ],
  },
  M2: {
    code: "M2",
    name: "BUILD",
    tagline: "Write the Dockerfile. Read every layer.",
    phase: "CONTAINERIZE THE CHAOS — Build & Customize",
    estMinutes: 40,
    summary:
      "Open up the Dockerfile and make deliberate changes: base image, working directory, dependency install layers, exposed ports. Rebuild and prove the image works.",
    prerequisites: ["M1 VERIFIED", "Sample app building locally with your tag"],
    steps: [
      {
        title: "Read the existing Dockerfile",
        detail:
          "Identify FROM, WORKDIR, COPY, RUN, EXPOSE, CMD. Explain to your partner what each line does — mentors will ask.",
        commands: ["cat Dockerfile"],
      },
      {
        title: "Improve the build",
        detail:
          "Order COPY of package files before source code so dependency layers cache. Add a HEALTHCHECK or reduce image size with a slimmer base tag if applicable.",
        commands: ['docker build -t <github-username>/sample-app:v3 .', "docker images | head"],
      },
      {
        title: "Prove the image runs from a clean slate",
        detail:
          "Remove old containers first so you know the new image alone is doing the work.",
        commands: [
          "docker rm -f $(docker ps -aq)",
          "docker run -d --name m2-app -p 3000:3000 <github-username>/sample-app:v3",
          "docker logs -f m2-app",
        ],
      },
      {
        title: "Push your image (optional bonus)",
        detail:
          "If you have a Docker Hub account, push your image. Not required for verification.",
        commands: ["docker login", "docker push <github-username>/sample-app:v3"],
      },
    ],
    expectedOutcome:
      "An improved, rebuilt image (v3) running cleanly by itself, with faster rebuilds thanks to layer caching.",
    verificationRequirement:
      "Submit the final image tag plus one sentence describing the Dockerfile improvement you made.",
    submissionFields: [
      { key: "imageTag", label: "Final image tag (v3)", placeholder: "e.g. daksh/sample-app:v3", required: true },
      { key: "improvement", label: "Dockerfile change you made", placeholder: "e.g. split dependency copy for layer caching", required: true },
      { key: "repoUrl", label: "Repo URL (if pushed)", placeholder: "https://github.com/you/sample-app", required: false, type: "url" },
    ],
    hints: [
      "Layer caching: Docker invalidates a layer when its inputs change. COPY package.json + install FIRST, then COPY the rest of the code.",
      "`docker history <image>` shows every layer and its size — use it to see why your image is big.",
      "If the container exits immediately, run it without -d (`docker run --rm -it ...`) to see the crash output directly.",
    ],
    commonErrors: [
      { error: "COPY failed: file not found", fix: "You are probably in the wrong directory. Check the build context path after the dot in `docker build .`" },
      { error: "Container starts then exits instantly", fix: "The CMD process crashed. Run attached (-it) to read the stack trace." },
      { error: "npm/pip install fails during build", fix: "Network hiccup or lockfile mismatch. Retry the build; check the lockfile matches the runtime version in FROM." },
      { error: "'docker run' says image not found right after build", fix: "Tag typo. `docker images` and copy-paste the exact REPOSITORY:TAG." },
    ],
    resources: [
      { label: "Best practices for writing Dockerfiles", url: "https://docs.docker.com/build/building/best-practices/" },
      { label: "Build caching explained", url: "https://docs.docker.com/build/cache/" },
    ],
  },
  M3: {
    code: "M3",
    name: "AUTOMATE",
    tagline: "Green pipeline or it didn't happen.",
    phase: "AUTOMATE EVERYTHING — Jenkins Laboratory",
    estMinutes: 60,
    summary:
      "Wire your repo to Jenkins. Every push must automatically: build → test → build a Docker image → deploy. No more typing commands by hand.",
    prerequisites: ["M2 VERIFIED", "Jenkins accessible in the lab", "Your repo pushed to GitHub"],
    steps: [
      {
        title: "Connect GitHub → Jenkins",
        detail:
          "Create a Pipeline (or Freestyle) job pointing at your repository URL. If the repo is private, add credentials in Jenkins.",
        commands: ["# In Jenkins UI: New Item → Pipeline → set Git SCM to your repo URL"],
      },
      {
        title: "Define the pipeline stages",
        detail:
          "Use a Jenkinsfile with explicit stages. The lab template includes a starter Jenkinsfile — extend it, don't delete it.",
        commands: [
          "pipeline {",
          "  agent any",
          "  stages {",
          '    stage("Build") { steps { sh "npm ci || npm install" } }',
          '    stage("Test")  { steps { sh "npm test" } }',
          '    stage("Image") { steps { sh "docker build -t $USER/app:jenkins-$BUILD_NUMBER ." } }',
          '    stage("Deploy"){ steps { sh "docker rm -f app || true && docker run -d -p 3000:3000 $USER/app:jenkins-$BUILD_NUMBER" } }',
          "  }",
          "}",
        ],
      },
      {
        title: "Trigger the automated build",
        detail: "Click Build Now (or push a commit if webhooks are configured). Watch the stage view turn green, left to right.",
        commands: ["# Push a small commit to re-trigger: git commit --allow-empty -m \"trigger ci\" && git push"],
      },
      {
        title: "Demonstrate the successful pipeline",
        detail:
          "All four stages green + your app reachable on the deploy port = mission complete. Note down the Jenkins build number.",
        commands: ["curl http://localhost:3000"],
      },
    ],
    expectedOutcome:
      "A Jenkins job whose full run (build → test → image → deploy) is green, producing a deployed container tagged jenkins-<BUILD_NUMBER>.",
    verificationRequirement:
      "Submit the Jenkins build URL and build number. Mentor confirms green stages and the running container.",
    submissionFields: [
      { key: "jenkinsUrl", label: "Jenkins build URL", placeholder: "http://<jenkins-host>:8080/job/.../42/", required: true, type: "url" },
      { key: "buildNumber", label: "Build number", placeholder: "e.g. 7", required: true },
      { key: "notes", label: "Stages you implemented", placeholder: "build/test/image/deploy", required: true },
    ],
    hints: [
      "Jenkins can't reach your repo? It's almost always credentials or a proxy. Test the connection in the job's Git config section.",
      "Pipeline failed at the Image stage with 'docker: not found'? The Jenkins agent lacks Docker access — ask a mentor to check the node's docker group membership.",
      "Read the console output bottom-up: the real error is usually at the very end, not where the red starts.",
    ],
    commonErrors: [
      { error: "Jenkins plugin download fails / times out", fix: "Lab Wi-Fi congestion — mentors have offline plugin copies. Raise your hand instead of retry-looping." },
      { error: "GitHub authentication failed", fix: "Use a Personal Access Token (not your password) in Jenkins credentials. Check token scopes include repo access." },
      { error: "sh: npm: command not found", fix: "The Jenkins agent's PATH differs from yours. Configure NodeJS via tool installer or use a Docker agent." },
      { error: "Build fails but worked locally", fix: "Compare environments: node version, missing env vars, absolute paths. Console log shows exactly which command diverged." },
      { error: "Pipeline stuck on approval prompt", fix: "Someone added an input step. Skip it for the lab or ask a mentor about the checkpoint." },
    ],
    resources: [
      { label: "Jenkins Pipeline syntax", url: "https://www.jenkins.io/doc/book/pipeline/syntax/" },
      { label: "Jenkins + Docker", url: "https://www.jenkins.io/doc/book/pipeline/docker/" },
    ],
  },
  M4: {
    code: "M4",
    name: "SHIP IT",
    tagline: "Fresh app. No hand-holding. Deploy it.",
    phase: "SHIP IT CHALLENGE — Independent Final Deployment",
    estMinutes: 45,
    summary:
      "A brand-new sample application drops at challenge start. Containerize it, wire a Jenkins pipeline, test it, build the image, deploy it — completely on your own. Your reward: a unique deployment token served by your running app. Submit the token here to trigger official verification.",
    prerequisites: ["M3 VERIFIED", "Challenge started by organizers (timer running)"],
    steps: [
      { title: "Get the challenge repo", detail: "The challenge repository link unlocks when organizers start the clock. Clone it — it shares nothing with the guided-lab app.", commands: [] },
      { title: "Containerize", detail: "No Dockerfile provided this time. Write it from scratch.", commands: [] },
      { title: "Automate", detail: "Full pipeline again: build → test → image → deploy.", commands: [] },
      { title: "Deploy & retrieve your token", detail: "Once your app is live, fetch the token endpoint it exposes (instructions in the challenge README). The token is unique to your team.", commands: [] },
      { title: "Submit the token below", detail: "Correct tokens flip your status to DEPLOYED and stamp your deployment time for the leaderboard.", commands: [] },
    ],
    expectedOutcome:
      "Your team's unique token accepted by the platform, deployment time recorded, leaderboard position locked.",
    verificationRequirement:
      "Token verified server-side against your team's secret. Organizers may additionally review deployment proof and hold final authority to reject.",
    submissionFields: [
      { key: "token", label: "Deployment token", placeholder: "SHIP-XXXX-XXXX", required: true },
      { key: "deployedUrl", label: "Deployed app URL", placeholder: "http://localhost:3000", required: false, type: "url" },
      { key: "proof", label: "Proof notes (pipeline screenshot ref etc.)", placeholder: "optional", required: false },
    ],
    hints: [
      "Don't copy the guided lab blindly — the new app has a different structure. Read ITS README and ITS entrypoint first.",
      "Test stage failing? The challenge ships tests on purpose. Make them pass before fighting the deploy stage.",
      "Token endpoint returns 404? Your container is running the OLD image. Check the image tag your pipeline actually built.",
    ],
    commonErrors: [
      { error: "Token rejected as invalid", fix: "Copy-paste exactly, including the SHIP- prefix and dashes. Tokens are per-team — never borrow another team's." },
      { error: "Too many failed attempts", fix: "Attempts are rate-limited. Stop guessing; call a mentor to inspect your deployment." },
      { error: "App builds but tests fail in Jenkins only", fix: "Environment difference between local and agent — check versions pinned in the challenge README." },
      { error: "Deploy stage kills the previous container but the new one never starts", fix: "Read the run command output; likely port mapping conflicts with the still-shutting-down old container." },
    ],
    resources: [{ label: "Challenge repo (unlocks at start)", url: "#" }],
  },
};

export function nextMission(completed: Set<MissionCode>): MissionCode | null {
  for (const m of MISSION_ORDER) {
    if (!completed.has(m)) return m;
  }
  return null;
}

export function progressPercent(verified: number): number {
  return Math.round((verified / 4) * 100);
}

export const STATUS_LABELS: Record<string, string> = {
  locked: "LOCKED",
  available: "AVAILABLE",
  in_progress: "IN PROGRESS",
  submitted: "UNDER VERIFICATION",
  verified: "VERIFIED",
  failed: "FAILED",
};
