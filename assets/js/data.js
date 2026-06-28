/* ============================================================================
   SITE DATA — single source of truth.
   Everything on the page is rendered from this object. To update the site,
   edit values here; you almost never need to touch the HTML/CSS/JS.
   ========================================================================== */

window.SITE = {
  /* ---- identity / hero ---------------------------------------------------- */
  profile: {
    name: "Jaskaran Singh",
    handle: "sudo-karan",
    role: "Assistant Director",
    org: "National Informatics Centre · MeitY",
    orgUrl: "https://www.nic.gov.in/",
    location: "New Delhi, India",
    avatar: "assets/img/avatar.png",
    // Rotating one-liners typed out in the hero terminal.
    taglines: [
      "building India's Open Government Data platform",
      "turning public data into public value",
      "AI / ML · data engineering · e-governance at national scale",
      "ex-McKinsey Data Scientist · Govt. of India technologist",
      "ships products: web, Android, ML & systems",
    ],
    summary:
      "Technology leader working at the intersection of government, data innovation and emerging tech. I lead a multidisciplinary team at the National Informatics Centre (Govt. of India) building and scaling the national Open Government Data (OGD) platform — unlocking high-value datasets that drive transparency, accountability and innovation across ministries, states and industry. I care about turning data engineering, analytics and AI/ML into governance that actually reaches citizens.",
    // Short, scannable highlight chips under the about text.
    highlights: [
      "Open Government Data platform (data.gov.in)",
      "AI / ML & data-driven governance",
      "Ex-McKinsey Data Scientist",
      "Cloud-native · APIs · Elasticsearch",
      "Team leadership & capacity building",
    ],
  },

  /* ---- hero quick stats --------------------------------------------------- */
  stats: [
    { value: "4+", label: "Years at NIC, Govt. of India" },
    { value: "National", label: "Scale of OGD platform" },
    { value: "20+", label: "Projects shipped" },
    { value: "Full-stack", label: "Web · Android · ML · systems" },
  ],

  /* ---- contact / socials -------------------------------------------------- */
  contact: {
    email: "jaskaran.pta@gmail.com",
    github: "https://github.com/sudo-karan",
    linkedin: "https://www.linkedin.com/in/karan98",
    resume: "assets/Jaskaran_Singh_Resume.pdf",
  },

  /* ---- experience (most recent first) ------------------------------------- */
  experience: [
    {
      company: "National Informatics Centre, MeitY",
      title: "Assistant Director",
      period: "Mar 2022 — Present",
      location: "New Delhi",
      current: true,
      bullets: [
        "Head a multidisciplinary team designing, implementing and scaling the national Open Government Data (OGD) platform of India.",
        "Lead national-level data platform development — building scalable pipelines that publish high-quality, high-value datasets.",
        "Drive adoption of cloud-native architectures, APIs and search technologies (Elasticsearch, Drupal) across the platform.",
        "Partner with researchers, civic-tech groups and industry to apply open datasets to AI/ML, predictive analytics and decision-support.",
        "Train and mentor state partners and teams on modern engineering, coding best practices and data-publishing standards.",
      ],
      tags: ["e-Governance", "Data Platforms", "AI/ML", "Leadership"],
    },
    {
      company: "McKinsey & Company",
      title: "Data Scientist",
      period: "Jan 2021 — Mar 2022",
      location: "Gurugram, India",
      bullets: [
        "Delivered data-science engagements end to end — from problem framing to analytics and decision-support for clients.",
        "Built models and data pipelines that translated messy data into actionable business insight.",
      ],
      tags: ["Data Science", "Analytics", "Consulting"],
    },
    {
      company: "Training & Placement Cell, PEC",
      title: "Joint Head / Class Representative (M.Tech)",
      period: "Jan 2020 — Jul 2021",
      location: "Chandigarh, India",
      bullets: [
        "Core committee member coordinating recruitment, internships and corporate outreach for the M.Tech cohort.",
        "Primary liaison between students, faculty and recruiters; ran placement drives and readiness programs.",
      ],
      tags: ["Leadership", "Program Management"],
    },
    {
      company: "Sabudh Foundation",
      title: "Data Science Intern",
      period: "Jul 2020 — Dec 2020",
      location: "Mohali, India",
      bullets: [
        "Hands-on data-science research and applied ML projects under a social-impact mandate.",
      ],
      tags: ["Machine Learning", "Research"],
    },
    {
      company: "TheSmartBridge (SmartInternz)",
      title: "Internship Project",
      period: "Apr 2020 — May 2020",
      location: "Remote, India",
      bullets: [
        "Built an Intelligent Customer Help Desk with Smart Document Understanding using IBM Watson services.",
      ],
      tags: ["NLP", "IBM Watson"],
    },
    {
      company: "Infosys",
      title: "Systems Engineer",
      period: "Jan 2019 — May 2019",
      location: "Mysore, India",
      bullets: [
        "Systems engineering training and project work as part of the foundation program.",
      ],
      tags: ["Software Engineering"],
    },
  ],

  /* ---- projects ----------------------------------------------------------
     category drives the filter tabs. `featured: true` floats a card up and
     gives it the highlight treatment. `live` = a clickable deployed demo.
     ------------------------------------------------------------------------ */
  projectCategories: ["All", "Live", "Web / PWA", "Android", "AI / ML & Data", "Systems / HPC"],

  projects: [
    {
      name: "Boyle Bingo",
      category: "Web / PWA",
      featured: true,
      live: "https://sudo-karan.github.io/boyle-bingo/",
      code: "https://github.com/sudo-karan/boyle-bingo",
      blurb:
        "A private, multi-user prediction-bingo game shipped as an installable PWA. Realtime voting, a live leaderboard, and game rules enforced entirely in Postgres — Row-Level Security is the security boundary, so a player physically cannot read others' cards.",
      tags: ["React", "TypeScript", "Vite", "Supabase", "PWA", "RLS"],
    },
    {
      name: "PDF → Markdown (air-gapped)",
      category: "Web / PWA",
      featured: true,
      live: "https://sudo-karan.github.io/pdf-to-markdown/",
      code: "https://github.com/sudo-karan/pdf-to-markdown",
      blurb:
        "A 100% offline, browser-based PDF-to-Markdown converter — including raster images, vector diagrams and their captions. No servers, no APIs, no CDNs: disconnect from the network and it still works. Built for sensitive, air-gapped document workflows.",
      tags: ["JavaScript", "Offline-first", "PDF.js", "Privacy"],
    },
    {
      name: "Family FD Tracker",
      category: "Web / PWA",
      featured: true,
      live: "https://sudo-karan.github.io/family-dashboard/",
      code: "https://github.com/sudo-karan/family-dashboard",
      blurb:
        "A zero-maintenance web app that replaced a fragile multi-sheet Excel workbook for tracking fixed deposits across banks and people — dashboards, maturity alerts, inter-account transfers and CSV export, with a clean derived-field form.",
      tags: ["Web App", "Dashboard", "Data Modeling"],
    },
    {
      name: "Claude Usage",
      category: "Android",
      featured: true,
      code: "https://github.com/sudo-karan/claude-usage",
      blurb:
        "A premium, dark-first Android app that signs into your Claude account in an embedded WebView and surfaces your rolling usage limits — with a home-screen Glance widget, background reset notifications and a one-tap 'Ping Claude'. Cookies stored encrypted at rest.",
      tags: ["Kotlin", "Jetpack Compose", "Glance", "WorkManager"],
    },
    {
      name: "Goal Tracker",
      category: "Android",
      code: "https://github.com/sudo-karan/goal_tracker",
      blurb:
        "A lightweight, 100% offline Android app for the small commitments a calendar ignores — live countdowns, overlap detection, reboot-surviving exact-alarm reminders and a home-screen widget, all backed by a local Room database.",
      tags: ["Kotlin", "Room", "Notifications", "Widgets"],
    },
    {
      name: "fmu — Forest Management Units",
      category: "AI / ML & Data",
      featured: true,
      code: "https://github.com/sudo-karan/phd-code",
      badge: "Doctoral research",
      blurb:
        "A multi-sensor geospatial ML pipeline that delineates ecologically coherent forest stands from open satellite data. Runs server-side on Google Earth Engine — fusing Sentinel-2 phenology, Sentinel-1 radar, canopy height and terrain into per-pixel features, then segmentation. 11-stage runtime, all implemented.",
      tags: ["Google Earth Engine", "Python", "Sentinel-1/2", "Geospatial ML"],
    },
    {
      name: "Intelligent Customer Help Desk",
      category: "AI / ML & Data",
      code: "https://github.com/sudo-karan/Intelligent-Customer-Help-Desk-with-Smart-Document-Understanding",
      blurb:
        "An NLP-driven help desk with Smart Document Understanding built on IBM Watson — answering customer queries by understanding uploaded documents rather than relying on fixed FAQs.",
      tags: ["NLP", "IBM Watson", "Node.js"],
    },
    {
      name: "ML Notebook Portfolio",
      category: "AI / ML & Data",
      code: "https://github.com/sudo-karan?tab=repositories&q=&type=&language=jupyter+notebook",
      blurb:
        "A collection of applied ML projects — image classification & noise-reduction autoencoders (TensorFlow), employee-turnover prediction (scikit-learn), geolocation clustering and regression studies — built across internships and self-study.",
      tags: ["TensorFlow", "scikit-learn", "Keras", "NumPy"],
    },
    {
      name: "CUDA Parallel Computing",
      category: "Systems / HPC",
      code: "https://github.com/sudo-karan/parallel_assignment_2",
      blurb:
        "GPU-accelerated parallel-computing work in CUDA — exploring data-parallel algorithms and the memory/throughput trade-offs of high-performance computing on the GPU.",
      tags: ["CUDA", "C", "HPC", "Parallelism"],
    },
    {
      name: "Cornerstone Systems Project (COL7001)",
      category: "Systems / HPC",
      code: "https://github.com/sudo-karan/Cornerstone-Project-col7001-lab-1-and-2",
      blurb:
        "Low-level systems-programming labs in C — a multi-lab cornerstone project covering core systems concepts, written close to the metal.",
      tags: ["C", "Systems Programming"],
    },
    {
      name: "Text-Based Banking System",
      category: "Systems / HPC",
      code: "https://github.com/sudo-karan/Text-Based-Banking-System",
      blurb:
        "A console banking application combining Java and Python over an SQLite store — accounts, transactions and persistence in a single text-driven workflow.",
      tags: ["Java", "Python", "SQLite"],
    },
  ],

  /* ---- skills (grouped) --------------------------------------------------- */
  skills: [
    { group: "Languages", items: ["Python", "Java", "Kotlin", "TypeScript / JavaScript", "C", "CUDA", "SQL"] },
    { group: "AI / ML & Data", items: ["Machine Learning", "Deep Learning", "NLP", "TensorFlow", "scikit-learn", "Data Engineering", "Geospatial ML"] },
    { group: "Platforms & Cloud", items: ["Cloud-native architecture", "REST APIs", "Microservices", "Elasticsearch", "Drupal", "Azure", "Google Earth Engine"] },
    { group: "Web & Mobile", items: ["React", "Vite", "PWAs", "Jetpack Compose", "Supabase", "Offline-first apps"] },
    { group: "Leadership", items: ["Team leadership", "Program management", "Stakeholder engagement", "Capacity building", "Mentoring"] },
  ],

  /* ---- certifications ----------------------------------------------------- */
  certifications: [
    "Microsoft Certified: Azure Data Fundamentals",
    "Machine Learning with Python — Level 1",
    "Using Databases with Python",
    "Capstone: Retrieving, Processing & Visualizing Data with Python (with Honors)",
    "Cloud Core",
  ],

  /* ---- education ---------------------------------------------------------- */
  education: [
    {
      school: "PEC University of Technology, Chandigarh",
      degree: "M.Tech, Computer Science",
      period: "2019 — 2021",
    },
    {
      school: "Punjabi University, Patiala",
      degree: "B.Tech, Computer Engineering",
      period: "2015 — 2019",
    },
  ],
};
