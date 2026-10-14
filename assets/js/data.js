/* ============================================================================
   SITE DATA — single source of truth (warm-editorial light theme).
   Everything on the page renders from this object. Edit values here.
   ========================================================================== */

window.SITE = {
  profile: {
    name: "Jaskaran Singh",
    role: "Deputy Director",
    org: "National Informatics Centre · MeitY",
    orgFull: "National Informatics Centre, Ministry of Electronics & IT — Government of India",
    location: "New Delhi, India",
    photo: "assets/img/avatar.png",
    eyebrow: "Government technologist · New Delhi, India",
    // The three things that should land instantly. Rendered as bold hero badges.
    creds: [
      "Deputy Director — NIC, MeitY",
      "Part-time PhD Scholar — IIT Delhi",
      "ex-McKinsey Data Scientist",
    ],
    // Hero headline — serif. Kept short so it never overlaps.
    tagline: "Building India’s Open Government Data platform.",
    lede:
      "I’m a technology leader at the National Informatics Centre, working on data.gov.in — India’s national Open Government Data platform — with government departments, states, academia and industry. I head a multidisciplinary team that designs, builds and scales the platform.",
    lede2:
      "I’m also a part-time PhD scholar at IIT Delhi, researching satellite-based forest biodiversity monitoring, and was previously a Data Scientist at McKinsey & Company. I care about turning data engineering, analytics and AI/ML into governance that reaches citizens — and I still ship code.",
  },

  contact: {
    email: "jaskaran.pta@gmail.com",
    github: "https://github.com/sudo-karan",
    githubUser: "sudo-karan",
    linkedin: "https://www.linkedin.com/in/karan98",
    resume: "assets/Jaskaran_Singh_Resume.pdf",
    // Contact form. On Cloudflare (karan98.in) the browser hybrid-ENCRYPTS the
    // payload and posts it to the same-origin Function at `apiEndpoint`, which
    // derives IP/geo/ISP server-side and forwards to Apps Script — nothing
    // sensitive is readable in the browser and there are no third-party geo calls.
    // On the GitHub Pages mirror (no Functions) it falls back to posting an
    // OBFUSCATED blob straight to `fallbackEndpoint` (Apps Script), gathering geo
    // client-side. Either way the Network tab shows only an opaque blob.
    // See CONTACT_FORM_SETUP.md.
    apiEndpoint: "/api/contact",
    fallbackEndpoint: "https://script.google.com/macros/s/AKfycbx-6-WldWnNAUi5_32S-lzvAVF2ndzKoatiOGCeaAVbYQLNilbpnyMo2dE46pn7hXAO/exec",
    // RSA-OAEP public key (SPKI, base64). Public by design — the matching private
    // key lives ONLY in the Cloudflare Function env (PRIVATE_KEY). Used to wrap the
    // per-message AES key that encrypts the payload.
    publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1JMTLtINAoNvbqmYU1L+5x1rkx9hhvmhlsbWeTEmoZtaAZHKCSWih2fBnqY5ug/Z5DYIM2bb5/jJ7/cFp42fuAtgLDYZ/N8cNcRZJ61Lm22wciD3li9U1fpGfKGzoq2NrjvPTWnYDPVErfR65/ROIBBq2AQU60JRqLyed3qWabKW7MlXHJ5KD8ea1aobhWYB6qSe9ETCHcMVscQCR3glQUlvAhN5Y9YGQzfhJ4ndOnA3KSnuG+Otptx6p5FY+ebvVZkhOyTs9u5wDy1fwc30aDgK/XCCidI76enj9nm+rXx47RcPMCo2fnc3IhpcOIqzjMMs5Uc1gmoA8nmYhSKk5QIDAQAB",
    turnstileSiteKey: "0x4AAAAAADsvK3etT1iNEaDP",
  },

  nav: [
    { id: "building", label: "Now" },
    { id: "about", label: "About" },
    { id: "work", label: "Work" },
    { id: "experience", label: "Experience" },
    { id: "research", label: "Research" },
    { id: "contact", label: "Contact" },
  ],

  // "Building now" — the in-progress flagship, featured boldly near the top.
  building: {
    badge: "In progress",
    kicker: "Personal project · currently building",
    name: "An offline question-answering assistant for data.gov.in",
    blurb:
      "A retrieval-augmented chatbot for data.gov.in — India’s Open Government Data platform — that runs fully on a laptop: Ollama for the LLM, sentence-transformers for embeddings, ChromaDB as the vector store and FastAPI with streaming. A moderation gate and an intent classifier route each query to document search, live-data lookup or request filing; answers are grounded in retrieved sources, and out-of-scope questions are declined.",
    highlights: [
      "Runs fully offline — on a laptop",
      "Moderation gate + intent classifier",
      "Routes to doc search, live data or request filing",
      "Grounded answers; declines out-of-scope",
      "FastAPI with streaming",
    ],
    tech: ["Python", "Ollama", "sentence-transformers", "ChromaDB", "FastAPI"],
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
    "Part-time PhD · IIT Delhi",
    "ex-McKinsey Data Scientist",
  ],

  // Timeline entries (experience / internships / leadership) are org-first, like
  // the résumé: an org heading, a role progression (newest first — a role may
  // carry its own bullets), an optional italic summary, shared bullets and tags.
  experience: [
    {
      org: "National Informatics Centre",
      orgNote: "MeitY, Government of India",
      period: "Mar 2022 — Present",
      location: "New Delhi",
      current: true,
      roles: [
        { title: "Deputy Director", period: "Aug 2026 — Present" },
        { title: "Assistant Director", period: "Mar 2022 — Aug 2026" },
      ],
      summary: "Bharat Data Platform — data.gov.in, the Open Government Data Platform of India.",
      bullets: [
        "Head a multidisciplinary team that designs, builds and scales the platform; mentor the team and state partners on modern technologies, coding practice and data-publishing standards.",
        "Designing the next-generation platform: microservice decomposition, DCAT-3 metadata, an Apache APISIX API gateway, and disaster-recovery and backup planning.",
        "Build Apache Airflow pipelines on Kubernetes, including scheme feeds such as Jal Jeevan Mission and a monthly, checkpoint-resumable metadata-enrichment job — designed for lakhs of resources — that flags changed records for search re-indexing.",
        "Catalog and API clean-up programme (a unified Elasticsearch index and endpoints for the PMU): built a snapshot-diff tool that tracks each catalog’s state (linked, orphaned, absent) across database snapshots.",
        "Work on platform services: the visualisation API (PHP, MySQL), a FastAPI PII-detection service, the Feedback Management System, and the Elasticsearch cluster.",
      ],
      tags: ["Open Data", "Kubernetes", "Apache Airflow", "Elasticsearch", "Leadership"],
    },
    {
      org: "McKinsey & Company",
      orgNote: "Operations Digital Assets team",
      period: "Jan 2021 — Mar 2022",
      location: "Gurugram",
      roles: [
        {
          title: "Data Scientist", period: "Jul 2021 — Mar 2022",
          bullets: [
            "Developed pipelines for internal tools aimed at reducing the time client engagements take, and was responsible for developing and deploying tools for firm-wide access.",
            "Worked on data extraction, cleaning and processing, and on developing and deploying models, across client engagements.",
          ],
        },
        {
          title: "Intern", period: "Jan 2021 — Jul 2021",
          bullets: [
            "Built a system that takes documents of any type and extracts structured information for analytics; implemented a layout-extraction algorithm that improved the firm’s knowledge-extraction tools, and developed a working prototype for demonstration.",
          ],
        },
      ],
      tags: ["Document AI", "Data Pipelines", "ML"],
    },
  ],

  internships: [
    {
      org: "Sabudh Foundation",
      period: "Jul 2020 — Dec 2020",
      location: "SAS Nagar, Punjab",
      roles: [{ title: "Data Science Intern" }],
    },
    {
      org: "TheSmartBridge",
      orgNote: "SmartInternz",
      period: "Apr 2020 — May 2020",
      location: "Patiala · remote",
      roles: [{ title: "Internship project" }],
      bullets: ["Developed an intelligent customer help desk with smart document understanding."],
    },
    {
      org: "Infosys",
      period: "Jan 2019 — May 2019",
      location: "Mysuru",
      roles: [{ title: "Systems Engineer Intern" }],
      bullets: [
        "Built an email server from scratch, secured with salted hashing and AES-256 encryption, with QR-code access to details for administrators; shared its API with a peer team’s movie-ticketing project — the first team to combine two projects, which was recognised by mentors.",
      ],
    },
  ],

  leadership: [
    {
      org: "CDGC — Training & Placement Cell",
      orgNote: "PEC Chandigarh",
      period: "Jan 2020 — Jul 2021",
      location: "Chandigarh",
      roles: [
        { title: "Joint Head (M.Tech)", period: "Aug 2020 — Jul 2021" },
        { title: "Training Class Representative (M.Tech)", period: "Jan 2020 — Aug 2020" },
      ],
      bullets: [
        "Coordinated between students, faculty and the placement cell on recruitment and industry engagement; helped organise placement drives, internships and corporate outreach, and represented the M.Tech cohort in policy discussions.",
      ],
    },
  ],

  // Doctoral research — its own section.
  research: {
    title: "PhD, Computer Science",
    school: "IIT Delhi",
    mode: "Part-time",
    period: "Aug 2025 — Present",
    area: "Forest biodiversity monitoring from satellite data",
    thesis: "A Computational Framework for Forest Biodiversity Monitoring and Modeling",
    supervisor: "Prof. Aaditeshwar Seth",
    threads: [
      { title: "Forest stand delineation", text: "Built an unsupervised multi-sensor pipeline in Google Earth Engine (Sentinel-2 phenology, Sentinel-1 SAR, canopy height, terrain) using SNIC superpixels and k-means; tested at Sanjay Van (Delhi) and Mudumalai Tiger Reserve." },
      { title: "Foundation-model embeddings", text: "Extended the pipeline to cluster on AlphaEarth Foundations embeddings (Google DeepMind) as an alternative to hand-crafted features; a comparison of the two is planned." },
      { title: "Forest condition for rural planning", text: "Collaborating with the Foundation for Ecological Security on a forest-condition decision layer for rural-employment planning under VB-G RAM G; pilot scope Odisha and Rajasthan." },
    ],
    tags: ["Google Earth Engine", "Sentinel-1 / 2", "Remote sensing", "Clustering"],
    code: "https://github.com/sudo-karan/phd-code",
  },

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
      blurb: "An unsupervised, multi-sensor pipeline on Google Earth Engine that delineates forest stands from open satellite data — Sentinel-2 phenology, Sentinel-1 SAR, canopy height and terrain, segmented with SNIC superpixels and k-means. Tested at Sanjay Van (Delhi) and Mudumalai Tiger Reserve, and extended to Google DeepMind’s AlphaEarth Foundations embeddings.",
      tech: ["Google Earth Engine", "Sentinel-1/2", "SNIC + k-means", "Python"],
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
      name: "Breast Cancer Detection", category: "AI / ML & Research", badge: "Research · 2020",
      code: "https://github.com/sudo-karan",
      blurb: "A convolutional neural network classifier for mammograms with tuned hyper-parameters, paired with a GAN trained to generate synthetic mammograms that augment the original dataset.",
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
    { group: "Data & Backend", items: ["Python", "SQL", "Apache Airflow", "Elasticsearch", "MySQL", "FastAPI", "Drupal", "PHP"] },
    { group: "Platforms & APIs", items: ["Kubernetes", "Apache APISIX", "REST APIs", "DCAT", "Microservices", "Git", "Azure"] },
    { group: "AI / ML", items: ["Machine Learning", "CNNs & GANs", "LLMs & RAG", "Clustering", "NLP", "TensorFlow", "scikit-learn"] },
    { group: "Geospatial", items: ["Google Earth Engine", "Sentinel-1 / 2", "Remote Sensing"] },
    { group: "Web, Mobile & Systems", items: ["TypeScript / JS", "React", "PWAs", "Supabase", "Kotlin", "Jetpack Compose", "Java", "C", "CUDA"] },
    { group: "Leadership", items: ["Team Leadership", "Capacity Building", "Stakeholder Engagement", "Mentoring", "Program Management"] },
  ],

  interests: ["AI / ML", "NLP", "Geospatial analytics", "Open data", "Microservices", "Data security", "IoT"],

  education: [
    { degree: "PhD, Computer Science (part-time)", school: "Indian Institute of Technology Delhi", period: "Aug 2025 — Present", note: "Ongoing" },
    { degree: "M.Tech, Computer Science & Engineering", school: "Punjab Engineering College, Chandigarh", period: "2019 — 2021", note: "CGPA 9.60 / 10" },
    { degree: "B.Tech, Computer Science & Engineering", school: "Punjabi University, Patiala", period: "2015 — 2019", note: "CGPA 8.21 / 10" },
  ],

  certifications: [
    { name: "Microsoft Certified: Azure Data Fundamentals", issuer: "Microsoft" },
    { name: "Machine Learning with Python — Level 1", issuer: "IBM" },
    { name: "Cloud Core", issuer: "IBM" },
    { name: "Capstone: Retrieving, Processing, and Visualizing Data with Python (with Honors)", issuer: "University of Michigan · Coursera" },
    { name: "Using Databases with Python", issuer: "University of Michigan · Coursera" },
  ],

  languages: ["Punjabi — native", "Hindi — native", "English — professional working"],
};
