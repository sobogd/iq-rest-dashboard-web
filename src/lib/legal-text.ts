// Hardcoded English legal text shown inside the cookie consent secondary modals.
// Kept in TypeScript (not JSON i18n) on purpose — translating legal documents requires lawyer
// review and is more risk than benefit. The English version is canonical and binding.
//
// Operator data sourced from the existing Privacy Policy (messages/en.json → privacy.sections).

export const OPERATOR = {
  // Spanish autónomo is itself a recognised legal form for conducting business.
  legalName: "Bogdan Sokolov (Autónomo)",
  status: "Autónomo registered in Spain",
  brand: "IQ Rest",
  domain: "iq-rest.com",
  contactEmail: "support@iq-rest.com",
  fiscalAddress: "Calle Boca Del Rio 2, 1A, Oviedo, 33010, Asturias, Spain",
  taxId: "Z1894474S",
  hostingProvider: "Hetzner Online GmbH, Nuremberg, Germany",
  lastUpdated: "May 1, 2026",
};

// Backwards-compat alias used by the rest of the file.
export const COMPANY = OPERATOR;

/** Cookie Policy modal body. Plain text segments rendered with paragraph spacing. */
export const COOKIE_POLICY_TITLE = "Cookie Policy";

export const COOKIE_POLICY_SECTIONS: { heading?: string; paragraphs: string[] }[] = [
  {
    paragraphs: [
      `Last updated: ${OPERATOR.lastUpdated}`,
      `This Cookie Policy explains how ${OPERATOR.legalName}, ${OPERATOR.status} ("${OPERATOR.brand}", "we", "us"), uses cookies and similar technologies on the ${OPERATOR.brand} website at ${OPERATOR.domain} ("the Site"). It should be read together with our Terms of Service.`,
    ],
  },
  {
    heading: "1. What cookies are",
    paragraphs: [
      `Cookies are small text files that a website places on your device when you visit. They allow the site to remember your choices, keep you signed in, and understand how the site is used. Some cookies are essential for the site to function; others are used for analytics or other purposes that require your consent.`,
    ],
  },
  {
    heading: "2. Who we are and where data is processed",
    paragraphs: [
      `${OPERATOR.brand} is operated by ${OPERATOR.legalName}, ${OPERATOR.status}, with fiscal address at ${OPERATOR.fiscalAddress} (Tax ID: ${OPERATOR.taxId}). All data we collect is stored on our own servers operated by ${OPERATOR.hostingProvider}. We do not use Google Analytics, PostHog, Facebook Pixel, or any other third-party analytics or advertising tracker. All analytics processing happens first-party, on infrastructure under our direct control.`,
    ],
  },
  {
    heading: "3. Strictly necessary cookies",
    paragraphs: [
      `These cookies are required to operate the Site and the dashboard. Without them you would not be able to sign in, navigate language-specific pages, or place orders. They are set automatically and do not require consent under Article 5(3) of the ePrivacy Directive (the "strictly necessary" exemption).`,
      `Examples of strictly necessary cookies we use:`,
      `• iqr_session, iqr_email, session, user_email — keep you signed in to the dashboard`,
      `• sqr_session_id — identifies the visitor's browsing session on the public QR menu so cart contents persist between pages`,
      `• geo_country, geo_city, geo_ip, geo_ua — country detected from your IP via Cloudflare; used to pick the best language and currency`,
      `• currency — your selected currency for pricing display`,
      `• cookie_consent — remembers your cookie choice for one year`,
    ],
  },
  {
    heading: "4. Analytics cookies (require your consent)",
    paragraphs: [
      `If you click "Accept" on the cookie banner, we set additional first-party cookies to measure usage of the Site and improve features. These cookies do not contain personal information beyond a random session identifier; data is stored on our own servers and never shared with third parties.`,
      `Examples:`,
      `• analytics_sid — anonymous session identifier used to count unique visitors and track navigation paths`,
      `If you click "Reject", these cookies are not set and no analytics data is collected from your visit.`,
    ],
  },
  {
    heading: "5. Marketing and advertising cookies",
    paragraphs: [
      `We do not use advertising cookies, retargeting pixels, or third-party marketing trackers. If a visitor arrives via a Google Ads click, we may store the click identifier (gclid) in our own database for attribution; this is grouped under analytics consent and is not shared with Google or any other party beyond what Google itself receives via its own conversion pixel.`,
    ],
  },
  {
    heading: "6. How to change your choice",
    paragraphs: [
      `You can change your cookie preference at any time by clearing the cookie_consent cookie in your browser settings. The next time you load the Site, the banner will reappear and you can choose again.`,
    ],
  },
  {
    heading: "7. Your rights",
    paragraphs: [
      `Under the GDPR you have the right to access, correct, delete, restrict, or port the personal data we hold about you, and to object to processing. To exercise these rights, contact us at ${OPERATOR.contactEmail}. You also have the right to lodge a complaint with your national data protection authority — for Spain, this is the Agencia Española de Protección de Datos (AEPD, www.aepd.es).`,
    ],
  },
  {
    heading: "8. Changes to this policy",
    paragraphs: [
      `We may update this Cookie Policy from time to time to reflect changes in the cookies we use or in legal requirements. The date at the top of this page indicates when it was last updated. Continued use of the Site after the update constitutes acceptance of the revised policy.`,
    ],
  },
  {
    heading: "9. Contact",
    paragraphs: [
      `Questions about this Cookie Policy can be sent to ${OPERATOR.contactEmail}.`,
    ],
  },
];

