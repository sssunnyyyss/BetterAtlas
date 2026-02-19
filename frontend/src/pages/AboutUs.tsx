export default function AboutUs() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">About Us</h1>

      <div className="space-y-6 text-gray-700">
        <p className="text-lg">
          BetterAtlas was built by students, for students. We believe course selection shouldn't be
          stressful &mdash; it should be simple, social, and informed.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Our Mission</h2>
          <p>
            We're on a mission to make academic planning easier and more transparent. By combining
            course data, honest student reviews, and social features, BetterAtlas gives you the
            full picture before you register.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What We Offer</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Course Catalog</strong> &mdash; Browse every course with filters for GERs,
              ratings, and more
            </li>
            <li>
              <strong>Student Reviews</strong> &mdash; Read and write honest reviews about courses
              and professors
            </li>
            <li>
              <strong>Schedule Planner</strong> &mdash; Visualize and plan your semester schedule
            </li>
            <li>
              <strong>Social Features</strong> &mdash; See what your friends are taking and plan
              together
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Built at Emory</h2>
          <p>
            BetterAtlas is proudly built at Emory University. We started with a simple idea: course
            selection tools should work as hard as the students who use them.
          </p>
        </section>
      </div>
    </div>
  );
}
