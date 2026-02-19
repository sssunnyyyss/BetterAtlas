import { useState } from "react";
import { Link } from "react-router-dom";
import "./FAQ.css";

const faqs = [
  {
    id: "what_is_betteratlas",
    question: "What is BetterAtlas?",
    answer:
      "BetterAtlas is a course selection platform that helps students discover courses, read and write reviews, plan schedules, and connect with friends to make informed academic decisions.",
  },
  {
    id: "how_do_i_search_for_courses",
    question: "How do I search for courses?",
    answer:
      "Head to the Course Catalog to browse and filter courses by subject, GER requirements, ratings, and more. You can also search by course name or professor.",
  },
  {
    id: "can_i_see_what_friends_are_taking",
    question: "Can I see what courses my friends are taking?",
    answer:
      "Yes! Add friends on BetterAtlas to see their course lists and schedules. Visit the Friends page to find and connect with other students.",
  },
  {
    id: "how_do_course_reviews_work",
    question: "How do course reviews work?",
    answer:
      "After taking a course, you can leave a review with ratings for difficulty, workload, and overall quality. Reviews help other students make better decisions. All reviews are associated with your account.",
  },
  {
    id: "is_my_data_private",
    question: "Is my data private?",
    answer:
      "We take your privacy seriously. Your personal information is never sold. You can control what's visible to other users through your profile settings. See our Privacy Policy for full details.",
  },
  {
    id: "how_do_i_report_an_issue_or_suggest_a_feature",
    question: "How do I report an issue or suggest a feature?",
    answer:
      "Use the Feedback Hub to report bugs, suggest features, or share any other thoughts. We read every submission!",
  },
  {
    id: "who_runs_betteratlas",
    question: "Who runs BetterAtlas?",
    answer:
      "BetterAtlas is built and maintained by the BetterAtlas team as a student-focused project for better course discovery.",
  },
  {
    id: "who_can_use_betteratlas",
    question: "Who can use BetterAtlas?",
    answer:
      "BetterAtlas is currently available to Emory University students. Public beta sign-up is open with a valid account and no invite code required.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-primary-50/45 to-white">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 faq-page">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600/80">
          Support
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary-700 sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-gray-600">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link to="/feedback-hub" className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700">
            Send us feedback
          </Link>
          .
        </p>

        <div className="faq-list" role="list" aria-label="FAQ dropdowns">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.id} className="faq-item">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="faq-trigger"
                >
                  <span className="faq-questionText">
                    {faq.question}
                  </span>
                  <svg
                    className={`faq-chevron ${isOpen ? "faq-chevronOpen" : ""}`}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className={`faq-answerWrap ${isOpen ? "faq-answerWrapOpen" : ""}`}>
                  <div className="faq-answerInner">
                    <p className={`faq-answer ${isOpen ? "faq-answerOpen" : ""}`}>
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