/** Privacy Policy modal body. Enumerates every personal-data field the platform stores,
 *  per GDPR Article 13/14 transparency requirements. */
export const PRIVACY_POLICY_TITLE = "Privacy Policy";

export const PRIVACY_POLICY_SECTIONS: { heading?: string; paragraphs: string[] }[] = [
  {
    paragraphs: [
      `Last updated: ${OPERATOR.lastUpdated}`,
      `This Privacy Policy explains how ${OPERATOR.legalName}, ${OPERATOR.status}, with fiscal address at ${OPERATOR.fiscalAddress} (Tax ID: ${OPERATOR.taxId}) ("${OPERATOR.brand}", "we", "us"), collects, uses, stores and protects your personal data when you use the ${OPERATOR.brand} platform at ${OPERATOR.domain}.`,
      `We comply with the General Data Protection Regulation (GDPR), the Spanish Organic Law on Data Protection and Guarantee of Digital Rights (LOPDGDD), and the ePrivacy Directive.`,
    ],
  },
  {
    heading: "1. Data Controller",
    paragraphs: [
      `The data controller responsible for your personal data is ${OPERATOR.legalName} (Tax ID: ${OPERATOR.taxId}, fiscal address ${OPERATOR.fiscalAddress}).`,
      `For any privacy inquiries, including the exercise of your data subject rights, contact ${OPERATOR.contactEmail}.`,
    ],
  },
  {
    heading: "2. Data we collect",
    paragraphs: [
      `We collect only the data needed to operate the Service. Categories below cover everything stored in our database.`,
      `Account data — when you register: email address (used for OTP authentication and operational notices); preferred dashboard locale; the cuisine type and restaurant name you provide during the signup wizard.`,
      `Authentication data — short-lived one-time codes (OTPs), hashed session tokens, count of failed verification attempts. We use passwordless email + Google OAuth; no passwords are stored.`,
      `Business profile — your company name, subscription plan, and Stripe customer/subscription identifiers (used to bill you).`,
      `Restaurant profile — restaurant name, subtitle, description, slug, currency, brand color, cover image, postal address, geo coordinates, phone number, Instagram handle, WhatsApp number, languages and default language, working hours, table count.`,
      `Menu content — categories, dishes (name, description, price, photo, allergens, options, translations), tables (number, capacity, zone, position).`,
      `Reservations — for each booking: guest name, guest email, guest phone (optional), party size, date, time, duration, table assignment, status, internal notes.`,
      `Orders — for each public order: customer name (optional), customer phone (optional), delivery address (optional), comment, table number, items ordered, total amount, currency, status.`,
      `Support messages — content of messages you exchange with our support team.`,
      `Analytics & technical data (only with cookie consent) — anonymous session identifier; pages visited; events triggered (clicks, conversions); country and city derived from your IP via Cloudflare; browser User-Agent; gclid (Google Ads click identifier) for ad attribution.`,
      `Public-menu page views — when guests scan a QR code: anonymous session id, page slug, language, referrer, IP, User-Agent. Used for scan-count limits and the analytics dashboard you see.`,
      `Payment data — handled by Stripe; we never see or store full card details. We hold only the Stripe customer/subscription IDs and high-level subscription state.`,
    ],
  },
  {
    heading: "3. Legal basis for processing",
    paragraphs: [
      `Each category is processed under one of the legal bases in GDPR Article 6:`,
      `Contract performance (Art. 6(1)(b)) — account data, authentication data, business profile, restaurant profile, menu content, reservations, orders, support messages, payment data. Required to provide the Service you signed up for.`,
      `Legitimate interest (Art. 6(1)(f)) — short-term operational logs, fraud and abuse prevention, basic aggregate metrics. Balanced against your rights; you can object at any time.`,
      `Consent (Art. 6(1)(a)) — analytics cookies and technical data described in section 2 marked "only with cookie consent". You can withdraw consent at any time via the Cookie Settings link in the footer.`,
      `Legal obligation (Art. 6(1)(c)) — invoicing data we are required to retain by Spanish tax law.`,
    ],
  },
  {
    heading: "4. How we use your data",
    paragraphs: [
      `Provide and maintain the Service: create your dashboard account and restaurant pages, generate QR codes, run the public menu, process orders and reservations.`,
      `Authenticate you: send OTP codes by email, validate Google OAuth tokens, manage sessions.`,
      `Bill you: process subscription payments through Stripe, send invoices.`,
      `Communicate with you: account and service notices, support replies, important changes to the Service. We do not send marketing emails without your separate consent.`,
      `Improve the platform: aggregate usage analytics (only with cookie consent), debugging, performance monitoring.`,
      `Comply with legal obligations: tax records, regulatory reporting when required.`,
    ],
  },
  {
    heading: "5. Where data is stored",
    paragraphs: [
      `All customer data — your account, restaurant content, orders, reservations, analytics — is stored on a single dedicated server operated by ${OPERATOR.hostingProvider}. Data does not leave the European Union.`,
      `Backups are encrypted and stored in the same EU region.`,
      `Data is encrypted in transit using TLS and at rest using disk-level encryption.`,
    ],
  },
  {
    heading: "6. Third parties we share data with",
    paragraphs: [
      `We share data with the minimum number of third parties necessary to operate the Service:`,
      `Stripe, Inc. — payment processing. Receives your billing email, billing address (if provided), and the amount and product of each transaction. Stripe is a separate data controller for payment data. Privacy: https://stripe.com/privacy`,
      `Hetzner Online GmbH — server hosting (Nuremberg, Germany). Acts as a data processor under a Data Processing Agreement; cannot access database contents in normal operation.`,
      `Google LLC (only if you sign in with Google) — receives only the standard OAuth scope (email, name, picture). Same data Google already has on you. We do not send analytics or events to Google.`,
      `Cloudflare, Inc. — CDN and DDoS protection. Sees inbound HTTP requests including your IP address and User-Agent. Acts as a data processor.`,
      `We do not sell or rent your personal data to anyone. We do not use Google Analytics, PostHog, Facebook Pixel, Mixpanel, Amplitude, or any other third-party analytics or advertising tracker.`,
    ],
  },
  {
    heading: "7. International data transfers",
    paragraphs: [
      `All primary processing happens within the European Union. The third-party processors above (Stripe, Cloudflare, Google) may transfer data to the United States; in those cases the transfers are covered by the EU-US Data Privacy Framework or by Standard Contractual Clauses.`,
    ],
  },
  {
    heading: "8. How long we keep your data",
    paragraphs: [
      `Account data — for as long as your account is active. Within 30 days of account deletion, all personal data is permanently removed from our database. Backups are overwritten within 90 days.`,
      `OTPs — deleted immediately on successful verification or after 15 minutes (whichever comes first).`,
      `Reservations and orders — retained for as long as you keep your restaurant active in the Service, then removed with the account.`,
      `Analytics events — retained for up to 24 months in aggregated form; raw per-session events are pruned after 90 days.`,
      `Invoicing data — retained for 6 years as required by Spanish tax law (Ley General Tributaria).`,
      `Support messages — retained for 24 months after the last reply.`,
    ],
  },
  {
    heading: "9. Your rights",
    paragraphs: [
      `Under the GDPR you have the right to:`,
      `Access — request a copy of the personal data we hold about you.`,
      `Rectification — correct inaccurate or incomplete data.`,
      `Erasure ("right to be forgotten") — request deletion of your data; we will comply unless retention is required by law.`,
      `Restriction — pause processing while a complaint is investigated.`,
      `Portability — receive your data in a structured, machine-readable format and transfer it to another provider.`,
      `Object — object to processing based on legitimate interest, including opting out of analytics.`,
      `Withdraw consent — withdraw cookie consent at any time via the Cookie Settings link in the footer.`,
      `Lodge a complaint — file a complaint with the Spanish data protection authority, the Agencia Española de Protección de Datos (AEPD), at www.aepd.es.`,
      `To exercise any of these rights, email ${OPERATOR.contactEmail}. We respond within 30 days.`,
    ],
  },
  {
    heading: "10. Children",
    paragraphs: [
      `The Service is not intended for individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided us data, contact us and we will remove it.`,
    ],
  },
  {
    heading: "11. Security",
    paragraphs: [
      `We apply technical and organizational measures appropriate to the risk: TLS for all traffic, encryption at rest, hashed session tokens, rate-limiting, automated backups, restricted server access, and regular dependency updates. No system is 100% secure; if we become aware of a personal-data breach affecting you, we will notify you and the AEPD within 72 hours as required by GDPR Article 33.`,
    ],
  },
  {
    heading: "12. Changes to this policy",
    paragraphs: [
      `We may update this Privacy Policy from time to time. The "Last updated" date at the top reflects the most recent revision. Continued use of the Service after a change constitutes acceptance.`,
    ],
  },
  {
    heading: "13. Contact",
    paragraphs: [
      `Questions, complaints, or requests regarding this Privacy Policy can be sent to ${OPERATOR.contactEmail}. We respond within 30 days.`,
    ],
  },
];

