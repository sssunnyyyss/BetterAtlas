import { db } from "./index.js";
import {
  departments,
  instructors,
  courses,
  sections,
  terms,
  courseRatings,
} from "./schema.js";

const TERMS = [
  { srcdb: "5249", name: "Fall 2024", season: "Fall", year: 2024, isActive: false },
  { srcdb: "5251", name: "Spring 2025", season: "Spring", year: 2025, isActive: false },
  { srcdb: "5259", name: "Fall 2025", season: "Fall", year: 2025, isActive: true },
] as const;

const DEPARTMENTS = [
  { code: "CS", name: "Computer Science" },
  { code: "MATH", name: "Mathematics" },
  { code: "ECON", name: "Economics" },
  { code: "PHYS", name: "Physics" },
  { code: "ENG", name: "English" },
  { code: "HIST", name: "History" },
  { code: "BIO", name: "Biology" },
  { code: "CHEM", name: "Chemistry" },
  { code: "PSYCH", name: "Psychology" },
  { code: "PHIL", name: "Philosophy" },
];

const COURSE_DATA: {
  dept: string;
  courses: {
    code: string;
    title: string;
    description: string;
    credits: number;
    instructor: string;
  }[];
}[] = [
  {
    dept: "CS",
    courses: [
      { code: "CS 101", title: "Introduction to Computer Science", description: "An introductory course covering fundamental concepts of programming and computational thinking.", credits: 3, instructor: "Dr. Alice Chen" },
      { code: "CS 201", title: "Data Structures", description: "Study of fundamental data structures including arrays, linked lists, trees, graphs, and hash tables.", credits: 3, instructor: "Dr. Bob Williams" },
      { code: "CS 301", title: "Algorithms", description: "Design and analysis of algorithms. Covers sorting, searching, graph algorithms, and dynamic programming.", credits: 3, instructor: "Dr. Carol Martinez" },
      { code: "CS 350", title: "Operating Systems", description: "Principles of operating system design including processes, memory management, and file systems.", credits: 3, instructor: "Dr. David Lee" },
      { code: "CS 360", title: "Database Systems", description: "Fundamentals of database design, SQL, query optimization, and transaction management.", credits: 3, instructor: "Dr. Alice Chen" },
      { code: "CS 370", title: "Computer Networks", description: "Study of network architectures, protocols, and distributed systems fundamentals.", credits: 3, instructor: "Dr. Eva Johnson" },
      { code: "CS 380", title: "Software Engineering", description: "Principles of software development, design patterns, testing, and project management.", credits: 3, instructor: "Dr. Frank Brown" },
      { code: "CS 401", title: "Machine Learning", description: "Introduction to supervised and unsupervised learning algorithms, neural networks, and model evaluation.", credits: 3, instructor: "Dr. Grace Kim" },
      { code: "CS 410", title: "Artificial Intelligence", description: "Foundations of AI including search, planning, knowledge representation, and reasoning.", credits: 3, instructor: "Dr. Grace Kim" },
      { code: "CS 450", title: "Computer Graphics", description: "Fundamentals of 2D and 3D graphics, rendering, and visualization techniques.", credits: 3, instructor: "Dr. Henry Park" },
    ],
  },
  {
    dept: "MATH",
    courses: [
      { code: "MATH 101", title: "Calculus I", description: "Limits, derivatives, and integrals of single-variable functions.", credits: 4, instructor: "Dr. Ian Smith" },
      { code: "MATH 102", title: "Calculus II", description: "Techniques of integration, sequences, series, and parametric equations.", credits: 4, instructor: "Dr. Ian Smith" },
      { code: "MATH 201", title: "Linear Algebra", description: "Vector spaces, linear transformations, matrices, and eigenvalues.", credits: 3, instructor: "Dr. Julia White" },
      { code: "MATH 301", title: "Real Analysis", description: "Rigorous treatment of limits, continuity, differentiation, and Riemann integration.", credits: 3, instructor: "Dr. Kevin Davis" },
      { code: "MATH 310", title: "Abstract Algebra", description: "Groups, rings, fields, and their homomorphisms.", credits: 3, instructor: "Dr. Julia White" },
      { code: "MATH 340", title: "Probability Theory", description: "Probability spaces, random variables, distributions, and limit theorems.", credits: 3, instructor: "Dr. Laura Wilson" },
      { code: "MATH 350", title: "Differential Equations", description: "Ordinary differential equations, systems of equations, and applications.", credits: 3, instructor: "Dr. Kevin Davis" },
      { code: "MATH 410", title: "Topology", description: "Point-set topology, connectedness, compactness, and metric spaces.", credits: 3, instructor: "Dr. Laura Wilson" },
      { code: "MATH 420", title: "Number Theory", description: "Properties of integers, primes, congruences, and Diophantine equations.", credits: 3, instructor: "Dr. Ian Smith" },
      { code: "MATH 450", title: "Numerical Analysis", description: "Numerical methods for solving equations, interpolation, and approximation.", credits: 3, instructor: "Dr. Kevin Davis" },
    ],
  },
  {
    dept: "ECON",
    courses: [
      { code: "ECON 101", title: "Principles of Microeconomics", description: "Supply and demand, market structures, consumer and producer behavior.", credits: 3, instructor: "Dr. Michael Chang" },
      { code: "ECON 102", title: "Principles of Macroeconomics", description: "National income, inflation, unemployment, and monetary policy.", credits: 3, instructor: "Dr. Nancy Taylor" },
      { code: "ECON 201", title: "Intermediate Microeconomics", description: "Consumer theory, producer theory, and general equilibrium analysis.", credits: 3, instructor: "Dr. Michael Chang" },
      { code: "ECON 301", title: "Econometrics", description: "Statistical methods for economic data analysis and hypothesis testing.", credits: 3, instructor: "Dr. Oscar Garcia" },
      { code: "ECON 310", title: "Game Theory", description: "Strategic decision-making, Nash equilibrium, and applications to economics.", credits: 3, instructor: "Dr. Nancy Taylor" },
      { code: "ECON 320", title: "International Economics", description: "Trade theory, exchange rates, and international monetary systems.", credits: 3, instructor: "Dr. Oscar Garcia" },
      { code: "ECON 330", title: "Labor Economics", description: "Labor markets, wages, employment, and human capital theory.", credits: 3, instructor: "Dr. Michael Chang" },
      { code: "ECON 401", title: "Public Economics", description: "Government policy, taxation, public goods, and welfare economics.", credits: 3, instructor: "Dr. Nancy Taylor" },
      { code: "ECON 410", title: "Financial Economics", description: "Asset pricing, portfolio theory, and financial market microstructure.", credits: 3, instructor: "Dr. Oscar Garcia" },
      { code: "ECON 450", title: "Development Economics", description: "Economic growth, poverty, inequality, and development policy.", credits: 3, instructor: "Dr. Michael Chang" },
    ],
  },
  {
    dept: "PHYS",
    courses: [
      { code: "PHYS 101", title: "General Physics I", description: "Mechanics, waves, and thermodynamics with calculus.", credits: 4, instructor: "Dr. Patricia Adams" },
      { code: "PHYS 102", title: "General Physics II", description: "Electricity, magnetism, optics, and modern physics.", credits: 4, instructor: "Dr. Patricia Adams" },
      { code: "PHYS 201", title: "Classical Mechanics", description: "Newtonian mechanics, Lagrangian and Hamiltonian formulations.", credits: 3, instructor: "Dr. Quincy Robinson" },
      { code: "PHYS 301", title: "Quantum Mechanics", description: "Wave functions, Schrodinger equation, and quantum measurement.", credits: 3, instructor: "Dr. Quincy Robinson" },
      { code: "PHYS 310", title: "Electrodynamics", description: "Maxwell's equations, electromagnetic waves, and radiation.", credits: 3, instructor: "Dr. Patricia Adams" },
      { code: "PHYS 320", title: "Thermodynamics & Statistical Mechanics", description: "Laws of thermodynamics, entropy, and statistical ensembles.", credits: 3, instructor: "Dr. Rachel Thompson" },
      { code: "PHYS 401", title: "Particle Physics", description: "Standard model, quarks, leptons, and fundamental interactions.", credits: 3, instructor: "Dr. Quincy Robinson" },
      { code: "PHYS 410", title: "Astrophysics", description: "Stellar structure, galaxies, cosmology, and general relativity.", credits: 3, instructor: "Dr. Rachel Thompson" },
    ],
  },
  {
    dept: "ENG",
    courses: [
      { code: "ENG 101", title: "Expository Writing", description: "Fundamentals of academic writing, argumentation, and critical analysis.", credits: 3, instructor: "Dr. Sarah Miller" },
      { code: "ENG 201", title: "American Literature", description: "Survey of American literature from the colonial period to the present.", credits: 3, instructor: "Dr. Sarah Miller" },
      { code: "ENG 210", title: "British Literature", description: "Major works of British literature from Beowulf to the modern era.", credits: 3, instructor: "Dr. Thomas Clark" },
      { code: "ENG 301", title: "Creative Writing", description: "Workshop-based course in fiction, poetry, and creative nonfiction.", credits: 3, instructor: "Dr. Thomas Clark" },
      { code: "ENG 310", title: "Shakespeare", description: "Study of Shakespeare's major plays and sonnets in historical context.", credits: 3, instructor: "Dr. Sarah Miller" },
      { code: "ENG 350", title: "Literary Theory", description: "Major schools of literary criticism and their applications.", credits: 3, instructor: "Dr. Thomas Clark" },
    ],
  },
  {
    dept: "HIST",
    courses: [
      { code: "HIST 101", title: "World History I", description: "Survey of world civilizations from prehistory to 1500.", credits: 3, instructor: "Dr. Uma Patel" },
      { code: "HIST 102", title: "World History II", description: "Survey of world history from 1500 to the present.", credits: 3, instructor: "Dr. Uma Patel" },
      { code: "HIST 201", title: "American History", description: "Political, social, and cultural history of the United States.", credits: 3, instructor: "Dr. Victor Huang" },
      { code: "HIST 301", title: "Modern European History", description: "Europe from the French Revolution to the present.", credits: 3, instructor: "Dr. Uma Patel" },
      { code: "HIST 310", title: "History of East Asia", description: "Political and cultural history of China, Japan, and Korea.", credits: 3, instructor: "Dr. Victor Huang" },
      { code: "HIST 350", title: "History of Science", description: "Development of scientific thought from antiquity to the modern era.", credits: 3, instructor: "Dr. Victor Huang" },
    ],
  },
  {
    dept: "BIO",
    courses: [
      { code: "BIO 101", title: "Introduction to Biology", description: "Fundamental principles of cell biology, genetics, and evolution.", credits: 4, instructor: "Dr. Wendy Zhang" },
      { code: "BIO 201", title: "Genetics", description: "Mendelian and molecular genetics, gene expression, and regulation.", credits: 3, instructor: "Dr. Wendy Zhang" },
      { code: "BIO 210", title: "Ecology", description: "Population ecology, community dynamics, and ecosystem processes.", credits: 3, instructor: "Dr. Xavier Nguyen" },
      { code: "BIO 301", title: "Molecular Biology", description: "DNA replication, transcription, translation, and gene regulation.", credits: 3, instructor: "Dr. Wendy Zhang" },
      { code: "BIO 310", title: "Cell Biology", description: "Cell structure, organelles, signaling, and cell division.", credits: 3, instructor: "Dr. Xavier Nguyen" },
      { code: "BIO 401", title: "Neuroscience", description: "Neural circuits, brain function, and neurological disorders.", credits: 3, instructor: "Dr. Xavier Nguyen" },
    ],
  },
  {
    dept: "CHEM",
    courses: [
      { code: "CHEM 101", title: "General Chemistry I", description: "Atomic structure, bonding, stoichiometry, and thermochemistry.", credits: 4, instructor: "Dr. Yolanda Rivera" },
      { code: "CHEM 102", title: "General Chemistry II", description: "Chemical kinetics, equilibrium, and electrochemistry.", credits: 4, instructor: "Dr. Yolanda Rivera" },
      { code: "CHEM 201", title: "Organic Chemistry I", description: "Structure, reactions, and mechanisms of organic compounds.", credits: 3, instructor: "Dr. Zachary Cooper" },
      { code: "CHEM 202", title: "Organic Chemistry II", description: "Advanced organic reactions, synthesis, and spectroscopy.", credits: 3, instructor: "Dr. Zachary Cooper" },
      { code: "CHEM 301", title: "Physical Chemistry", description: "Thermodynamics, quantum chemistry, and spectroscopy.", credits: 3, instructor: "Dr. Yolanda Rivera" },
      { code: "CHEM 401", title: "Biochemistry", description: "Structure and function of biomolecules, metabolism, and enzymology.", credits: 3, instructor: "Dr. Zachary Cooper" },
    ],
  },
  {
    dept: "PSYCH",
    courses: [
      { code: "PSYCH 101", title: "Introduction to Psychology", description: "Overview of major areas in psychology including cognition, development, and social behavior.", credits: 3, instructor: "Dr. Angela Foster" },
      { code: "PSYCH 201", title: "Cognitive Psychology", description: "Perception, attention, memory, language, and decision-making.", credits: 3, instructor: "Dr. Angela Foster" },
      { code: "PSYCH 210", title: "Developmental Psychology", description: "Physical, cognitive, and social development across the lifespan.", credits: 3, instructor: "Dr. Brian Scott" },
      { code: "PSYCH 301", title: "Social Psychology", description: "Social influence, group dynamics, attitudes, and prejudice.", credits: 3, instructor: "Dr. Brian Scott" },
      { code: "PSYCH 310", title: "Abnormal Psychology", description: "Classification, causes, and treatment of psychological disorders.", credits: 3, instructor: "Dr. Angela Foster" },
      { code: "PSYCH 401", title: "Research Methods", description: "Experimental design, statistical analysis, and research ethics.", credits: 3, instructor: "Dr. Brian Scott" },
    ],
  },
  {
    dept: "PHIL",
    courses: [
      { code: "PHIL 101", title: "Introduction to Philosophy", description: "Major philosophical questions about knowledge, reality, and ethics.", credits: 3, instructor: "Dr. Catherine Evans" },
      { code: "PHIL 201", title: "Ethics", description: "Normative ethical theories and their application to moral dilemmas.", credits: 3, instructor: "Dr. Catherine Evans" },
      { code: "PHIL 210", title: "Logic", description: "Formal logic, propositional and predicate calculus, and proof methods.", credits: 3, instructor: "Dr. Daniel Morgan" },
      { code: "PHIL 301", title: "Philosophy of Mind", description: "Consciousness, mental representation, and the mind-body problem.", credits: 3, instructor: "Dr. Daniel Morgan" },
      { code: "PHIL 310", title: "Epistemology", description: "Nature of knowledge, justification, and skepticism.", credits: 3, instructor: "Dr. Catherine Evans" },
      { code: "PHIL 350", title: "Philosophy of Science", description: "Scientific method, explanation, theory change, and realism.", credits: 3, instructor: "Dr. Daniel Morgan" },
    ],
  },
];

