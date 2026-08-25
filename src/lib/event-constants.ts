export const EVENT = {
  title: "DOCKER × JENKINS BOOTCAMP",
  subtitle: "THE DEVOPS DEPLOYMENT MISSION",
  motto: "CODE. CONTAINERIZE. AUTOMATE. DEPLOY.",
  hook: "Production is down. Can you ship the fix?",
  principle: "NO SPECTATORS. EVERYONE SHIPS.",
  date: "Monday, 31 August 2026",
  dateShort: "31 AUG 2026",
  venue: "AB1-404B Lab, VIT Chennai",
  organizer: "Code{Y}Gen — VIT Chennai",
  resourcePerson: "Rupayan Roy (24BAI1229)",
  capacity: 50,
  crew: [
    { name: "Daksh Agarwal", role: "Event Lead + Technical Mentor" },
    { name: "Karsha Vardhini Nagendran", role: "Operations Lead + Support Mentor" },
  ],
  audience:
    "CSE, IT, AI/ML, Cybersecurity, Cloud and backend-interested students. Ideal: 2nd–4th years; 1st years with basic programming welcome.",
  prerequisites: [
    "Basic programming in any language",
    "Basic Git recommended",
    "Laptop is mandatory",
    "Minimum 4 GB RAM — 8 GB preferred",
    "Docker/Jenkins knowledge NOT required",
  ],
} as const;

export const TIMELINE = [
  {
    time: "08:45 – 09:30",
    title: "ENTER THE PIPELINE",
    desc: "Registration check-in, Digital Mission Card activation and setup support.",
  },
  {
    time: "09:30 – 12:00",
    title: "CONTAINERIZE THE CHAOS",
    desc: "Expert session and live demonstrations by Rupayan Roy (24BAI1229).",
  },
  {
    time: "12:00 – 13:00",
    title: "MISSION: CONTAINERIZE",
    desc: "Guided Docker laboratory — M1 & M2 begin.",
  },
  {
    time: "13:00 – 14:00",
    title: "DEPLOYMENT WINDOW CLOSED",
    desc: "Lunch + DevOps trivia quiz.",
  },
  {
    time: "14:00 – 15:15",
    title: "AUTOMATE EVERYTHING",
    desc: "Jenkins laboratory — M3 pipelines go live.",
  },
  {
    time: "15:15 – 16:00",
    title: "SHIP IT CHALLENGE",
    desc: "Independent final deployment challenge — M4.",
  },
  {
    time: "16:00 – 16:45",
    title: "PRODUCTION LAUNCH",
    desc: "Q&A, careers discussion, awards and certificates.",
  },
] as const;
