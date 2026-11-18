/**
 * Suggested technologies and topics for projects (and opportunity topics). Picking from this
 * vocabulary keeps tags consistent, so the discover filters and matching find more overlap.
 * Members can still type anything; values go through the shared tag normalization.
 */

export type VocabularyGroup = { label: string; items: readonly string[] };

export const TECH_GROUPS: readonly VocabularyGroup[] = [
  {
    label: "Languages",
    items: ["JavaScript", "TypeScript", "Python", "Java", "Kotlin", "Swift", "Objective-C", "C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Scala", "Elixir", "Erlang", "Haskell", "Clojure", "F#", "Dart", "R", "Julia", "MATLAB", "Lua", "Perl", "Zig", "Solidity", "SQL", "Bash", "PowerShell", "WebAssembly"],
  },
  {
    label: "Frontend",
    items: ["React", "Next.js", "Vue.js", "Nuxt", "Angular", "Svelte", "SvelteKit", "SolidJS", "Astro", "Remix", "Qwik", "HTML", "CSS", "Sass", "Tailwind CSS", "Bootstrap", "Material UI", "shadcn/ui", "Chakra UI", "Redux", "Zustand", "TanStack Query", "GraphQL", "Apollo", "Vite", "Webpack", "Three.js", "D3.js", "Storybook", "Web Components"],
  },
  {
    label: "Backend & APIs",
    items: ["Node.js", "Express", "NestJS", "Fastify", "Deno", "Bun", "Django", "Flask", "FastAPI", "Spring Boot", "Quarkus", "Ruby on Rails", "Laravel", "Symfony", "ASP.NET Core", "Phoenix", "Gin", "Actix", "REST API", "gRPC", "tRPC", "WebSockets", "OpenAPI", "Microservices", "Serverless", "Event-driven architecture", "OAuth", "Keycloak", "Auth0", "Clerk"],
  },
  {
    label: "Mobile & desktop",
    items: ["iOS", "Android", "React Native", "Expo", "Flutter", "SwiftUI", "Jetpack Compose", "Ionic", "Capacitor", ".NET MAUI", "Electron", "Tauri", "Progressive Web App"],
  },
  {
    label: "Databases & storage",
    items: ["PostgreSQL", "MySQL", "MariaDB", "SQLite", "Microsoft SQL Server", "Oracle Database", "MongoDB", "Redis", "Cassandra", "DynamoDB", "Firestore", "Supabase", "Firebase", "Elasticsearch", "OpenSearch", "Neo4j", "ClickHouse", "Snowflake", "BigQuery", "Amazon Redshift", "Databricks", "DuckDB", "TimescaleDB", "InfluxDB", "CockroachDB", "PlanetScale", "Prisma", "Drizzle", "SQLAlchemy", "Hibernate", "Amazon S3", "MinIO"],
  },
  {
    label: "Cloud & DevOps",
    items: ["AWS", "Microsoft Azure", "Google Cloud", "Cloudflare", "Vercel", "Netlify", "Heroku", "DigitalOcean", "Fly.io", "Render", "Docker", "Kubernetes", "Helm", "Terraform", "Pulumi", "Ansible", "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Argo CD", "Nginx", "Linux", "Prometheus", "Grafana", "Datadog", "Sentry", "OpenTelemetry", "Kafka", "RabbitMQ", "NATS", "Istio", "AWS Lambda", "Cloud Run"],
  },
  {
    label: "AI & machine learning",
    items: ["Machine Learning", "Deep Learning", "Generative AI", "Large Language Models", "OpenAI API", "Claude API", "Gemini API", "Hugging Face", "LangChain", "LlamaIndex", "RAG", "Vector Databases", "Pinecone", "Weaviate", "pgvector", "AI Agents", "Prompt Engineering", "Fine-tuning", "PyTorch", "TensorFlow", "Keras", "JAX", "scikit-learn", "XGBoost", "OpenCV", "Computer Vision", "Natural Language Processing", "Speech Recognition", "Text-to-Speech", "Stable Diffusion", "Reinforcement Learning", "MLflow", "Weights & Biases", "ONNX", "Ollama", "MLOps", "Recommender Systems"],
  },
  {
    label: "Data & analytics",
    items: ["Data Science", "Data Engineering", "pandas", "NumPy", "Polars", "Apache Spark", "Apache Airflow", "dbt", "Apache Flink", "Jupyter", "Power BI", "Tableau", "Looker", "Metabase", "Google Analytics", "Mixpanel", "Amplitude", "PostHog", "Segment", "ETL", "Data Visualization", "Statistics", "A/B Testing"],
  },
  {
    label: "Testing & quality",
    items: ["Jest", "Vitest", "Playwright", "Cypress", "Selenium", "Testing Library", "pytest", "JUnit", "Postman", "k6", "Unit Testing", "End-to-end Testing", "Accessibility Testing", "Load Testing", "SonarQube"],
  },
  {
    label: "Security",
    items: ["Cybersecurity", "OWASP", "Penetration Testing", "Identity & Access Management", "Encryption", "Zero Trust", "SIEM", "Vulnerability Scanning", "Secrets Management", "Vault", "Compliance Automation", "Single Sign-On"],
  },
  {
    label: "Design & product tools",
    items: ["Figma", "FigJam", "Adobe XD", "Sketch", "Adobe Photoshop", "Adobe Illustrator", "Adobe After Effects", "Adobe Premiere Pro", "DaVinci Resolve", "Blender", "Cinema 4D", "Canva", "Framer", "Spline", "Lottie", "Aseprite", "Procreate", "Miro", "Notion", "Jira", "Linear", "Confluence", "Trello", "Asana", "ClickUp"],
  },
  {
    label: "Web platforms, CMS & e-commerce",
    items: ["WordPress", "Webflow", "Wix", "Squarespace", "Ghost", "Strapi", "Sanity", "Contentful", "Payload CMS", "Shopify", "WooCommerce", "Magento", "BigCommerce", "Medusa", "Stripe", "PayPal", "Adyen", "Mercado Pago", "Twilio", "SendGrid", "Mailchimp", "HubSpot", "Salesforce", "Zapier", "Make", "n8n", "Airtable", "Bubble", "Retool", "Algolia", "Mapbox", "Google Maps API", "OpenStreetMap"],
  },
  {
    label: "Blockchain & Web3",
    items: ["Blockchain", "Ethereum", "Solana", "Polygon", "Bitcoin", "Smart Contracts", "Hardhat", "Foundry", "Ethers.js", "IPFS", "NFTs", "DeFi"],
  },
  {
    label: "Games, AR & VR",
    items: ["Unity", "Unreal Engine", "Godot", "GameMaker", "Phaser", "Pygame", "Roblox", "WebGL", "WebXR", "ARKit", "ARCore", "Meta Quest", "Apple Vision Pro", "Pixel Art", "Procedural Generation", "Multiplayer Networking"],
  },
  {
    label: "Hardware, embedded & IoT",
    items: ["Arduino", "Raspberry Pi", "ESP32", "Embedded C", "RTOS", "MQTT", "LoRaWAN", "Bluetooth Low Energy", "PCB Design", "KiCad", "3D Printing", "CAD", "Robotics", "ROS", "Sensors", "FPGA", "Drones"],
  },
];

