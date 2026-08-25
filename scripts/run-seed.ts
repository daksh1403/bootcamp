/** Dev-only demo seed runner. Refuses in production unless ALLOW_DEMO_SEED=1. */
import { seedDemo } from "./seed";

seedDemo()
  .then((r) => {
    console.log(`✓ Seeded ${r.participants} participants across ${r.teams} teams with varied progress.`);
    console.log("  Demo participant login: seed1@vitstudent.ac.in / demo1234");
    process.exit(0);
  })
  .catch((e) => {
    console.error("✗", e.message);
    process.exit(1);
  });
