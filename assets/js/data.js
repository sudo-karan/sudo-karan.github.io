/* ============================================================================
   SITE DATA — single source of truth (warm-editorial light theme).
   Everything on the page renders from this object. Edit values here.
   ========================================================================== */

window.SITE = {
  profile: {
    name: "Jaskaran Singh",
    role: "Assistant Director",
    org: "National Informatics Centre · MeitY",
    orgFull: "National Informatics Centre, Ministry of Electronics & IT — Government of India",
    location: "New Delhi, India",
    photo: "assets/img/avatar.png",
    eyebrow: "Government technologist · New Delhi, India",
    // The three things that should land instantly. Rendered as bold hero badges.
    creds: [
      "Assistant Director — NIC, MeitY",
      "PhD candidate — IIT Delhi",
      "ex-McKinsey Data Scientist",
    ],
    // Hero headline — serif. Kept short so it never overlaps.
    tagline: "Building India’s Open Government Data platform.",
    lede:
      "I work at the intersection of government, data and emerging technology. At the National Informatics Centre I lead the team building and scaling the national Open Government Data platform (data.gov.in) — unlocking high-value datasets that drive transparency and innovation across ministries, states and industry.",
    lede2:
      "I'm also a doctoral researcher (PhD) at IIT Delhi, and was previously a Data Scientist at McKinsey & Company. I care about turning data engineering, analytics and AI/ML into governance that reaches citizens — and I still ship code.",
  },

  contact: {
    email: "jaskaran.pta@gmail.com",
    github: "https://github.com/sudo-karan",
    githubUser: "sudo-karan",
    linkedin: "https://www.linkedin.com/in/karan98",
    resume: "assets/Jaskaran_Singh_Resume.pdf",
    // Contact form. Replace turnstileSiteKey with your real Cloudflare Turnstile
    // site key (see CONTACT_FORM_SETUP.md). The default is Turnstile's public
    // "always passes" TEST key so the form works on preview before setup.
    //
    // formEndpoint is the ABSOLUTE URL of the Cloudflare Pages Function so the
    // form works from ANY origin — including the GitHub Pages mirror
    // (sudo-karan.github.io), which can't run Functions itself. On karan98.in
    // this is just a same-origin request. Set it to your Cloudflare domain.
    formEndpoint: "https://karan98.in/api/contact",
    turnstileSiteKey: "0x4AAAAAADsvK3etT1iNEaDP",
  },

  nav: [
    { id: "building", label: "Now" },
    { id: "about", label: "About" },
    { id: "work", label: "Work" },
    { id: "experience", label: "Experience" },
    { id: "contact", label: "Contact" },
  ],

  // "Building now" — the in-progress flagship, featured boldly near the top.
  building: {
    badge: "In progress",
    kicker: "Currently building",
    name: "A RAG chatbot for data.gov.in",
    blurb:
      "A fully offline, retrieval-augmented chatbot for data.gov.in — India’s Open Government Data platform. Every part runs locally: LLM inference via Ollama, embeddings via sentence-transformers, and a persisted ChromaDB vector store — no external API calls at runtime. It answers strictly from official data.gov.in policy documents and auto-adapts to its host, from a laptop to a 32-core workstation to a GPU cloud VM.",
    highlights: [
      "100% offline / air-gapped",
      "Local LLM via Ollama",
      "RAG over official OGD policy docs",
      "REST API + SSE streaming + Docker",
      "Hardware-adaptive runtime",
    ],
    tech: ["Python", "Ollama", "ChromaDB", "sentence-transformers", "REST / SSE"],
    code: "https://github.com/sudo-karan/rag_chatbot",
  },

  stats: [
    { value: "4+", label: "Years at NIC, Govt. of India" },
    { value: "9.60", label: "M.Tech CGPA · PEC" },
    { value: "National", label: "Scale of the OGD platform" },
    { value: "20+", label: "Projects shipped" },
  ],

  // marquee / quick credibility line
  pillars: [
    "Open Government Data — data.gov.in",
    "AI / ML & Data Engineering",
    "PhD candidate · IIT Delhi",
    "ex-McKinsey Data Scientist",
  ],

  experience: [
    {
      role: "Assistant Director",
      org: "National Informatics Centre · MeitY",
      period: "Mar 2022 — Present",
      location: "New Delhi",
      current: true,
      summary: "Heading the team behind India’s national Open Government Data platform.",
      bullets: [
        "Design, build and scale data.gov.in — publishing high-value public datasets across ministries, states and organisations at national scale.",
        "Lead scalable data pipelines, cloud-native architecture, REST APIs and search (Elasticsearch, Drupal).",
        "Partner with researchers, civic-tech and industry to apply open data to AI/ML; mentor state partners on modern engineering and publishing standards.",
      ],
      tags: ["e-Governance", "Data Platforms", "AI/ML", "Leadership"],
    },
    {
      role: "Data Scientist — Operations Digital Assets",
      org: "McKinsey & Company",
      period: "Jan 2021 — Mar 2022",
      location: "Gurugram",
      summary: "Document-AI and internal tooling for the firm’s operations practice.",
      bullets: [
        "Built a system that ingests any document type and extracts structured information for analytics — a Layout Extraction Algorithm that improved the firm’s knowledge-extraction tools.",
        "Developed and deployed pipelines and tools that cut engagement time, accessible across the firm.",
        "End-to-end data science: extraction, cleaning, processing, modelling and deployment.",
      ],
      tags: ["Document AI", "Data Engineering", "ML"],
    },
    {
      role: "Data Science Intern",
      org: "Sabudh Foundation",
      period: "Jul 2020 — Dec 2020",
      location: "Mohali",
      summary: "Applied machine-learning research with a social-impact mandate.",
      bullets: ["Hands-on data-science research and applied ML projects under mentorship."],
      tags: ["Machine Learning", "Research"],
    },
    {
      role: "Systems Engineer (Intern)",
      org: "Infosys",
      period: "Jan 2019 — May 2019",
      location: "Mysore",
      summary: "Built secure communications infrastructure from first principles.",
      bullets: [
        "Built a mail server from scratch, secured with hashing, salting and 256-bit AES encryption, with QR-based admin access.",
        "First team to combine two independent projects by sharing our API — recognised by mentors.",
      ],
      tags: ["Systems", "Security", "APIs"],
    },
  ],

  // Project filter categories
  categories: ["All", "Web & PWA", "Android", "AI / ML & Research", "Systems"],

  projects: [
    {
      name: "Boyle Bingo", category: "Web & PWA", badge: "Live", live: "https://sudo-karan.github.io/boyle-bingo/",
      code: "https://github.com/sudo-karan/boyle-bingo", featured: true,
      blurb: "A private, multi-user prediction-bingo game shipped as an installable PWA — realtime voting and a live leaderboard, with every rule enforced in Postgres (Row-Level Security as the security boundary).",
      tech: ["React", "TypeScript", "Supabase", "PWA"],
    },
    {
      name: "PDF → Markdown", category: "Web & PWA", badge: "Live · Offline", live: "https://sudo-karan.github.io/pdf-to-markdown/",
      code: "https://github.com/sudo-karan/pdf-to-markdown", featured: true,
      blurb: "A 100% offline, browser-based PDF-to-Markdown converter — including images, vector diagrams and captions. No servers, no APIs: disconnect entirely and it still works. Built for air-gapped document workflows.",
      tech: ["JavaScript", "PDF.js", "Offline-first"],
    },
    {
      name: "fmu — Forest Management Units", category: "AI / ML & Research", badge: "Doctoral research",
      code: "https://github.com/sudo-karan/phd-code", featured: true,
      blurb: "A multi-sensor geospatial-ML pipeline on Google Earth Engine that delineates forest stands from open satellite data — fusing Sentinel-2 optical and Sentinel-1 radar with canopy height and terrain. An 11-stage runtime, fully implemented.",
      tech: ["Google Earth Engine", "Python", "Sentinel-1/2"],
    },
    {
      name: "Family FD Tracker", category: "Web & PWA", badge: "Live", live: "https://sudo-karan.github.io/family-dashboard/",
      code: "https://github.com/sudo-karan/family-dashboard",
      blurb: "A zero-maintenance web app replacing a fragile multi-sheet spreadsheet for tracking fixed deposits across banks and people — dashboards, maturity alerts, transfers and CSV export.",
      tech: ["Web App", "Dashboard"],
    },
    {
      name: "Claude Usage", category: "Android", badge: "Android",
      code: "https://github.com/sudo-karan/claude-usage",
      blurb: "A premium, dark-first Android app surfacing your Claude usage limits at a glance — a home-screen Glance widget, background reset notifications and one-tap ‘Ping Claude’.",
      tech: ["Kotlin", "Jetpack Compose", "WorkManager"],
    },
    {
      name: "Goal Tracker", category: "Android", badge: "Android · Offline",
      code: "https://github.com/sudo-karan/goal_tracker",
      blurb: "A 100% offline Android app for the small commitments a calendar ignores — live countdowns, overlap detection, reboot-surviving reminders and a home-screen widget.",
      tech: ["Kotlin", "Room", "Widgets"],
    },
    {
      name: "Breast Cancer Detection", category: "AI / ML & Research", badge: "Research",
      code: "https://github.com/sudo-karan",
      blurb: "A CNN detecting breast cancer from mammography images, paired with a GAN that synthesises samples to augment the dataset and push model accuracy.",
      tech: ["CNN", "GAN", "TensorFlow"],
    },
    {
      name: "Intelligent Help Desk", category: "AI / ML & Research", badge: "NLP",
      code: "https://github.com/sudo-karan/Intelligent-Customer-Help-Desk-with-Smart-Document-Understanding",
      blurb: "An NLP help desk with Smart Document Understanding on IBM Watson — answering queries by understanding uploaded documents rather than fixed FAQs.",
      tech: ["NLP", "IBM Watson"],
    },
    {
      name: "CUDA Parallel Computing", category: "Systems", badge: "HPC",
      code: "https://github.com/sudo-karan/parallel_assignment_2",
      blurb: "GPU-accelerated parallel-computing work in CUDA — data-parallel algorithms and the memory/throughput trade-offs of high-performance computing.",
      tech: ["CUDA", "C", "HPC"],
    },
    {
      name: "ML Notebook Portfolio", category: "AI / ML & Research", badge: "ML",
      code: "https://github.com/sudo-karan?tab=repositories&q=&type=&language=jupyter+notebook",
      blurb: "Applied ML studies — image classification and denoising autoencoders (TensorFlow), employee-turnover prediction (scikit-learn), clustering and regression.",
      tech: ["TensorFlow", "scikit-learn"],
    },
    {
      name: "Cornerstone Systems", category: "Systems", badge: "C · COL7001",
      code: "https://github.com/sudo-karan/Cornerstone-Project-col7001-lab-1-and-2",
      blurb: "Low-level systems-programming labs in C — a multi-lab cornerstone project written close to the metal.",
      tech: ["C", "Systems"],
    },
  ],

  skills: [
    { group: "Languages", items: ["Python", "Java", "Kotlin", "TypeScript / JS", "C", "CUDA", "SQL"] },
    { group: "AI · ML & NLP", items: ["Machine Learning", "Deep Learning", "NLP", "TensorFlow", "scikit-learn", "Geospatial ML"] },
    { group: "Platforms & Cloud", items: ["Cloud-native", "REST APIs", "Microservices", "Elasticsearch", "Drupal", "Azure", "Google Earth Engine"] },
    { group: "Web & Mobile", items: ["React", "Vite", "PWAs", "Jetpack Compose", "Supabase", "Offline-first"] },
    { group: "Data & Leadership", items: ["Data Engineering", "Team Leadership", "Program Management", "Capacity Building", "Mentoring"] },
  ],

  education: [
    { degree: "Doctoral Research (PhD), Computer Science", school: "Indian Institute of Technology (IIT) Delhi", period: "2025 — Present", note: "Ongoing" },
    { degree: "M.Tech, Computer Science & Engineering", school: "Punjab Engineering College, Chandigarh", period: "2019 — 2021", note: "9.60 CGPA" },
    { degree: "B.Tech, Computer Science & Engineering", school: "Punjabi University, Patiala", period: "2015 — 2019", note: "8.21 CGPA" },
  ],

  certifications: [
    "Microsoft Certified: Azure Data Fundamentals",
    "Machine Learning with Python — Level 1",
    "Using Databases with Python",
    "Capstone: Data with Python (with Honors)",
    "Cloud Core",
  ],

  languages: ["Punjabi — native", "Hindi — professional", "English — professional"],
};
