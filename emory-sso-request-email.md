**To:** Emory OIT / Identity & Access Management

**Subject:** Request for Emory SSO Integration Access - Student-Built Course Planning Tool (BetterAtlas)

---

Hi,

My name is [Your Name], and I'm an Emory [student/developer] working on **BetterAtlas**, a modern course discovery and planning platform built for Emory students. I'm writing to request access to Emory's SSO infrastructure so I can enable authenticated integration between BetterAtlas and OPUS, specifically to allow students to add courses directly to their OPUS shopping cart from within the app.

### What BetterAtlas Is

BetterAtlas is a student-built web application that gives Emory students a dramatically better experience for searching, evaluating, and planning their course schedules. The project is **developed collaboratively with AI** — I use AI-assisted development tools (Claude by Anthropic) throughout the engineering process, from architecture design and code generation to debugging and feature iteration. This has allowed a small team to build and maintain a system with capabilities that would traditionally require a much larger engineering effort.

The platform already integrates with Emory's Atlas FOSE API to sync live course data and includes:

- **AI-powered course recommendations** — a conversational advisor that uses OpenAI embeddings and semantic search to suggest courses based on a student's major, interests, and workload preferences
- **Full-text and semantic search** across all departments, so students can query naturally (e.g., "challenging CS course about machine learning") instead of memorizing course codes
- **Student ratings and reviews** — quality, difficulty, and workload scores from peers
- **Degree program tracking** — requirement data scraped from the Emory College catalog
- **Social features** — friend lists, shared wishlists, and course worksheets
- **Admin tools** — data sync monitoring, embedding management, and catalog update pipelines

The app requires an `.edu` email to register and follows security best practices (rate limiting, Helmet headers, httpOnly session cookies, bcrypt hashing, Zod input validation).

### Precedent at Peer Institutions

Student-built course tools with university SSO integration are well-established at peer institutions and have become essential parts of the student experience:

- **Yale — [CourseTable](https://coursetable.com/)**: Originally created in 2012, now maintained by the [Yale Computer Society](https://yalecomputersociety.org/) as a fully open-source project. CourseTable authenticates students through **Yale's CAS (Central Authentication Service)**, receives over **7 million server requests per month**, and is one of the most widely used student-created tools at Yale. It offers course evaluations, schedule building, friends features, and Google Calendar integration. ([Yale Daily News, 2024](https://yaledailynews.com/blog/2024/01/31/coursetable-grows-in-popularity-adds-new-features/))

- **Stanford — [Carta](https://carta-beta.stanford.edu/)**: A student-designed course planning platform that integrates Stanford's enrollment data, grade distributions, and faculty evaluations. What began as a student project is now **used by 95% of Stanford undergraduates** and has become the university's official course search and planning tool. ([Stanford Daily](https://stanforddaily.com/2016/11/27/carta-helps-students-plan-stanford-pathways/))

These examples show that when universities support student-built tools with SSO access and data integration, the result is software that genuinely improves the academic experience — often surpassing what official systems provide in terms of usability.

BetterAtlas aims to serve the same role for Emory. The key missing piece is SSO integration.

### Why SSO Access

Right now, students discover and evaluate courses in BetterAtlas but must manually switch to OPUS to actually register. With SSO integration, the workflow becomes seamless:

1. A student authenticates via Emory SSO (no separate BetterAtlas account needed)
2. They search, compare, and plan using BetterAtlas's enhanced tools and AI advisor
3. When ready, they push selected courses (by CRN) directly into their OPUS shopping cart

This bridges the gap between course discovery and course registration — the same pattern Yale's CourseTable follows with Yale CAS.

### What I'm Requesting

- Registration of BetterAtlas as a service provider with Emory's SSO/CAS system (or SAML/OAuth, depending on what Emory supports)
- Documentation on the SSO protocol, configuration requirements, and attribute mappings
- Guidance on whether OPUS exposes any API or session mechanism for programmatic shopping cart interaction on behalf of an authenticated user
- Information on any review or approval process required for student-developed integrations

I'm happy to provide a live demo, share the source code for security review, or meet to discuss technical details. The entire application is containerized (Docker) and built on a standard, auditable stack (React, Express, PostgreSQL, Redis).

Thank you for your time. I'd welcome any guidance on next steps or a referral to the appropriate team if this request should be directed elsewhere.

Best regards,
[Your Name]
[Your Emory Email]
[Optional: GitHub repo or live demo link]
