export default function PrivacyPolicy() {
  const email = "hello@betteratlas.net";
  const linkClass = "text-primary-600 hover:text-primary-700 underline";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Notice</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: February 18, 2026</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        {/* Intro */}
        <p>
          This privacy notice for BetterAtlas (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot;
          or &quot;our&quot;), describes how and why we might collect, store, use, and/or share
          (&quot;process&quot;) your information when you use our services
          (&quot;Services&quot;), such as when you:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Visit our website at betteratlas.net, or any website of ours that links to this privacy notice</li>
          <li>Engage with us in other related ways</li>
        </ul>
        <p>
          Questions or concerns? Reading this privacy notice will help you understand your privacy
          rights and choices. If you do not agree with our policies and practices, please do not
          use our Services. If you still have any questions or concerns, please contact us at{" "}
          <a href={`mailto:${email}`} className={linkClass}>{email}</a>.
        </p>

        {/* Google Limited Use */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Google Limited Use Disclosure</h2>
          <p>
            BetterAtlas&apos;s use and transfer to any other app of information received from
            Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        {/* Summary */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Summary of Key Points</h2>
          <p className="mb-4">
            This summary provides key points from our privacy notice, but you can find out more
            details about any of these topics in the sections below.
          </p>
          <ul className="space-y-3">
            <li>
              <strong>What personal information do we process?</strong> When you visit, use, or
              navigate our Services, we may process personal information depending on how you
              interact with BetterAtlas and the Services, the choices you make, and the products
              and features you use.
            </li>
            <li>
              <strong>Do we process any sensitive personal information?</strong> We do not process
              sensitive personal information.
            </li>
            <li>
              <strong>Do we receive any information from third parties?</strong> We may receive
              information from public databases, social media platforms, and other outside sources.
            </li>
            <li>
              <strong>How do we process your information?</strong> We process your information to
              provide, improve, and administer our Services, communicate with you, for security
              and fraud prevention, and to comply with law. We may also process your information
              for other purposes with your consent. We process your information only when we have a
              valid legal reason to do so.
            </li>
            <li>
              <strong>In what situations and with which parties do we share personal information?</strong>{" "}
              We do not share information in any situations with any third parties.
            </li>
            <li>
              <strong>How do we keep your information safe?</strong> We have organizational and
              technical processes and procedures in place to protect your personal information.
              However, no electronic transmission over the internet or information storage
              technology can be guaranteed to be 100% secure, so we cannot promise or guarantee
              that hackers, cybercriminals, or other unauthorized third parties will not be able to
              defeat our security and improperly collect, access, steal, or modify your
              information.
            </li>
            <li>
              <strong>What are your rights?</strong> Depending on where you are located
              geographically, the applicable privacy law may mean you have certain rights regarding
              your personal information.
            </li>
            <li>
              <strong>How do you exercise your rights?</strong> The easiest way to exercise your
              rights is by contacting us at{" "}
              <a href={`mailto:${email}`} className={linkClass}>{email}</a>. We will consider and
              act upon any request in accordance with applicable data protection laws.
            </li>
          </ul>
        </section>

        {/* Table of Contents */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Table of Contents</h2>
          <ol className="list-decimal pl-6 space-y-1">
            <li><a href="#section-1" className={linkClass}>What information do we collect?</a></li>
            <li><a href="#section-2" className={linkClass}>How do we process your information?</a></li>
            <li><a href="#section-3" className={linkClass}>When and with whom do we share your personal information?</a></li>
            <li><a href="#section-4" className={linkClass}>How do we handle your social logins?</a></li>
            <li><a href="#section-5" className={linkClass}>How long do we keep your information?</a></li>
            <li><a href="#section-6" className={linkClass}>How do we keep your information safe?</a></li>
            <li><a href="#section-7" className={linkClass}>Do we collect information from minors?</a></li>
            <li><a href="#section-8" className={linkClass}>What are your privacy rights?</a></li>
            <li><a href="#section-9" className={linkClass}>Controls for Do-Not-Track features</a></li>
            <li><a href="#section-10" className={linkClass}>Do California residents have specific privacy rights?</a></li>
            <li><a href="#section-11" className={linkClass}>Do we make updates to this notice?</a></li>
            <li><a href="#section-12" className={linkClass}>How can you contact us about this notice?</a></li>
            <li><a href="#section-13" className={linkClass}>How can you review, update, or delete the data we collect from you?</a></li>
          </ol>
        </section>

        {/* Section 1 */}
        <section id="section-1">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What Information Do We Collect?</h2>

          <h3 className="font-semibold text-gray-900 mt-4 mb-2">Personal information you disclose to us</h3>
          <p className="italic text-gray-500 mb-2">
            In Short: We collect personal information that you provide to us.
          </p>
          <p>
            We collect personal information that you voluntarily provide to us when you register on
            the Services, express an interest in obtaining information about us or our products and
            Services, when you participate in activities on the Services, or otherwise when you
            contact us.
          </p>
          <p className="mt-3">
            <strong>Sensitive Information.</strong> We do not process sensitive information.
          </p>
          <p className="mt-3">
            <strong>Social Media Login Data.</strong> We may provide you with the option to link
            your BetterAtlas account to your existing social media account. If you choose to do
            this, we will collect the information described in the section called &quot;How Do We
            Handle Your Social Logins?&quot; below.
          </p>
          <p className="mt-3">
            All personal information that you provide to us must be true, complete, and accurate,
            and you must notify us of any changes to such personal information.
          </p>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Information automatically collected</h3>
          <p className="italic text-gray-500 mb-2">
            In Short: Some information &mdash; such as your Internet Protocol (IP) address and/or
            browser and device characteristics &mdash; is collected automatically when you visit
            our Services.
          </p>
          <p>
            We automatically collect certain information when you visit, use, or navigate the
            Services. This information does not reveal your specific identity (like your name or
            contact information) but may include device and usage information, such as your IP
            address, browser and device characteristics, operating system, language preferences,
            referring URLs, device name, country, location, information about how and when you use
            our Services, and other technical information. This information is primarily needed to
            maintain the security and operation of our Services, and for our internal analytics and
            reporting purposes.
          </p>
          <p className="mt-3">The information we collect includes:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              <strong>Log and Usage Data.</strong> Log and usage data is service-related,
              diagnostic, usage, and performance information our servers automatically collect when
              you access or use our Services and which we record in log files. Depending on how you
              interact with us, this log data may include your IP address, device information,
              browser type, and settings and information about your activity in the Services (such
              as the date/time stamps associated with your usage, pages and files viewed, searches,
              and other actions you take such as which features you use), device event information
              (such as system activity, error reports, and hardware settings).
            </li>
            <li>
              <strong>Device Data.</strong> We collect device data such as information about your
              computer, phone, tablet, or other device you use to access the Services. Depending on
              the device used, this device data may include information such as your IP address (or
              proxy server), device and application identification numbers, location, browser type,
              hardware model, Internet service provider and/or mobile carrier, operating system,
              and system configuration information.
            </li>
            <li>
              <strong>Location Data.</strong> We collect location data such as information about
              your device&apos;s location, which can be either precise or imprecise. How much
              information we collect depends on the type and settings of the device you use to
              access the Services. For example, we may use GPS and other technologies to collect
              geolocation data that tells us your current location (based on your IP address). You
              can opt out of allowing us to collect this information either by refusing access to
              the information or by disabling your Location setting on your device. However, if you
              choose to opt out, you may not be able to use certain aspects of the Services.
            </li>
          </ul>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Information collected from other sources</h3>
          <p className="italic text-gray-500 mb-2">
            In Short: We may collect limited data from public databases and other outside sources.
          </p>
          <p>
            In order to enhance our ability to provide functional services to you and update our
            records, we may obtain information about you from other sources, such as public
            databases, data providers, and from other third parties. We source our data from a
            combination of Emory&apos;s course catalog, historical evaluations database, and course
            demand data. Some of the information is also pulled from our historical archives of the
            aforementioned data sources. This information includes names, email addresses, student
            identification numbers, and other student data.
          </p>
        </section>

        {/* Section 2 */}
        <section id="section-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How Do We Process Your Information?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: We process your information to provide, improve, and administer our Services,
            communicate with you, for security and fraud prevention, and to comply with law. We may
            also process your information for other purposes with your consent.
          </p>
          <p>
            We process your personal information for a variety of reasons, depending on how you
            interact with our Services, including:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>
              <strong>To facilitate account creation and authentication and otherwise manage user
              accounts.</strong> We may process your information so you can create and log in to
              your account, as well as keep your account in working order.
            </li>
            <li>
              <strong>To deliver and facilitate delivery of services to the user.</strong> We may
              process your information to provide you with the requested service.
            </li>
            <li>
              <strong>To evaluate and improve our Services, products, and your experience.</strong>{" "}
              We may process your information when we believe it is necessary to identify usage
              trends, and to evaluate and improve our Services, products, and your experience.
            </li>
            <li>
              <strong>To identify usage trends.</strong> We may process information about how you
              use our Services to better understand how they are being used so we can improve them.
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section id="section-3">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. When and With Whom Do We Share Your Personal Information?
          </h2>
          <p>We do not share your personal information in any situation with any third parties.</p>
        </section>

        {/* Section 4 */}
        <section id="section-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. How Do We Handle Your Social Logins?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: If you choose to link to our Services using a social media account, we may
            have access to certain information about you.
          </p>
          <p>
            Our Services offer you the ability to link your BetterAtlas account with your social
            media account. Where you choose to do this, we will receive certain profile information
            about you from your social media provider. The profile information we receive may vary
            depending on the social media provider concerned, but will often include your name,
            email address, and friends list, as well as other information you choose to make public
            on such a social media platform.
          </p>
          <p className="mt-3">
            We will use the information we receive only for the purposes that are described in this
            privacy notice or that are otherwise made clear to you on the relevant Services. Please
            note that we do not control, and are not responsible for, other uses of your personal
            information by your third-party social media provider. We recommend that you review
            their privacy notice to understand how they collect, use, and share your personal
            information, and how you can set your privacy preferences on their sites and apps.
          </p>
        </section>

        {/* Section 5 */}
        <section id="section-5">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How Long Do We Keep Your Information?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: We keep your information for as long as necessary to fulfill the purposes
            outlined in this privacy notice unless otherwise required by law.
          </p>
          <p>
            We will only keep your personal information for as long as it is necessary for the
            purposes set out in this privacy notice, unless a longer retention period is required or
            permitted by law (such as tax, accounting, or other legal requirements). No purpose in
            this notice will require us keeping your personal information for longer than three (3)
            months past the termination of the user&apos;s account.
          </p>
          <p className="mt-3">
            When we have no ongoing legitimate business need to process your personal information,
            we will either delete or anonymize such information, or, if this is not possible (for
            example, because your personal information has been stored in backup archives), then we
            will securely store your personal information and isolate it from any further processing
            until deletion is possible.
          </p>
        </section>

        {/* Section 6 */}
        <section id="section-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. How Do We Keep Your Information Safe?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: We aim to protect your personal information through a system of
            organizational and technical security measures.
          </p>
          <p>
            We have implemented appropriate and reasonable technical and organizational security
            measures designed to protect the security of any personal information we process.
            However, despite our safeguards and efforts to secure your information, no electronic
            transmission over the Internet or information storage technology can be guaranteed to be
            100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other
            unauthorized third parties will not be able to defeat our security and improperly
            collect, access, steal, or modify your information. Although we will do our best to
            protect your personal information, transmission of personal information to and from our
            Services is at your own risk. You should only access the Services within a secure
            environment.
          </p>
        </section>

        {/* Section 7 */}
        <section id="section-7">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Do We Collect Information From Minors?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: We do not knowingly collect data from or market to children under 18 years of
            age.
          </p>
          <p>
            We do not knowingly solicit data from or market to children under 18 years of age. By
            using the Services, you represent that you are at least 18 or that you are the parent or
            guardian of such a minor and consent to such minor dependent&apos;s use of the Services.
            If we learn that personal information from users less than 18 years of age has been
            collected, we will deactivate the account and take reasonable measures to promptly
            delete such data from our records. If you become aware of any data we may have collected
            from children under age 18, please contact us at{" "}
            <a href={`mailto:${email}`} className={linkClass}>{email}</a>.
          </p>
        </section>

        {/* Section 8 */}
        <section id="section-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. What Are Your Privacy Rights?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: You may review, change, or terminate your account at any time.
          </p>
          <p>
            If you are located in the EEA or UK and you believe we are unlawfully processing your
            personal information, you also have the right to complain to your{" "}
            <a
              href="https://ec.europa.eu/justice/data-protection/bodies/authorities/index_en.htm"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              local data protection supervisory authority
            </a>
            .
          </p>
          <p className="mt-3">
            If you are located in Switzerland, the contact details for the data protection
            authorities are available{" "}
            <a
              href="https://www.edoeb.admin.ch/edoeb/en/home.html"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              here
            </a>
            .
          </p>
          <p className="mt-3">
            <strong>Withdrawing your consent:</strong> If we are relying on your consent to process
            your personal information, which may be express and/or implied consent depending on the
            applicable law, you have the right to withdraw your consent at any time. You can
            withdraw your consent at any time by contacting us using the contact details provided in
            the section &quot;How Can You Contact Us About This Notice?&quot; below.
          </p>
          <p className="mt-3">
            However, please note that this will not affect the lawfulness of the processing before
            its withdrawal nor, when applicable law allows, will it affect the processing of your
            personal information conducted in reliance on lawful processing grounds other than
            consent.
          </p>

          <h3 className="font-semibold text-gray-900 mt-6 mb-2">Account Information</h3>
          <p>
            If you would at any time like to review or change the information in your account or
            terminate your account, you can contact us using the contact information provided.
          </p>
          <p className="mt-3">
            Upon your request to terminate your account, we will deactivate or delete your account
            and information from our active databases. However, we may retain some information in
            our files to prevent fraud, troubleshoot problems, assist with any investigations,
            enforce our legal terms and/or comply with applicable legal requirements.
          </p>
          <p className="mt-3">
            If you have questions or comments about your privacy rights, you may email us at{" "}
            <a href={`mailto:${email}`} className={linkClass}>{email}</a>.
          </p>
        </section>

        {/* Section 9 */}
        <section id="section-9">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Controls for Do-Not-Track Features</h2>
          <p>
            Most web browsers and some mobile operating systems and mobile applications include a
            Do-Not-Track (&quot;DNT&quot;) feature or setting you can activate to signal your
            privacy preference not to have data about your online browsing activities monitored and
            collected. At this stage no uniform technology standard for recognizing and implementing
            DNT signals has been finalized. As such, we do not currently respond to DNT browser
            signals or any other mechanism that automatically communicates your choice not to be
            tracked online. If a standard for online tracking is adopted that we must follow in the
            future, we will inform you about that practice in a revised version of this privacy
            notice.
          </p>
        </section>

        {/* Section 10 */}
        <section id="section-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            10. Do California Residents Have Specific Privacy Rights?
          </h2>
          <p className="italic text-gray-500 mb-2">
            In Short: Yes, if you are a resident of California, you are granted specific rights
            regarding access to your personal information.
          </p>
          <p>
            California Civil Code Section 1798.83, also known as the &quot;Shine The Light&quot;
            law, permits our users who are California residents to request and obtain from us, once
            a year and free of charge, information about categories of personal information (if any)
            we disclosed to third parties for direct marketing purposes and the names and addresses
            of all third parties with which we shared personal information in the immediately
            preceding calendar year. If you are a California resident and would like to make such a
            request, please submit your request in writing to us using the contact information
            provided below.
          </p>
          <p className="mt-3">
            If you are under 18 years of age, reside in California, and have a registered account
            with Services, you have the right to request removal of unwanted data that you publicly
            post on the Services. To request removal of such data, please contact us using the
            contact information provided below and include the email address associated with your
            account and a statement that you reside in California. We will make sure the data is not
            publicly displayed on the Services, but please be aware that the data may not be
            completely or comprehensively removed from all our systems (e.g., backups, etc.).
          </p>
        </section>

        {/* Section 11 */}
        <section id="section-11">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Do We Make Updates to This Notice?</h2>
          <p className="italic text-gray-500 mb-2">
            In Short: Yes, we will update this notice as necessary to stay compliant with relevant
            laws.
          </p>
          <p>
            We may update this privacy notice from time to time. The updated version will be
            indicated by an updated &quot;Revised&quot; date and the updated version will be
            effective as soon as it is accessible. If we make material changes to this privacy
            notice, we may notify you either by prominently posting a notice of such changes or by
            directly sending you a notification. We encourage you to review this privacy notice
            frequently to be informed of how we are protecting your information.
          </p>
        </section>

        {/* Section 12 */}
        <section id="section-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. How Can You Contact Us About This Notice?</h2>
          <p>
            If you have questions or comments about this notice, you may email us at{" "}
            <a href={`mailto:${email}`} className={linkClass}>{email}</a>.
          </p>
        </section>

        {/* Section 13 */}
        <section id="section-13">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            13. How Can You Review, Update, or Delete the Data We Collect From You?
          </h2>
          <p>
            You have the right to request access to the personal information we collect from you,
            change that information, or delete it. To request to review, update, or delete your
            personal information, please contact us at{" "}
            <a href={`mailto:${email}`} className={linkClass}>{email}</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