export const TOPIC_GROUPS: readonly VocabularyGroup[] = [
  {
    label: "Technology",
    items: ["Artificial Intelligence", "Machine Learning", "Generative AI", "Data & Analytics", "Cloud Computing", "Cybersecurity", "Developer Tools", "Open Source", "SaaS", "APIs", "Automation", "No-code", "Internet of Things", "Robotics", "Blockchain", "AR / VR", "Quantum Computing", "Edge Computing", "Infrastructure", "Low-code", "Platform Engineering"],
  },
  {
    label: "Business & finance",
    items: ["Fintech", "Payments", "Banking", "Insurtech", "Crypto", "Investing", "Accounting", "Proptech", "Real Estate", "Legaltech", "Regtech", "HR Tech", "Future of Work", "Productivity", "Collaboration", "Marketplaces", "B2B", "B2C", "Startups", "Small Business", "Creator Economy", "Freelancing"],
  },
  {
    label: "Commerce & marketing",
    items: ["E-commerce", "Retail", "Martech", "Adtech", "Growth", "Customer Experience", "CRM", "Loyalty", "Subscriptions", "Supply Chain", "Logistics", "Delivery", "Food & Beverage", "Fashion", "Beauty", "Travel", "Hospitality", "Events", "Ticketing"],
  },
  {
    label: "Health & science",
    items: ["Health", "Healthtech", "Digital Health", "Mental Health", "Wellness", "Fitness", "Nutrition", "Medtech", "Biotech", "Telemedicine", "Elderly Care", "Accessibility", "Life Sciences", "Science", "Research", "Space", "Neuroscience"],
  },
  {
    label: "Education & society",
    items: ["Education", "Edtech", "Online Learning", "Early Childhood", "Higher Education", "Skills & Careers", "Language Learning", "Social Impact", "Nonprofit", "Civic Tech", "Govtech", "Public Sector", "Democracy", "Human Rights", "Diversity & Inclusion", "Community", "Volunteering", "Philanthropy", "Housing", "Refugees & Migration"],
  },
  {
    label: "Climate & environment",
    items: ["Sustainability", "Climate", "Climate Tech", "Clean Energy", "Renewable Energy", "Energy Efficiency", "Electric Vehicles", "Circular Economy", "Recycling", "Water", "Agriculture", "Agtech", "Food Security", "Biodiversity", "Oceans", "Carbon Removal", "Green Buildings", "Smart Cities"],
  },
  {
    label: "Media & entertainment",
    items: ["Media", "Journalism", "Publishing", "Music", "Audio & Podcasts", "Video", "Streaming", "Film", "Photography", "Gaming", "Game Development", "Esports", "Sports", "Social Media", "Art & Culture", "Design", "Content Creation", "Storytelling"],
  },
  {
    label: "Industry & mobility",
    items: ["Mobility", "Transportation", "Automotive", "Aviation", "Maritime", "Manufacturing", "Industry 4.0", "Construction", "Mining", "Telecom", "Hardware", "Semiconductors", "Defense", "Security & Safety", "Pets", "Family & Parenting", "Dating", "Religion & Spirituality"],
  },
];

/** Shown first under the fields; the rest of the vocabulary is one "Show all" away. */
export const TECH_QUICK_PICKS = ["React", "Next.js", "TypeScript", "Python", "Node.js", "PostgreSQL", "Docker", "AWS", "Figma", "Flutter", "OpenAI API", "Kubernetes"] as const;
export const TOPIC_QUICK_PICKS = ["Artificial Intelligence", "Education", "Sustainability", "Fintech", "Health", "Open Source", "Social Impact", "E-commerce", "Developer Tools", "Climate", "Gaming", "SaaS"] as const;

export const TECH_VOCABULARY: readonly string[] = TECH_GROUPS.flatMap((g) => g.items);
export const TOPIC_VOCABULARY: readonly string[] = TOPIC_GROUPS.flatMap((g) => g.items);