const SEMESTERS = ["Fall 2024", "Spring 2025", "Fall 2025"];
const DAYS_OPTIONS = [
  ["M", "W", "F"],
  ["T", "Th"],
  ["M", "W"],
  ["T", "Th", "F"],
];
const TIMES = [
  { start: "08:00", end: "08:50" },
  { start: "09:00", end: "09:50" },
  { start: "10:00", end: "10:50" },
  { start: "11:00", end: "11:50" },
  { start: "13:00", end: "13:50" },
  { start: "14:00", end: "14:50" },
  { start: "15:00", end: "15:50" },
  { start: "16:00", end: "16:50" },
];
const BUILDINGS = ["Science Hall", "Arts Building", "Main Hall", "Library", "Engineering Center", "Social Sciences", "Humanities"];

async function seed() {
  console.log("Seeding database...");

  // Terms
  await db.insert(terms).values(TERMS as any).onConflictDoNothing();

  // Departments
  const deptRows = await db.insert(departments).values(DEPARTMENTS).returning();
  const deptMap = new Map(deptRows.map((d) => [d.code, d.id]));
  console.log(`Inserted ${deptRows.length} departments`);

  // Instructors & Courses
  let totalCourses = 0;
  let totalSections = 0;

  for (const deptData of COURSE_DATA) {
    const deptId = deptMap.get(deptData.dept)!;

    for (const c of deptData.courses) {
      // Insert instructor
      const [instructor] = await db
        .insert(instructors)
        .values({ name: c.instructor, departmentId: deptId })
        .returning();

      // Insert course
      const [course] = await db
        .insert(courses)
        .values({
          code: c.code,
          title: c.title,
          description: c.description,
          credits: c.credits,
          departmentId: deptId,
        })
        .returning();
      totalCourses++;

      // Insert sections for each semester
      for (const semester of SEMESTERS) {
        const termCode =
          TERMS.find((t) => t.name === semester)?.srcdb ??
          (() => {
            throw new Error(`missing term mapping for ${semester}`);
          })();

        const numSections = Math.ceil(Math.random() * 2);
        for (let s = 1; s <= numSections; s++) {
          const days = DAYS_OPTIONS[Math.floor(Math.random() * DAYS_OPTIONS.length)];
          const time = TIMES[Math.floor(Math.random() * TIMES.length)];
          const building = BUILDINGS[Math.floor(Math.random() * BUILDINGS.length)];
          const room = Math.floor(Math.random() * 400) + 100;

          const dayToNum: Record<string, number> = {
            M: 0,
            T: 1,
            W: 2,
            Th: 3,
            R: 3,
            F: 4,
          };

          const startTime = time.start.replace(":", "");
          const endTime = time.end.replace(":", "");
          const location = `${building} ${room}`;
          const meetings = days.map((d) => ({
            day: dayToNum[d] ?? 0,
            startTime,
            endTime,
            location,
          }));

          await db.insert(sections).values({
            courseId: course.id,
            termCode,
            crn: String(10000 + totalSections),
            sectionNumber: String(s).padStart(3, "0"),
            instructorId: instructor.id,
            meetings,
            meetsDisplay: `${days.join("")} ${time.start}-${time.end}`,
            enrollmentCap: 30 + Math.floor(Math.random() * 70),
            enrollmentCur: Math.floor(Math.random() * 30),
          });
          totalSections++;
        }
      }
    }
  }

  console.log(`Inserted ${totalCourses} courses`);
  console.log(`Inserted ${totalSections} sections`);

  // Initialize empty course_ratings for all courses
  const allCourses = await db.select({ id: courses.id }).from(courses);
  for (const c of allCourses) {
    await db
      .insert(courseRatings)
      .values({
        courseId: c.id,
        avgQuality: null,
        avgDifficulty: null,
        avgWorkload: null,
        reviewCount: 0,
      })
      .onConflictDoNothing();
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
