/* ============================================================================
   SITE DATA — single source of truth for "THE SUBSTRATE".
   Everything on the page (and the ⌘K command palette) renders from this object.
   To update the site, edit values here — you rarely touch HTML/CSS/JS.
   ========================================================================== */

window.SITE = {
  profile: {
    name: "Jaskaran Singh",
    handle: "sudo-karan",
    role: "Assistant Director",
    org: "National Informatics Centre · MeitY",
    orgFull: "National Informatics Centre, Ministry of Electronics & IT — Government of India",
    location: "New Delhi, India",
    since: "Mar 2022",
    avatar: "assets/img/avatar.png",

    statusLine: "ACTIVE · New Delhi · NIC, MeitY",
    // Headline is split on " / " into mask-revealed lines.
    headline: "Engineering India’s / data infrastructure.",
    subline:
      "Government-technology leader, full-stack engineer and researcher — building the national Open Government Data platform at data.gov.in scale.",
    // Mono console strip in the hero; each ticks up in sequence.
    readouts: [
      "OGD · data.gov.in · NATIONAL",
      "NIC, MeitY · since Mar 2022",
      "ex-McKinsey · M.Tech 9.60 CGPA",
      "systems shipped · 20+",
    ],

    summary:
      "I work at the intersection of government, data and emerging technology. At the National Informatics Centre I lead a multidisciplinary team building and scaling the national Open Government Data platform — unlocking high-value datasets that drive transparency, accountability and innovation across ministries, states and industry. Before this I was a Data Scientist at McKinsey & Company. I care about turning data engineering, analytics and AI/ML into governance that actually reaches citizens — and I still ship code.",
  },

  contact: {
    email: "jaskaran.pta@gmail.com",
    github: "https://github.com/sudo-karan",
    githubUser: "sudo-karan",
    linkedin: "https://www.linkedin.com/in/karan98",
    resume: "assets/Jaskaran_Singh_Resume.pdf",
  },

  // jump-nav + palette section index
  nav: [
    { id: "about", label: "Profile" },
    { id: "numbers", label: "Impact" },
    { id: "experience", label: "Career" },
    { id: "systems", label: "Systems" },
    { id: "research", label: "Research" },
    { id: "toolkit", label: "Toolkit" },
    { id: "contact", label: "Contact" },
  ],

  // Colossal editorial pull-quote figures. type: "num" counts up, "text" mask-reveals.
  numbers: [
    { figure: "NATIONAL", type: "text", caption: "Scale of the Open Government Data platform",     sub: "data.gov.in · ministries · states · citizens" },
    { figure: "9.60",     type: "num",  suffix: "", caption: "M.Tech CGPA — Punjab Engineering College", sub: "Computer Science · 2019–2021" },
    { figure: "AES-256",  type: "text", caption: "Secure mail server built from scratch",            sub: "hashing · salting · encryption — Infosys" },
    { figure: "4+",       type: "num",  suffix: " yrs", caption: "Serving the Government of India at NIC", sub: "since March 2022" },
  ],

  experience: [
    {
      year: "2022", current: true,
      role: "Assistant Director",
      org: "National Informatics Centre · MeitY",
      period: "Mar 2022 — Present", location: "New Delhi",
      standfirst: "Heading the team behind India’s national Open Government Data platform.",
      bullets: [
        { runin: "data.gov.in, at national scale.", text: "Design, build and scale the platform that publishes high-value public datasets across ministries, states and organisations." },
        { text: "Lead national data-platform development — scalable pipelines for high-quality, well-governed datasets." },
        { text: "Drive cloud-native architecture, REST APIs and search (Elasticsearch, Drupal); partner with researchers, civic-tech and industry to apply open data to AI/ML." },
        { text: "Mentor state partners and teams on modern engineering and data-publishing standards." },
      ],
      tags: ["e-Governance", "Data Platforms", "AI/ML", "Leadership"],
    },
    {
      year: "2021",
      role: "Data Scientist — Operations Digital Assets",
      org: "McKinsey & Company",
      period: "Jan 2021 — Mar 2022", location: "Gurugram",
      standfirst: "Document-AI and internal tooling for the firm’s operations practice.",
      bullets: [
        { runin: "A Layout Extraction Algorithm.", text: "Built a system that ingests any document type and extracts structured information for downstream analytics — improving the firm’s knowledge-extraction tools." },
        { text: "Developed and deployed pipelines and tools that cut the time an engagement takes, made easily accessible across the firm." },
        { text: "End-to-end data science: extraction, cleaning, processing, modelling and deployment." },
      ],
      tags: ["Document AI", "Data Engineering", "ML", "Deployment"],
    },
    {
      year: "2020",
      role: "Data Science Intern",
      org: "Sabudh Foundation",
      period: "Jul 2020 — Dec 2020", location: "Mohali",
      standfirst: "Applied machine-learning research with a social-impact mandate.",
      bullets: [
        { text: "Hands-on data-science research and applied ML projects under mentorship." },
      ],
      tags: ["Machine Learning", "Research"],
    },
    {
      year: "2019",
      role: "Systems Engineer (Intern)",
      org: "Infosys",
      period: "Jan 2019 — May 2019", location: "Mysore",
      standfirst: "Built secure communications infrastructure from first principles.",
      bullets: [
        { runin: "A mail server from scratch.", text: "Established a server to send and receive email, secured with hashing, salting and 256-bit AES encryption, with QR-based admin access." },
        { text: "First team to combine two independent projects — shared our API with a ticket-booking project — and were recognised by mentors for it." },
      ],
      tags: ["Systems", "Security", "APIs"],
    },
  ],

  // Deployed systems registry. status ∈ live | offline | research | source
  statusMeta: {
    live:     { label: "LIVE",            tone: "live" },
    offline:  { label: "OFFLINE-CAPABLE", tone: "offline" },
    research: { label: "RESEARCH",        tone: "research" },
    source:   { label: "SOURCE",          tone: "source" },
  },

  systems: [
    {
      name: "Boyle Bingo", category: "WEB & PWA", status: "live", flagship: true,
      blurb: "A private, multi-user prediction-bingo game shipped as an installable PWA. Realtime voting and a live leaderboard, with every game rule enforced in Postgres — Row-Level Security is the security boundary, so a player physically cannot read another’s card.",
      tech: ["React", "TypeScript", "Vite", "Supabase", "PWA"],
      badges: ["PWA", "RLS = SECURITY BOUNDARY"],
      live: "https://sudo-karan.github.io/boyle-bingo/", code: "https://github.com/sudo-karan/boyle-bingo",
    },
    {
      name: "PDF → Markdown", category: "WEB & PWA", status: "offline", flagship: true,
      blurb: "A 100% offline, browser-based converter from PDF to Markdown — including raster images, vector diagrams and their captions. No servers, no APIs, no CDNs: disconnect the network entirely and it still works. Built for sensitive, air-gapped document workflows.",
      tech: ["JavaScript", "PDF.js", "Offline-first"],
      badges: ["100% OFFLINE / AIR-GAPPED"],
      live: "https://sudo-karan.github.io/pdf-to-markdown/", code: "https://github.com/sudo-karan/pdf-to-markdown",
    },
    {
      name: "Family FD Tracker", category: "WEB & PWA", status: "live",
      blurb: "A zero-maintenance web app that replaced a fragile multi-sheet spreadsheet for tracking fixed deposits across banks and people — dashboards, maturity alerts, inter-account transfers and CSV export.",
      tech: ["Web App", "Dashboard", "Data Modeling"],
      badges: ["LIVE"],
      live: "https://sudo-karan.github.io/family-dashboard/", code: "https://github.com/sudo-karan/family-dashboard",
    },
    {
      name: "fmu — Forest Management Units", category: "AI · ML & RESEARCH", status: "research", flagship: true,
      blurb: "A multi-sensor geospatial-ML pipeline that delineates ecologically coherent forest stands from open satellite data on Google Earth Engine — fusing Sentinel-2 phenology, Sentinel-1 radar, canopy height and terrain into per-pixel features, then segmentation. An 11-stage runtime, fully implemented.",
      tech: ["Google Earth Engine", "Python", "Sentinel-1/2", "Geospatial ML"],
      badges: ["DOCTORAL RESEARCH"],
      code: "https://github.com/sudo-karan/phd-code",
    },
    {
      name: "Claude Usage", category: "ANDROID", status: "offline",
      blurb: "A premium, dark-first Android app that surfaces your Claude usage limits at a glance — a home-screen Glance widget, background reset notifications and a one-tap ‘Ping Claude’. Account cookies stored encrypted at rest.",
      tech: ["Kotlin", "Jetpack Compose", "Glance", "WorkManager"],
      badges: ["ANDROID · COMPOSE"],
      code: "https://github.com/sudo-karan/claude-usage",
    },
    {
      name: "Goal Tracker", category: "ANDROID", status: "offline",
      blurb: "A lightweight, 100% offline Android app for the small commitments a calendar ignores — live countdowns, overlap detection, reboot-surviving exact-alarm reminders and a home-screen widget, backed by a local Room database.",
      tech: ["Kotlin", "Room", "Widgets"],
      badges: ["100% OFFLINE"],
      code: "https://github.com/sudo-karan/goal_tracker",
    },
    {
      name: "Breast Cancer Detection", category: "AI · ML & RESEARCH", status: "research",
      blurb: "A convolutional neural network detecting breast cancer from mammography images, paired with a GAN trained to synthesise additional samples — augmenting the real dataset to push model accuracy.",
      tech: ["CNN", "GAN", "TensorFlow"],
      badges: ["RESEARCH"],
      code: "https://github.com/sudo-karan",
    },
    {
      name: "Intelligent Customer Help Desk", category: "AI · ML & RESEARCH", status: "source",
      blurb: "An NLP help desk with Smart Document Understanding on IBM Watson — answering queries by understanding uploaded documents rather than relying on fixed FAQs.",
      tech: ["NLP", "IBM Watson"],
      badges: ["SOURCE"],
      code: "https://github.com/sudo-karan/Intelligent-Customer-Help-Desk-with-Smart-Document-Understanding",
    },
    {
      name: "CUDA Parallel Computing", category: "SYSTEMS & HPC", status: "source",
      blurb: "GPU-accelerated parallel-computing work in CUDA — data-parallel algorithms and the memory/throughput trade-offs of high-performance computing on the GPU.",
      tech: ["CUDA", "C", "HPC"],
      badges: ["SOURCE"],
      code: "https://github.com/sudo-karan/parallel_assignment_2",
    },
    {
      name: "ML Notebook Portfolio", category: "AI · ML & RESEARCH", status: "source",
      blurb: "Applied ML studies — image classification and denoising autoencoders (TensorFlow), employee-turnover prediction (scikit-learn), geolocation clustering and regression.",
      tech: ["TensorFlow", "scikit-learn", "Keras"],
      badges: ["SOURCE"],
      code: "https://github.com/sudo-karan?tab=repositories&q=&type=&language=jupyter+notebook",
    },
    {
      name: "Cornerstone Systems (COL7001)", category: "SYSTEMS & HPC", status: "source",
      blurb: "Low-level systems-programming labs in C — a multi-lab cornerstone project written close to the metal.",
      tech: ["C", "Systems"],
      badges: ["SOURCE"],
      code: "https://github.com/sudo-karan/Cornerstone-Project-col7001-lab-1-and-2",
    },
  ],

  research: {
    kicker: "ONGOING DOCTORAL RESEARCH · GEOSPATIAL ML · GOOGLE EARTH ENGINE",
    title: "Fusing two satellites / to draw the forest.",
    body:
      "fmu delineates ecologically coherent forest stands from open satellite data. Two sensors that see the world differently — Sentinel-1 radar and Sentinel-2 optical — are registered and fused, then segmented into stands. Scroll to fuse the sensors.",
    layers: [
      { key: "s1", label: "SENTINEL-1 · SAR / RADAR" },
      { key: "s2", label: "SENTINEL-2 · OPTICAL" },
    ],
    pipeline: ["Ingest", "Mask", "Fuse", "Segment", "Delineate"],
    counterTo: 11, counterLabel: "runtime stages implemented",
    note: "Pipeline v1.1 — all 11 runtime stages implemented on Google Earth Engine.",
    code: "https://github.com/sudo-karan/phd-code",
  },

  toolkit: [
    { group: "Languages",          items: ["Python", "Java", "Kotlin", "TypeScript / JS", "C", "CUDA", "SQL"] },
    { group: "AI · ML & NLP",      items: ["Machine Learning", "Deep Learning", "NLP", "TensorFlow", "scikit-learn", "Geospatial ML"] },
    { group: "Platforms & Cloud",  items: ["Cloud-native", "REST APIs", "Microservices", "Elasticsearch", "Drupal", "Azure", "Google Earth Engine"] },
    { group: "Web & Mobile",       items: ["React", "Vite", "PWAs", "Jetpack Compose", "Supabase", "Offline-first"] },
    { group: "Data & Leadership",  items: ["Data Engineering", "Team Leadership", "Program Management", "Capacity Building", "Stakeholder Engagement"] },
  ],

  education: [
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