/** Terms of Service modal body. Adapted from a standard SaaS template. */
export const TERMS_TITLE = "Terms of Service";

export const TERMS_SECTIONS: { heading?: string; paragraphs: string[] }[] = [
  {
    paragraphs: [
      `Last updated: ${OPERATOR.lastUpdated}`,
    ],
  },
  {
    heading: "Overview",
    paragraphs: [
      `This website (${OPERATOR.domain}) is operated by ${OPERATOR.legalName}, ${OPERATOR.status}, with fiscal address at ${OPERATOR.fiscalAddress} (Tax ID: ${OPERATOR.taxId}) ("${OPERATOR.brand}", "we", "us"). ${OPERATOR.brand} provides a software-as-a-service platform that allows restaurants to create QR menus, accept online orders, manage table reservations, and view analytics ("the Service").`,
      `By visiting our site or using the Service, you accept these Terms of Service ("Terms"). If you do not agree to all of these Terms, please do not use the site or the Service.`,
      `These Terms apply to all visitors and users, including restaurants subscribing to the Service and end customers scanning QR menus.`,
    ],
  },
  {
    heading: "1. Eligibility and accounts",
    paragraphs: [
      `You must be at least 18 years old (or the age of majority in your jurisdiction) to register for an account. By registering you confirm that the information you provide is accurate and that you are entitled to bind any business you sign up on behalf of.`,
      `You are responsible for safeguarding your sign-in credentials and for any activity that takes place under your account.`,
    ],
  },
  {
    heading: "2. Acceptable use",
    paragraphs: [
      `You agree not to use the Service for any unlawful purpose; not to upload malicious code, viruses, or content that infringes third-party rights; not to attempt to circumvent rate limits, security controls, or quotas; and not to scrape, mirror, or otherwise systematically extract data from the Service in ways not provided by official APIs.`,
      `Violation of these rules may result in immediate suspension or termination of your account.`,
    ],
  },
  {
    heading: "3. Subscription and billing",
    paragraphs: [
      `${COMPANY.brand} offers Free, Basic and Pro subscription plans. Paid plans are billed monthly or yearly via Stripe and renew automatically until cancelled. You may cancel at any time from your account settings; cancellation takes effect at the end of the current billing period and no refund is issued for the unused portion.`,
      `Prices are listed in EUR by default and may be displayed in your local currency for convenience. The amount actually charged is the EUR equivalent at your card issuer's exchange rate.`,
      `We reserve the right to change pricing with at least 30 days' notice; the new price applies from the next renewal cycle.`,
    ],
  },
  {
    heading: "4. Your content",
    paragraphs: [
      `You retain ownership of all content you upload to the Service (menu items, photos, restaurant details, etc.). By uploading you grant us a limited, non-exclusive license to host, store, transmit, display and back up that content for the sole purpose of providing the Service to you and your end customers.`,
      `You are solely responsible for ensuring that your content does not infringe any third-party rights and complies with applicable food labelling, allergen, and pricing regulations in your jurisdiction.`,
    ],
  },
  {
    heading: "5. Service availability and modifications",
    paragraphs: [
      `We aim for high availability but make no guarantee of uninterrupted, error-free operation. We may perform scheduled maintenance with prior notice when possible.`,
      `We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with reasonable notice for material changes affecting paid features.`,
    ],
  },
  {
    heading: "6. Data, privacy and hosting",
    paragraphs: [
      `All customer data is stored on servers operated by ${COMPANY.hostingProvider}. We do not transfer personal data outside the European Economic Area for processing.`,
      `We do not use Google Analytics, PostHog, Facebook Pixel, or any other third-party analytics or marketing tracker. Our analytics is fully first-party and runs on our own infrastructure.`,
      `For details on how we handle personal data and cookies, see our Privacy Policy and Cookie Policy.`,
    ],
  },
  {
    heading: "7. Third-party services",
    paragraphs: [
      `The Service integrates with third-party providers for specific functions: Stripe for payment processing, Google reCAPTCHA for spam protection, AWS S3 for image storage. By using the Service you also accept the terms of these providers as far as they apply to your interactions with them.`,
    ],
  },
  {
    heading: "8. Intellectual property",
    paragraphs: [
      `The ${OPERATOR.brand} name, logo, code, designs, and any other materials provided through the Service (excluding content you upload) are the intellectual property of ${OPERATOR.legalName} and protected by applicable copyright and trademark laws.`,
    ],
  },
  {
    heading: "9. Disclaimer of warranties",
    paragraphs: [
      `The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that any defects will be corrected. Your use of the Service is at your own risk.`,
    ],
  },
  {
    heading: "10. Limitation of liability",
    paragraphs: [
      `To the maximum extent permitted by law, ${OPERATOR.legalName} shall not be liable for any indirect, incidental, special, consequential or punitive damages, lost profits, lost revenue, lost data, or business interruption arising out of or in connection with the Service. Total liability for any claim arising under these Terms is limited to the amount you paid in the 12 months preceding the claim, or EUR 100, whichever is greater.`,
    ],
  },
  {
    heading: "11. Indemnification",
    paragraphs: [
      `You agree to indemnify and hold ${OPERATOR.legalName} harmless from any claim or demand made by any third party due to your breach of these Terms or your violation of any law or third-party rights.`,
    ],
  },
  {
    heading: "12. Termination",
    paragraphs: [
      `Either party may terminate this agreement at any time. You may terminate by closing your account from the dashboard. We may terminate immediately and without notice for breach of these Terms, suspected fraud, abuse, or illegal activity.`,
      `Upon termination, your right to access the Service ends immediately. We will retain a backup of your data for up to 30 days, after which it is permanently deleted.`,
    ],
  },
  {
    heading: "13. Governing law",
    paragraphs: [
      `These Terms are governed by the laws of the Kingdom of Spain. Any dispute arising from these Terms shall be settled in the competent courts of ${OPERATOR.fiscalAddress}.`,
    ],
  },
  {
    heading: "14. Changes to these Terms",
    paragraphs: [
      `We may update these Terms from time to time. The most current version is always available on this page. Material changes will be communicated via email or in-app notice at least 30 days before they take effect. Continued use of the Service after the change constitutes acceptance of the revised Terms.`,
    ],
  },
  {
    heading: "15. Contact",
    paragraphs: [
      `Questions about these Terms can be sent to ${OPERATOR.contactEmail}.`,
    ],
  },
];
