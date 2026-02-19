import { useState } from "react";
import { Link } from "react-router-dom";

const faqs = [
  {
    question: "What is BetterAtlas?",
    answer:
      "BetterAtlas is a course selection platform that helps students discover courses, read and write reviews, plan schedules, and connect with friends to make informed academic decisions.",
  },
  {
    question: "How do I search for courses?",
    answer:
      "Head to the Course Catalog to browse and filter courses by subject, GER requirements, ratings, and more. You can also search by course name or professor.",
  },
  {
    question: "Can I see what courses my friends are taking?",
    answer:
      "Yes! Add friends on BetterAtlas to see their course lists and schedules. Visit the Friends page to find and connect with other students.",
  },
  {
    question: "How do course reviews work?",
    answer:
      "After taking a course, you can leave a review with ratings for difficulty, workload, and overall quality. Reviews help other students make better decisions. All reviews are associated with your account.",
  },
  {
    question: "Is my data private?",
    answer:
      "We take your privacy seriously. Your personal information is never sold. You can control what's visible to other users through your profile settings. See our Privacy Policy for full details.",
  },
  {
    question: "How do I report an issue or suggest a feature?",
    answer:
      "Use the Feedback page to report bugs, suggest features, or share any other thoughts. We read every submission!",
  },
  {
    question: "Who can use BetterAtlas?",
    answer:
      "BetterAtlas is currently available to Emory University students. Public beta sign-up is open with a valid account and no invite code required.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-500 mb-8">
        Can't find what you're looking for?{" "}
        <Link to="/feedback" className="text-primary-600 hover:text-primary-700 underline">
          Send us feedback
        </Link>
        .
      </p>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-gray-200 rounded-lg">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-medium text-gray-900">{faq.question}</span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 text-gray-600">{faq.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
