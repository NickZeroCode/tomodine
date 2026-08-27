/**
 * PrivacyPage — Privacy Policy for TomoDine platform.
 *
 * Full bilingual (English / Bengali) privacy policy covering: information
 * collection, data usage, data sharing, security measures, data retention,
 * user rights, cookies, children's privacy, international transfers, changes
 * to policy, contact information, governing law, and severability.
 *
 * Follows the TomoDine Design System.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* ── Section data ────────────────────────────────────────────── */

const SECTIONS = [
  /* 1. Introduction */
  {
    id: "introduction",
    en: {
      title: "1. Introduction",
      body: `TomoDine ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, share, and protect your personal information when you use the TomoDine platform ("Platform"), including our website, mobile applications, APIs, QR code ordering system, AI Concierge chatbot, and all related services (collectively, the "Services").

This Policy applies to all users of the Platform, including restaurant owners, managers, staff members, and customers who interact with the Platform through QR code ordering or other channels. By accessing or using the Services, you acknowledge that you have read and understood this Privacy Policy.

If you do not agree with the practices described in this Policy, please do not use the Services.`,
    },
    bn: {
      title: "১. ভূমিকা",
      body: `TomoDine ("আমরা") আপনার গোপনীয়তা রক্ষা করতে প্রতিশ্রুতিবদ্ধ। এই গোপনীয়তা নীতি ব্যাখ্যা করে যে আমরা কীভাবে আপনার ব্যক্তিগত তথ্য সংগ্রহ, ব্যবহার, সংরক্ষণ, শেয়ার এবং সুরক্ষা করি যখন আপনি TomoDine প্ল্যাটফর্ম ("প্ল্যাটফর্ম") ব্যবহার করেন, যার মধ্যে আমাদের ওয়েবসাইট, মোবাইল অ্যাপ্লিকেশন, API, QR কোড অর্ডারিং সিস্টেম, AI কনসিয়ার্জ চ্যাটবট এবং সমস্ত সম্পর্কিত সেবা (সম্মিলিতভাবে, "সেবা") অন্তর্ভুক্ত।

এই নীতি প্ল্যাটফর্মের সমস্ত ব্যবহারকারীদের জন্য প্রযোজ্য, যার মধ্যে রেস্তোরাঁ মালিক, ব্যবস্থাপক, কর্মী এবং QR কোড অর্ডারিং বা অন্যান্য চ্যানেলের মাধ্যমে প্ল্যাটফর্মের সাথে যোগাযোগকারী গ্রাহকরা অন্তর্ভুক্ত। সেবা অ্যাক্সেস বা ব্যবহার করে, আপনি স্বীকার করেন যে আপনি এই গোপনীয়তা নীতি পড়েছেন এবং বুঝেছেন।

আপনি যদি এই নীতিতে বর্ণিত অনুশীলনের সাথে সম্মত না হন, তাহলে অনুগ্রহ করে সেবা ব্যবহার করবেন না।`,
    },
  },

  /* 2. Information We Collect */
  {
    id: "info-collected",
    en: {
      title: "2. Information We Collect",
      body: `We collect several categories of information to provide and improve the Services:`,
      list: [
        "Account Information — when you register, we collect your name, email address, phone number, restaurant name, restaurant type, branch locations, and business details.",
        "Restaurant Data — menu items (names, descriptions, prices, images, categories, dietary tags), table layouts, staff profiles, roles, and permissions you configure on the Platform.",
        "Customer Data Collected by Restaurants — when customers place orders via QR code scanning, the restaurant's instance of the Platform may collect the customer's device fingerprint (a non-unique hash generated from browser characteristics such as screen size, timezone, and browser type — no personal data is collected), order history, table number, and session data. The device fingerprint is used solely to maintain session continuity and order isolation between devices at the same table. This data belongs to the restaurant and is processed on their behalf.",
        "Usage Data — pages visited, features used, actions taken, session duration, search queries within the Platform, and interaction patterns with the AI Concierge chatbot.",
        "Device and Technical Information — browser type and version, operating system, device type, screen resolution, IP address, referring URL, and approximate geographic location (city-level).",
        "Payment Information — subscription payments are processed by third-party payment gateways (bKash, Nagad, SSLCommerz). We do not store credit or debit card numbers on our servers. We receive and store only transaction references, payment status, and masked payment identifiers.",
        "Communications — records of your interactions with our support team via email, WhatsApp, or in-app messaging.",
        "Cookies and Similar Technologies — we use cookies and similar tracking technologies as described in Section 8 below.",
      ],
    },
    bn: {
      title: "২. আমরা যে তথ্য সংগ্রহ করি",
      body: `সেবা প্রদান এবং উন্নত করতে আমরা বেশ কয়েকটি বিভাগের তথ্য সংগ্রহ করি:`,
      list: [
        "অ্যাকাউন্ট তথ্য — নিবন্ধনের সময়, আমরা আপনার নাম, ইমেইল ঠিকানা, ফোন নম্বর, রেস্তোরাঁর নাম, রেস্তোরাঁর ধরন, শাখার অবস্থান এবং ব্যবসায়িক বিবরণ সংগ্রহ করি।",
        "রেস্তোরাঁ ডেটা — মেনু আইটেম (নাম, বিবরণ, মূল্য, ছবি, ক্যাটাগরি, ডায়েটারি ট্যাগ), টেবিল লেআউট, স্টাফ প্রোফাইল, ভূমিকা এবং অনুমতি যা আপনি প্ল্যাটফর্মে কনফিগার করেন।",
        "রেস্তোরাঁ দ্বারা সংগৃহীত গ্রাহক ডেটা — QR কোড স্ক্যান করে গ্রাহকরা অর্ডার দিলে, প্ল্যাটফর্মের রেস্তোরাঁর ইনস্ট্যান্স গ্রাহকের ডিভাইস ফিঙ্গারপ্রিন্ট (স্ক্রিন সাইজ, টাইমজোন, ব্রাউজারের ধরন ইত্যাদি ব্রাউজার বৈশিষ্ট্য থেকে তৈরি একটি অ-অনন্ত হ্যাশ — কোনো ব্যক্তিগত তথ্য সংগ্রহ করা হয় না), অর্ডার ইতিহাস, টেবিল নম্বর এবং সেশন ডেটা সংগ্রহ করতে পারে। ডিভাইস ফিঙ্গারপ্রিন্ট শুধুমাত্র একই টেবিলে বিভিন্ন ডিভাইসের মধ্যে সেশন ধারাবাহিকতা এবং অর্ডার আইসোলেশন বজায় রাখতে ব্যবহৃত হয়। এই ডেটা রেস্তোরাঁর এবং তাদের পক্ষে প্রক্রিয়া করা হয়।",
        "ব্যবহার ডেটা — পরিদর্শিত পৃষ্ঠা, ব্যবহৃত বৈশিষ্ট্য, নেওয়া ক্রিয়াকলাপ, সেশনের সময়কাল, প্ল্যাটফর্মের মধ্যে অনুসন্ধান ক্যোয়েরি এবং AI কনসিয়ার্জ চ্যাটবটের সাথে ইন্টারেকশন প্যাটার্ন।",
        "ডিভাইস ও প্রযুক্তিগত তথ্য — ব্রাউজারের ধরন এবং সংস্করণ, অপারেটিং সিস্টেম, ডিভাইসের ধরন, স্ক্রিন রেজোলিউশন, IP ঠিকানা, রেফারিং URL এবং আনুমানিক ভৌগোলিক অবস্থান (শহর-স্তর)।",
        "পেমেন্ট তথ্য — সাবস্ক্রিপশন পেমেন্ট তৃতীয় পক্ষের পেমেন্ট গেটওয়ে (bKash, Nagad, SSLCommerz) দ্বারা প্রক্রিয়া করা হয়। আমরা আমাদের সার্ভারে ক্রেডিট বা ডেবিট কার্ড নম্বর সংরক্ষণ করি না। আমরা শুধুমাত্র লেনদেন রেফারেন্স, পেমেন্ট স্ট্যাটাস এবং মাস্কড পেমেন্ট আইডেন্টিফায়ার গ্রহণ এবং সংরক্ষণ করি।",
        "যোগাযোগ — ইমেইল, হোয়াটসঅ্যাপ বা ইন-অ্যাপ মেসেজিংয়ের মাধ্যমে আমাদের সাপোর্ট টিমের সাথে আপনার যোগাযোগের রেকর্ড।",
        "কুকি এবং অনুরূপ প্রযুক্তি — আমরা নীচে বিভাগ ৮-এ বর্ণিত হিসাবে কুকি এবং অনুরূপ ট্র্যাকিং প্রযুক্তি ব্যবহার করি।",
      ],
    },
  },

  /* 3. How We Use Your Information */
  {
    id: "info-usage",
    en: {
      title: "3. How We Use Your Information",
      body: `We use the information we collect for the following purposes:`,
      list: [
        "Provide and Maintain the Service — to operate, maintain, and deliver the core functionality of the Platform, including menu management, order processing, staff management, inventory tracking, and analytics.",
        "Process Orders and Payments — to facilitate QR code ordering, route orders to kitchen and service staff, and process subscription payments through our payment partners.",
        "Send Notifications — to deliver order status updates (new order, cooking, ready, served), system alerts, subscription reminders, and important account notifications via email, push notifications, or in-app messages.",
        "AI Concierge Improvement — to analyse and improve the AI Concierge chatbot conversations for better menu recommendations, order assistance, and customer service. Chat logs may be used in anonymised or aggregated form for model training and quality improvement.",
        "Analytics and Reporting — to generate restaurant performance reports, revenue analytics, peak-hour analysis, popular dish tracking, and other business intelligence features for restaurant owners.",
        "Customer Support — to respond to your enquiries, troubleshoot technical issues, and provide assistance with the Platform.",
        "Security and Fraud Prevention — to detect, prevent, and respond to security incidents, fraud, and abuse of the Platform.",
        "Legal Compliance — to comply with applicable laws, regulations, tax requirements, legal processes, and enforceable governmental requests in Bangladesh.",
        "Service Improvement — to understand how users interact with the Platform and develop new features, improve existing functionality, and enhance user experience.",
      ],
    },
    bn: {
      title: "৩. আমরা কীভাবে আপনার তথ্য ব্যবহার করি",
      body: `আমরা সংগৃহীত তথ্য নিম্নলিখিত উদ্দেশ্যে ব্যবহার করি:`,
      list: [
        "সেবা প্রদান এবং রক্ষণাবেক্ষণ — প্ল্যাটফর্মের মূল কার্যকারিতা পরিচালনা, রক্ষণাবেক্ষণ এবং সরবরাহ করতে, মেনু ব্যবস্থাপনা, অর্ডার প্রক্রিয়াকরণ, কর্মী ব্যবস্থাপনা, ইনভেন্টরি ট্র্যাকিং এবং বিশ্লেষণ সহ।",
        "অর্ডার এবং পেমেন্ট প্রক্রিয়াকরণ — QR কোড অর্ডারিং সহজ করতে, কিচেন এবং সেবা কর্মীদের কাছে অর্ডার পাঠাতে এবং আমাদের পেমেন্ট পার্টনারদের মাধ্যমে সাবস্ক্রিপশন পেমেন্ট প্রক্রিয়া করতে।",
        "বিজ্ঞপ্তি পাঠাতে — অর্ডার স্ট্যাটাস আপডেট (নতুন অর্ডার, রান্না হচ্ছে, প্রস্তুত, পরিবেশিত), সিস্টেম সতর্কতা, সাবস্ক্রিপশন রিমাইন্ডার এবং গুরুত্বপূর্ণ অ্যাকাউন্ট বিজ্ঞপ্তি ইমেইল, পুশ নোটিফিকেশন বা ইন-অ্যাপ মেসেজের মাধ্যমে প্রদান করতে।",
        "AI কনসিয়ার্জ উন্নতি — ভালো মেনু সুপারিশ, অর্ডার সহায়তা এবং গ্রাহক সেবার জন্য AI কনসিয়ার্জ চ্যাটবট কথোপকথন বিশ্লেষণ এবং উন্নত করতে। চ্যাট লগ মডেল প্রশিক্ষণ এবং মান উন্নতির জন্য বেনামী বা সমষ্টিগত আকারে ব্যবহার করা হতে পারে।",
        "বিশ্লেষণ ও রিপোর্টিং — রেস্তোরাঁ মালিকদের জন্য রেস্তোরাঁ পারফরম্যান্স রিপোর্ট, আয় বিশ্লেষণ, পিক আওয়ার বিশ্লেষণ, জনপ্রিয় ডিশ ট্র্যাকিং এবং অন্যান্য ব্যবসায়িক বুদ্ধিমত্তা বৈশিষ্ট্য তৈরি করতে।",
        "গ্রাহক সহায়তা — আপনার অনুসন্ধানের উত্তর দিতে, প্রযুক্তিগত সমস্যা সমাধান করতে এবং প্ল্যাটফর্মের সাথে সহায়তা প্রদান করতে।",
        "নিরাপত্তা ও জালিয়াতি প্রতিরোধ — নিরাপত্তা ঘটনা, জালিয়াতি এবং প্ল্যাটফর্মের অপব্যবহার সনাক্ত, প্রতিরোধ এবং প্রতিক্রিয়া জানাতে।",
        "আইনি সম্মতি — বাংলাদেশে প্রযোজ্য আইন, বিধি, কর প্রয়োজনীয়তা, আইনি প্রক্রিয়া এবং প্রয়োগযোগ্য সরকারি অনুরোধ মেনে চলতে।",
        "সেবা উন্নতি — ব্যবহারকারীরা কীভাবে প্ল্যাটফর্মের সাথে ইন্টার্যাক্ট করে তা বুঝতে এবং নতুন বৈশিষ্ট্য তৈরি, বিদ্যমান কার্যকারিতা উন্নত এবং ব্যবহারকারীর অভিজ্ঞতা বাড়াতে।",
      ],
    },
  },

  /* 4. Data Sharing and Disclosure */
  {
    id: "data-sharing",
    en: {
      title: "4. Data Sharing and Disclosure",
      body: `We share your information only in the following circumstances:`,
      list: [
        "With Restaurant Owners — restaurant owners and authorised managers can access all data related to their own restaurant(s), including orders, customer interactions, staff activity, and analytics. Each restaurant's data is isolated from other restaurants on the Platform.",
        "With Payment Processors — we share necessary transaction data with our payment partners (bKash, Nagad, SSLCommerz) to process subscription payments. These partners have their own privacy policies governing how they handle payment data.",
        "With Cloud Infrastructure Providers — we use Amazon Web Services (AWS) to host and store data. AWS processes data on our behalf under strict data processing agreements and industry-standard security certifications.",
        "With AI Service Providers — anonymised or aggregated conversation data may be shared with AI service providers to improve the AI Concierge chatbot functionality. No personally identifiable information is shared for this purpose.",
        "For Legal Requirements — we may disclose information if required by law, regulation, court order, or enforceable governmental request from Bangladeshi authorities, including but not limited to the Information and Communication Technology Act 2006 and the Cyber Security Ordinance 2025.",
        "Business Transfers — in the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change and any choices you may have regarding your information.",
      ],
      after: `We do NOT sell, rent, or trade your personal information to third parties for their marketing purposes. We do NOT share customer data collected by one restaurant with any other restaurant or third party, except as described above.`,
    },
    bn: {
      title: "৪. ডেটা শেয়ারিং এবং প্রকাশ",
      body: `আমরা শুধুমাত্র নিম্নলিখিত পরিস্থিতিতে আপনার তথ্য শেয়ার করি:`,
      list: [
        "রেস্তোরাঁ মালিকদের সাথে — রেস্তোরাঁ মালিক এবং অনুমোদিত ব্যবস্থাপকরা তাদের নিজস্ব রেস্তোরাঁর সাথে সম্পর্কিত সমস্ত ডেটা অ্যাক্সেস করতে পারেন, অর্ডার, গ্রাহক ইন্টারেকশন, কর্মী কার্যকলাপ এবং বিশ্লেষণ সহ। প্রতিটি রেস্তোরাঁর ডেটা প্ল্যাটফর্মের অন্য রেস্তোরাঁ থেকে আলাদা।",
        "পেমেন্ট প্রসেসরদের সাথে — সাবস্ক্রিপশন পেমেন্ট প্রক্রিয়া করতে আমরা আমাদের পেমেন্ট পার্টনারদের (bKash, Nagad, SSLCommerz) সাথে প্রয়োজনীয় লেনদেন ডেটা শেয়ার করি। এই পার্টনারদের নিজস্ব গোপনীয়তা নীতি রয়েছে।",
        "ক্লাউড অবকাঠামো প্রদানকারীদের সাথে — আমরা ডেটা হোস্ট এবং সংরক্ষণ করতে Amazon Web Services (AWS) ব্যবহার করি। AWS কঠোর ডেটা প্রক্রিয়াকরণ চুক্তি এবং শিল্প-মানের নিরাপত্তা সার্টিফিকেশনের অধীনে আমাদের পক্ষে ডেটা প্রক্রিয়া করে।",
        "AI সেবা প্রদানকারীদের সাথে — AI কনসিয়ার্জ চ্যাটবট কার্যকারিতা উন্নত করতে বেনামী বা সমষ্টিগত কথোপকথন ডেটা AI সেবা প্রদানকারীদের সাথে শেয়ার করা হতে পারে। এই উদ্দেশ্যে কোনো ব্যক্তিগতভাবে শনাক্তযোগ্য তথ্য শেয়ার করা হয় না।",
        "আইনি প্রয়োজনীয়তার জন্য — বাংলাদেশের কর্তৃপক্ষের কাছ থেকে আইন, বিধি, আদালতের আদেশ বা প্রয়োগযোগ্য সরকারি অনুরোধ দ্বারা প্রয়োজন হলে আমরা তথ্য প্রকাশ করতে পারি।",
        "ব্যবসায়িক হস্তান্তর — একত্রীকরণ, অধিগ্রহণ বা সম্পদ বিক্রয়ের ক্ষেত্রে, আপনার তথ্য সেই লেনদেনের অংশ হিসাবে স্থানান্তরিত হতে পারে।",
      ],
      after: `আমরা তাদের মার্কেটিং উদ্দেশ্যে তৃতীয় পক্ষের কাছে আপনার ব্যক্তিগত তথ্য বিক্রি, ভাড়া বা বাণিজ্য করি না। আমরা একটি রেস্তোরাঁ দ্বারা সংগৃহীত গ্রাহক ডেটা অন্য কোনো রেস্তোরাঁ বা তৃতীয় পক্ষের সাথে শেয়ার করি না, উপরে বর্ণিত ছাড়া।`,
    },
  },

  /* 5. Data Security */
  {
    id: "data-security",
    en: {
      title: "5. Data Security",
      body: `We take the security of your data seriously and implement multiple layers of protection:`,
      list: [
        "Encryption in Transit — all data transmitted between your device and our servers is encrypted using HTTPS/TLS (Transport Layer Security) to prevent interception.",
        "Encryption at Rest — data stored on our servers and databases is encrypted at rest using industry-standard AES-256 encryption.",
        "Access Controls — we implement role-based access controls (RBAC) to ensure that only authorised personnel can access systems containing personal data. All access is logged and auditable.",
        "Authentication — we use secure token-based authentication (JWT) and support optional two-factor authentication (2FA) for account security.",
        "Regular Security Audits — we conduct periodic security assessments, vulnerability scanning, and penetration testing to identify and address potential security risks.",
        "Incident Response — we maintain an incident response plan to promptly detect, investigate, and respond to any security breaches. Affected users will be notified in accordance with applicable law.",
        "Staff Training — all team members with access to personal data receive regular training on data protection and security best practices.",
        "Infrastructure Security — our cloud infrastructure on AWS includes network firewalls, DDoS protection, intrusion detection systems, and automated threat monitoring.",
      ],
      after: `While we implement robust security measures, no method of transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security but are committed to promptly addressing any security incidents.`,
    },
    bn: {
      title: "৫. ডেটা নিরাপত্তা",
      body: `আমরা আপনার ডেটার নিরাপত্তাকে গুরুত্বের সাথে নিই এবং একাধিক স্তরের সুরক্ষা প্রয়োগ করি:`,
      list: [
        "ট্রানজিটে এনক্রিপশন — আপনার ডিভাইস এবং আমাদের সার্ভারের মধ্যে প্রেরিত সমস্ত ডেটা HTTPS/TLS (ট্রান্সপোর্ট লেয়ার সিকিউরিটি) ব্যবহার করে এনক্রিপ্ট করা হয়।",
        "স্টোরেজে এনক্রিপশন — আমাদের সার্ভার এবং ডাটাবেসে সংরক্ষিত ডেটা শিল্প-মানের AES-256 এনক্রিপশন ব্যবহার করে এনক্রিপ্ট করা হয়।",
        "অ্যাক্সেস নিয়ন্ত্রণ — আমরা রোল-ভিত্তিক অ্যাক্সেস নিয়ন্ত্রণ (RBAC) প্রয়োগ করি যাতে শুধুমাত্র অনুমোদিত কর্মীরা ব্যক্তিগত ডেটা সহ সিস্টেম অ্যাক্সেস করতে পারে।",
        "প্রমাণীকরণ — আমরা নিরাপদ টোকেন-ভিত্তিক প্রমাণীকরণ (JWT) ব্যবহার করি এবং অ্যাকাউন্ট নিরাপত্তার জন্য ঐচ্ছিক দ্বি-ফ্যাক্টর প্রমাণীকরণ (2FA) সমর্থন করি।",
        "নিয়মিত নিরাপত্তা নিরীক্ষা — আমরা সম্ভাব্য নিরাপত্তা ঝুঁকি সনাক্ত এবং সমাধান করতে�র্যায়ক্রমিক নিরাপত্তা মূল্যায়ন, দুর্বলতা স্ক্যানিং এবং পেনিট্রেশন পরীক্ষা পরিচালনা করি।",
        "ঘটনা প্রতিক্রিয়া — যেকোনো নিরাপত্তা লঙ্ঘন সনাক্ত, তদন্ত এবং প্রতিক্রিয়া জানাতে আমরা একটি ঘটনা প্রতিক্রিয়া পরিকল্পনা বজায় রাখি। প্রভাবিত ব্যবহারকারীদের প্রযোজ্য আইন অনুসারে জানানো হবে।",
        "কর্মী প্রশিক্ষণ — ব্যক্তিগত ডেটা অ্যাক্সেসসহ সমস্ত টিম সদস্য ডেটা সুরক্ষা এবং নিরাপত্তা সর্বোত্তম অনুশীলন নিয়ে নিয়মিত প্রশিক্ষণ পান।",
        "অবকাঠামো নিরাপত্তা — AWS-এ আমাদের ক্লাউড অবকাঠামোতে নেটওয়ার্ক ফায়ারওয়াল, DDoS সুরক্ষা, ইনট্রুশন ডিটেকশন সিস্টেম এবং স্বয়ংক্রিয় হুমকি মনিটরিং অন্তর্ভুক্ত।",
      ],
      after: `আমরা শক্তিশালী নিরাপত্তা ব্যবস্থা প্রয়োগ করলেও, ইন্টারনেটের মাধ্যমে ট্রান্সমিশন বা ইলেকট্রনিক স্টোরেজের কোনো পদ্ধতি ১০০% নিরাপদ নয়। আমরা পরম নিরাপত্তার গ্যারান্টি দিতে পারি না তবে যেকোনো নিরাপত্তা ঘটনাদ্রুত সমাধান করতে প্রতিশ্রুতিবদ্ধ।`,
    },
  },

  /* 6. Data Retention */
  {
    id: "data-retention",
    en: {
      title: "6. Data Retention",
      body: `We retain your information for different periods depending on the type of data and the purpose for which it was collected:`,
      list: [
        "Account Data — your account information, restaurant configuration, and related data are retained for as long as your account is active, plus 30 days after account deletion to allow for data recovery.",
        "Order Data — order records (including order items, amounts, timestamps, and status) are retained for 3 years from the date of the order to comply with business record-keeping and tax requirements in Bangladesh.",
        "Chat Logs — AI Concierge chatbot conversation logs are retained for 30 days, after which they are permanently deleted. Anonymised or aggregated data derived from chat logs may be retained longer for service improvement.",
        "Analytics Data — usage analytics and reporting data is anonymised after 12 months. Anonymised data cannot be linked back to individual users and is retained indefinitely for aggregate analysis.",
        "Payment Records — transaction records and payment references are retained for 5 years to comply with Bangladesh Bank regulations and tax requirements.",
        "Communications — support correspondence (email, WhatsApp) is retained for 2 years from the date of the last interaction.",
      ],
      after: `Upon account deletion, we will begin the deletion process within 30 days. Some data may persist in encrypted backups for up to 90 days before being permanently purged. Data that we are required to retain by law (e.g., tax records) will be kept for the legally mandated period.`,
    },
    bn: {
      title: "৬. ডেটা সংরক্ষণ",
      body: `ডেটার ধরন এবং সংগ্রহের উদ্দেশ্যের উপর নির্ভর করে আমরা আপনার তথ্য বিভিন্ন সময়ের জন্য সংরক্ষণ করি:`,
      list: [
        "অ্যাকাউন্ট ডেটা — আপনার অ্যাকাউন্ট তথ্য, রেস্তোরাঁ কনফিগারেশন এবং সম্পর্কিত ডেটা আপনার অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত, এবং ডেটা পুনরুদ্ধারের অনুমতি দিতে অ্যাকাউন্ট মুছে ফেলার ৩০ দিন পর পর্যন্ত সংরক্ষিত থাকে।",
        "অর্ডার ডেটা — বাংলাদেশে ব্যবসায়িক রেকর্ড-রক্ষণ এবং কর প্রয়োজনীয়তা মেনে চলতে অর্ডার রেকর্ড অর্ডারের তারিখ থেকে ৩ বছর সংরক্ষিত থাকে।",
        "চ্যাট লগ — AI কনসিয়ার্জ চ্যাটবট কথোপকথন লগ ৩০ দিন সংরক্ষিত থাকে, তারপর স্থায়ীভাবে মুছে ফেলা হয়। সেবা উন্নতির জন্য চ্যাট লগ থেকে প্রাপ্ত বেনামী বা সমষ্টিগত ডেটা দীর্ঘ সময় সংরক্ষিত হতে পারে।",
        "বিশ্লেষণ ডেটা — ব্যবহার বিশ্লেষণ এবং রিপোর্টিং ডেটা ১২ মাস পর বেনামী করা হয়। বেনামী ডেটা পৃথক ব্যবহারকারীদের সাথে লিঙ্ক করা যায় না।",
        "পেমেন্ট রেকর্ড — বাংলাদেশ ব্যাংক বিধি এবং কর প্রয়োজনীয়তা মেনে চলতে লেনদেন রেকর্ড এবং পেমেন্ট রেফারেন্স ৫ বছর সংরক্ষিত থাকে।",
        "যোগাযোগ — শেষ ইন্টারেকশনের তারিখ থেকে সাপোর্ট চিঠিপত্র (ইমেইল, হোয়াটসঅ্যাপ) ২ বছর সংরক্ষিত থাকে।",
      ],
      after: `অ্যাকাউন্ট মুছে ফেলার পর, আমরা ৩০ দিনের মধ্যে মুছে ফেলার প্রক্রিয়া শুরু করব। কিছু ডেটা স্থায়ীভাবে মুছে ফেলার আগে ৯০ দিন পর্যন্ত এনক্রিপ্টেড ব্যাকআপে থাকতে পারে। আইন দ্বারা আমাদের সংরক্ষণ করতে বাধ্য ডেটা আইনত নির্ধারিত সময়ের জন্য রাখা হবে।`,
    },
  },

  /* 7. Your Rights */
  {
    id: "your-rights",
    en: {
      title: "7. Your Rights",
      body: `You have the following rights regarding your personal data:`,
      list: [
        "Right of Access — you can request a copy of all personal data we hold about you. We will provide this within 30 days of your request.",
        "Right to Correction — you can request that we correct any inaccurate or incomplete personal data. You can also update most information directly through your account settings.",
        "Right to Deletion — you can request deletion of your account and associated personal data. We will process your request within 30 days, subject to any legal retention obligations.",
        "Right to Data Export — you can request an export of your data in a structured, commonly used, machine-readable format (JSON or CSV). This includes your restaurant data, order history, and account information.",
        "Right to Opt Out — you can opt out of non-essential communications (marketing emails, product updates, newsletters) at any time through your notification settings or by contacting us. Essential service communications (order alerts, security notifications) cannot be opted out of while your account is active.",
        "Right to Restrict Processing — in certain circumstances, you can request that we restrict the processing of your personal data.",
        "Right to Object — you can object to the processing of your personal data for specific purposes, such as analytics or AI training.",
      ],
      after: `To exercise any of these rights, please contact us at support@tomodine.com or via WhatsApp at +880 1779 184386. We will verify your identity before processing any request. We aim to respond to all rights requests within 30 business days.`,
    },
    bn: {
      title: "৭. আপনার অধিকার",
      body: `আপনার ব্যক্তিগত ডেটা সম্পর্কে আপনার নিম্নলিখিত অধিকার রয়েছে:`,
      list: [
        "অ্যাক্সেসের অধিকার — আপনি আমাদের কাছে আপনার সম্পর্কে আমাদের কাছে থাকা সমস্ত ব্যক্তিগত ডেটার কপি অনুরোধ করতে পারেন। আমরা আপনার অনুরোধের ৩০ দিনের মধ্যে এটি প্রদান করব।",
        "সংশোধনের অধিকার — আপনি কোনো ভুল বা অসম্পূর্ণ ব্যক্তিগত ডেটা সংশোধন করার অনুরোধ করতে পারেন। আপনি আপনার অ্যাকাউন্ট সেটিংসের মাধ্যমে সরাসরি বেশিরভাগ তথ্য আপডেট করতে পারেন।",
        "মুছে ফেলার অধিকার — আপনি আপনার অ্যাকাউন্ট এবং সংশ্লিষ্ট ব্যক্তিগত ডেটা মুছে ফেলার অনুরোধ করতে পারেন। কোনো আইনি সংরক্ষণ বাধ্যবাধকতার সাপেক্ষে, আমরা ৩০ দিনের মধ্যে আপনার অনুরোধ প্রক্রিয়া করব।",
        "ডেটা রপ্তানির অধিকার — আপনি একটি কাঠামোগত, সাধারণত ব্যবহৃত, মেশিন-পঠনযোগ্য ফরম্যাটে (JSON বা CSV) আপনার ডেটার রপ্তানি অনুরোধ করতে পারেন।",
        "অপ্ট আউটের অধিকার — আপনি যেকোনো সময় আপনার নোটিফিকেশন সেটিংস বা আমাদের সাথে যোগাযোগ করে অ-প্রয়োজনীয় যোগাযোগ (মার্কেটিং ইমেইল, পণ্য আপডেট, নিউজলেটার) থেকে অপ্ট আউট করতে পারেন।",
        "প্রক্রিয়াকরণ সীমাবদ্ধ করার অধিকার — নির্দিষ্ট পরিস্থিতিতে, আপনি আপনার ব্যক্তিগত ডেটার প্রক্রিয়াকরণ সীমাবদ্ধ করার অনুরোধ করতে পারেন।",
        "আপত্তির অধিকার — বিশ্লেষণ বা AI প্রশিক্ষণের মতো নির্দিষ্ট উদ্দেশ্যে আপনার ব্যক্তিগত ডেটার প্রক্রিয়াকরণের বিরুদ্ধে আপত্তি জানাতে পারেন।",
      ],
      after: `এই যেকোনো অধিকার প্রয়োগ করতে, অনুগ্রহ করে support@tomodine.com এ বা হোয়াটসঅ্যাপে +880 1779 184386 নম্বরে আমাদের সাথে যোগাযোগ করুন। কোনো অনুরোধ প্রক্রিয়া করার আগে আমরা আপনার পরিচয় যাচাই করব। আমরা ৩০ কার্যদিবসের মধ্যে সমস্ত অধিকার অনুরোধের উত্তর দিতে চেষ্টা করি।`,
    },
  },

  /* 8. Cookies and Tracking Technologies */
  {
    id: "cookies",
    en: {
      title: "8. Cookies and Tracking Technologies",
      body: `We use cookies and similar tracking technologies to operate the Platform and improve your experience:`,
      list: [
        "Essential Cookies — required for the Platform to function properly, including authentication tokens, session management, and security features. These cannot be disabled.",
        "Functional Cookies — remember your preferences such as language selection, theme, and display settings to provide a personalised experience.",
        "Analytics Cookies — help us understand how users interact with the Platform by collecting anonymised usage data. This helps us improve the Platform's performance and usability.",
        "Third-Party Cookies — our payment processors and analytics providers may set their own cookies. These are governed by the respective third party's privacy policy.",
        "Device Fingerprinting — for QR code ordering, we generate a device fingerprint by hashing non-personal browser characteristics (screen resolution, timezone, browser type, language). This hash is used to maintain session continuity and ensure that each device at a shared table has its own isolated orders and chat history. The fingerprint contains no personal data, cannot identify you across websites, and is not used for advertising or tracking purposes.",
      ],
      after: `You can manage your cookie preferences through your browser settings or through our Cookie Settings page. Disabling essential cookies may affect the functionality of the Platform. For more details, please visit our Cookie Settings page.`,
    },
    bn: {
      title: "৮. কুকি এবং ট্র্যাকিং প্রযুক্তি",
      body: `আমরা প্ল্যাটফর্ম পরিচালনা করতে এবং আপনার অভিজ্ঞতা উন্নত করতে কুকি এবং অনুরূপ ট্র্যাকিং প্রযুক্তি ব্যবহার করি:`,
      list: [
        "অত্যাবশ্যক কুকি — প্ল্যাটফর্ম সঠিকভাবে কাজ করার জন্য প্রয়োজনীয়, যার মধ্যে প্রমাণীকরণ টোকেন, সেশন ব্যবস্থাপনা এবং নিরাপত্তা বৈশিষ্ট্য অন্তর্ভুক্ত। এগুলি নিষ্ক্রিয় করা যায় না।",
        "কার্যকরী কুকি — ভাষা নির্বাচন, থিম এবং প্রদর্শন সেটিংসের মতো আপনার পছন্দগুলি মনে রাখে ব্যক্তিগতকৃত অভিজ্ঞতা প্রদান করতে।",
        "বিশ্লেষণ কুকি — বেনামী ব্যবহার ডেটা সংগ্রহ করে ব্যবহারকারীরা কীভাবে প্ল্যাটফর্মের সাথে ইন্টার্যাক্ট করে তা বুঝতে সাহায্য করে। এটি প্ল্যাটফর্মের কার্যকারিতা এবং ব্যবহারযোগ্যতা উন্নত করতে সাহায্য করে।",
        "তৃতীয় পক্ষের কুকি — আমাদের পেমেন্ট প্রসেসর এবং বিশ্লেষণ প্রদানকারীরা তাদের নিজস্ব কুকি সেট করতে পারে। এগুলি সংশ্লিষ্ট তৃতীয় পক্ষের গোপনীয়তা নীতি দ্বারা নিয়ন্ত্রিত।",
        "ডিভাইস ফিঙ্গারপ্রিন্টিং — QR কোড অর্ডারিংয়ের জন্য, আমরা অ-ব্যক্তিগত ব্রাউজার বৈশিষ্ট্য (স্ক্রিন রেজোলিউশন, টাইমজোন, ব্রাউজারের ধরন, ভাষা) হ্যাশ করে একটি ডিভাইস ফিঙ্গারপ্রিন্ট তৈরি করি। এই হ্যাশ সেশন ধারাবাহিকতা বজায় রাখতে এবং একটি শেয়ার্ড টেবিলে প্রতিটি ডিভাইসের নিজস্ব আলাদা অর্ডার এবং চ্যাট ইতিহাস নিশ্চিত করতে ব্যবহৃত হয়। ফিঙ্গারপ্রিন্টে কোনো ব্যক্তিগত তথ্য নেই, ওয়েবসাইট জুড়ে আপনাকে শনাক্ত করতে পারে না এবং বিজ্ঞাপন বা ট্র্যাকিং উদ্দেশ্যে ব্যবহৃত হয় না।",
      ],
      after: `আপনি আপনার ব্রাউজার সেটিংস বা আমাদের কুকি সেটিংস পৃষ্ঠার মাধ্যমে আপনার কুকি পছন্দ পরিচালনা করতে পারেন। অত্যাবশ্যক কুকি নিষ্ক্রিয় করলে প্ল্যাটফর্মের কার্যকারিতা প্রভাবিত হতে পারে। আরও বিস্তারিত জানতে, অনুগ্রহ করে আমাদের কুকি সেটিংস পৃষ্ঠায় যান।`,
    },
  },

  /* 9. Children's Privacy */
  {
    id: "children",
    en: {
      title: "9. Children's Privacy",
      body: `The TomoDine Platform is designed for use by restaurant businesses and their authorised staff. The Platform is not directed at children under the age of 13, and we do not knowingly collect personal information from children under 13.

While customers of all ages may place orders through the QR code ordering system, the ordering process does not require the collection of personal information from the customer. Order data (such as order items and table number) is processed anonymously unless the customer voluntarily provides their details.

If you are a parent or guardian and believe that your child has provided personal information to us without your consent, please contact us at support@tomodine.com. We will promptly delete any such information.

For restaurant staff accounts, we require that all users be at least 18 years of age or the age of legal majority in Bangladesh.`,
    },
    bn: {
      title: "৯. শিশুদের গোপনীয়তা",
      body: `TomoDine প্ল্যাটফর্ম রেস্তোরাঁ ব্যবসায় এবং তাদের অনুমোদিত কর্মীদের দ্বারা ব্যবহারের জন্য ডিজাইন করা হয়েছে। প্ল্যাটফর্ম ১৩ বছরের কম বয়সী শিশুদের জন্য নির্দেশিত নয়, এবং আমরা সচেতনভাবে ১৩ বছরের কম বয়সী শিশুদের কাছ থেকে ব্যক্তিগত তথ্য সংগ্রহ করি না।

সকল বয়সের গ্রাহকরা QR কোড অর্ডারিং সিস্টেমের মাধ্যমে অর্ডার দিতে পারলেও, অর্ডারিং প্রক্রিয়ায় গ্রাহকের কাছ থেকে ব্যক্তিগত তথ্য সংগ্রহের প্রয়োজন হয় না। গ্রাহক স্বেচ্ছায় তাদের বিবরণ প্রদান না করা পর্যন্ত অর্ডার ডেটা বেনামীভাবে প্রক্রিয়া করা হয়।

আপনি যদি একজন অভিভাবক হন এবং বিশ্বাস করেন যে আপনার সন্তান আপনার সম্মতি ছাড়া আমাদের কাছে ব্যক্তিগত তথ্য প্রদান করেছে, তাহলে অনুগ্রহ করে support@tomodine.com এ আমাদের সাথে যোগাযোগ করুন। আমরা সেই তথ্য দ্রুত মুছে ফেলব।

রেস্তোরাঁ স্টাফ অ্যাকাউন্টের জন্য, আমরা প্রয়োজন করি যে সমস্ত ব্যবহারকারী কমপক্ষে ১৮ বছর বয়সী বা বাংলাদেশে আইনি পরিপক্বতার বয়সের হতে হবে।`,
    },
  },

  /* 10. International Data Transfers */
  {
    id: "data-transfers",
    en: {
      title: "10. International Data Transfers",
      body: `TomoDine is based in Bangladesh, and your data is primarily stored on servers located in AWS data centres. However, your data may be processed in different geographic regions for the following reasons:`,
      list: [
        "Cloud Infrastructure — our primary data storage is hosted on AWS. AWS operates data centres in multiple regions worldwide, and your data may be replicated across regions for redundancy, disaster recovery, and performance optimisation.",
        "AI and Machine Learning — certain anonymised or aggregated data may be processed by AI service providers in other jurisdictions for chatbot functionality and service improvement.",
        "Content Delivery — static assets such as images may be served through content delivery networks (CDNs) with edge locations in multiple countries to ensure fast loading times.",
      ],
      after: `When we transfer data internationally, we ensure that appropriate safeguards are in place, including data processing agreements, standard contractual clauses, and compliance with applicable data protection laws. We take reasonable steps to ensure that your data receives an adequate level of protection regardless of where it is processed.`,
    },
    bn: {
      title: "১০. আন্তর্জাতিক ডেটা স্থানান্তর",
      body: `TomoDine বাংলাদেশে অবস্থিত, এবং আপনার ডেটা প্রাথমিকভাবে AWS ডেটা সেন্টারে অবস্থিত সার্ভারে সংরক্ষিত থাকে। তবে, নিম্নলিখিত কারণে আপনার ডেটা বিভিন্ন ভৌগোলিক অঞ্চলে প্রক্রিয়া করা হতে পারে:`,
      list: [
        "ক্লাউড অবকাঠামো — আমাদের প্রাথমিক ডেটা স্টোরেজ AWS-এ হোস্ট করা হয়। AWS বিশ্বব্যাপী একাধিক অঞ্চলে ডেটা সেন্টার পরিচালনা করে, এবং আপনার ডেটা রিডানডেন্সি, দুর্যোগ পুনরুদ্ধার এবং কার্যকারিতা অপটিমাইজেশনের জন্য অঞ্চল জুড়ে প্রতিলিপি করা হতে পারে।",
        "AI এবং মেশিন লার্নিং — চ্যাটবট কার্যকারিতা এবং সেবা উন্নতির জন্য নির্দিষ্ট বেনামী বা সমষ্টিগত ডেটা অন্য এখতিয়ারে AI সেবা প্রদানকারীদের দ্বারা প্রক্রিয়া করা হতে পারে।",
        "কন্টেন্ট ডেলিভারি — দ্রুত লোডিং সময় নিশ্চিত করতে ছবির মতো স্ট্যাটিক সম্পদ একাধিক দেশে এজ লোকেশন সহ কন্টেন্ট ডেলিভারি নেটওয়ার্ক (CDN) এর মাধ্যমে পরিবেশন করা হতে পারে।",
      ],
      after: `আমরা আন্তর্জাতিকভাবে ডেটা স্থানান্তর করার সময়, আমরা নিশ্চিত করি যে উপযুক্ত সুরক্ষা ব্যবস্থা রয়েছে, যার মধ্যে ডেটা প্রক্রিয়াকরণ চুক্তি, মান চুক্তিগত ধারা এবং প্রযোজ্য ডেটা সুরক্ষা আইনের সম্মতি অন্তর্ভুক্ত। আপনার ডেটা যেখানেই প্রক্রিয়া করা হোক না কেন, পর্যাপ্ত সুরক্ষা স্তর পায় তা নিশ্চিত করতে আমরা যুক্তিসঙ্গত পদক্ষেপ নিই।`,
    },
  },

  /* 11. Changes to This Policy */
  {
    id: "changes",
    en: {
      title: "11. Changes to This Policy",
      body: `We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or the Platform's functionality. When we make changes, we will:`,
      list: [
        "Update the 'Last updated' date at the top of this page.",
        "For material changes (such as changes to data collection, sharing practices, or your rights), we will notify active subscribers via email or an in-app notification at least 15 days before the changes take effect.",
        "Post the revised Policy on this page with a clear indication of what has changed.",
      ],
      after: `We encourage you to review this Policy periodically. Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the revised Policy. If you do not agree with the changes, you should stop using the Platform and request deletion of your account before the changes take effect.`,
    },
    bn: {
      title: "১১. এই নীতিতে পরিবর্তন",
      body: `আমরা আমাদের অনুশীলন, আইনি প্রয়োজনীয়তা বা প্ল্যাটফর্মের কার্যকারিতায় পরিবর্তন প্রতিফলিত করতে সময়ে সময়ে এই গোপনীয়তা নীতি আপডেট করতে পারি। আমরা পরিবর্তন করলে:`,
      list: [
        "এই পৃষ্ঠার শীর্ষে 'সর্বশেষ আপডেট' তারিখ আপডেট করব।",
        "উল্লেখযোগ্য পরিবর্তনের জন্য (যেমন ডেটা সংগ্রহ, শেয়ারিং অনুশীলন বা আপনার অধিকারের পরিবর্তন), পরিবর্তন কার্যকর হওয়ার কমপক্ষে ১৫ দিন আগে সক্রিয় সাবস্ক্রাইবারদের ইমেইল বা ইন-অ্যাপ বিজ্ঞপ্তির মাধ্যমে জানাব।",
        "কী পরিবর্তন হয়েছে তার স্পষ্ট নির্দেশনা সহ সংশোধিত নীতি এই পৃষ্ঠায় পোস্ট করব।",
      ],
      after: `আমরা আপনাকে পর্যায়ক্রমে এই নীতি পর্যালোচনা করতে উৎসাহিত করি। কোনো পরিবর্তনের কার্যকর তারিখের পর প্ল্যাটফর্মের আপনার ক্রমাগত ব্যবহার সংশোধিত নীতির আপনার গ্রহণযোগ্যতা গঠন করে। আপনি যদি পরিবর্তনগুলির সাথে সম্মত না হন, তাহলে পরিবর্তন কার্যকর হওয়ার আগে প্ল্যাটফর্ম ব্যবহার বন্ধ করতে এবং আপনার অ্যাকাউন্ট মুছে ফেলার অনুরোধ করতে হবে।`,
    },
  },

  /* 12. Contact Us */
  {
    id: "contact",
    en: {
      title: "12. Contact Us",
      body: `If you have any questions, concerns, or complaints about this Privacy Policy or our data practices, please contact us:`,
      list: [
        "Email: support@tomodine.com",
        "WhatsApp: +880 1779 184386",
        "Website: www.tomodine.com",
      ],
      after: `We aim to respond to all privacy-related enquiries within 2 business days. If you are not satisfied with our response, you have the right to lodge a complaint with the relevant data protection authority in Bangladesh.`,
    },
    bn: {
      title: "১২. আমাদের সাথে যোগাযোগ করুন",
      body: `এই গোপনীয়তা নীতি বা আমাদের ডেটা অনুশীলন সম্পর্কে আপনার কোনো প্রশ্ন, উদ্বেগ বা অভিযোগ থাকলে, অনুগ্রহ করে আমাদের সাথে যোগাযোগ করুন:`,
      list: [
        "ইমেইল: support@tomodine.com",
        "হোয়াটসঅ্যাপ: +880 1779 184386",
        "ওয়েবসাইট: www.tomodine.com",
      ],
      after: `আমরা ২ কার্যদিবসের মধ্যে সমস্ত গোপনীয়তা-সম্পর্কিত অনুসন্ধানের উত্তর দিতে চেষ্টা করি। আপনি যদি আমাদের প্রতিক্রিয়ায় সন্তুষ্ট না হন, তাহলে বাংলাদেশের সংশ্লিষ্ট ডেটা সুরক্ষা কর্তৃপক্ষের কাছে অভিযোগ দায়ের করার অধিকার আপনার রয়েছে।`,
    },
  },

  /* 13. Governing Law */
  {
    id: "governing-law",
    en: {
      title: "13. Governing Law",
      body: `This Privacy Policy shall be governed by and construed in accordance with the laws of the People's Republic of Bangladesh, including but not limited to:`,
      list: [
        "The Information and Communication Technology Act 2006",
        "The Cyber Security Ordinance 2025",
        "The Digital Security Act 2018",
        "The Consumer Protection Act 2009",
        "Applicable Bangladesh Bank regulations for payment data",
      ],
      after: `Any disputes arising from this Privacy Policy shall be subject to the exclusive jurisdiction of the courts of Dhaka, Bangladesh.`,
    },
    bn: {
      title: "১৩. শাসন আইন",
      body: `এই গোপনীয়তা নীতি গণপ্রজাতন্ত্রী বাংলাদেশের আইন দ্বারা শাসিত এবং ব্যাখ্যা করা হবে, যার মধ্যে রয়েছে:`,
      list: [
        "তথ্য ও যোগাযোগ প্রযুক্তি আইন ২০০৬",
        "সাইবার নিরাপত্তা অধ্যাদেশ ২০২৫",
        "ডিজিটাল নিরাপত্তা আইন ২০১৮",
        "ভোক্তা সুরক্ষা আইন ২০০৯",
        "পেমেন্ট ডেটার জন্য প্রযোজ্য বাংলাদেশ ব্যাংক বিধি",
      ],
      after: `এই গোপনীয়তা নীতি থেকে উদ্ভূত যেকোনো বিরোধ ঢাকা, বাংলাদেশের আদালতের একচেটিয়া এখতিয়ারের অধীন হবে।`,
    },
  },

  /* 14. Severability */
  {
    id: "severability",
    en: {
      title: "14. Severability",
      body: `If any provision of this Privacy Policy is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, or if modification is not possible, it shall be severed from this Policy. The remaining provisions shall continue in full force and effect.`,
    },
    bn: {
      title: "১৪. পৃথকীকরণ",
      body: `এই গোপনীয়তা নীতির কোনো বিধান যদি একটি সক্ষম এখতিয়ারের আদালত দ্বারা অবৈধ, বেআইনি বা প্রয়োগযোগ্য নয় বলে বিবেচিত হয়, তাহলে সেই বিধানটি বৈধ এবং প্রয়োগযোগ্য করার জন্য ন্যূনতম পরিমাণে পরিবর্তন করা হবে, অথবা পরিবর্তন সম্ভব না হলে, এটি এই নীতি থেকে পৃথক করা হবে। অবশিষ্ট বিধানগুলি সম্পূর্ণ শক্তি এবং কার্যকারিতায় চলতে থাকবে।`,
    },
  },
] as const;

/* ── Component ───────────────────────────────────────────────── */

export function PrivacyPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";

  return (
    <section aria-labelledby="privacy-heading" className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-brand-600"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M19 12H5m6-6-6 6 6 6" />
        </svg>
        {lang === "bn" ? "হোমপেজে ফিরে যান" : "Back to Home"}
      </Link>

      {/* Header */}
      <div>
        <h1 id="privacy-heading" className="text-lg font-semibold text-ink-900">
          {lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}
        </h1>
        <p className="mt-1 text-xs text-ink-400">
          {lang === "bn"
            ? "সর্বশেষ আপডেট: ২৪ আগস্ট, ২০২৬"
            : "Last updated: August 24, 2026"}
        </p>
      </div>

      {/* Intro */}
      <div className="card p-5">
        <p className="text-sm leading-relaxed text-ink-600">
          {lang === "bn"
            ? "TomoDine-তে আপনার গোপনীয়তা আমাদের কাছে গুরুত্বপূর্ণ। এই গোপনীয়তা নীতি ব্যাখ্যা করে যে আমরা কীভাবে আপনার ব্যক্তিগত তথ্য সংগ্রহ, ব্যবহার, সংরক্ষণ এবং সুরক্ষা করি। অনুগ্রহ করে এটি সাবধানে পড়ুন।"
            : "Your privacy matters at TomoDine. This Privacy Policy explains how we collect, use, store, and protect your personal information. Please read it carefully."}
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const s = section[lang];
        return (
          <div key={section.id} id={section.id} className="card p-5">
            <h2 className="text-sm font-semibold text-ink-900">{s.title}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">
              {s.body}
            </p>

            {"list" in s && s.list && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-600">
                {s.list.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}

            {"after" in s && s.after && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                {s.after}
              </p>
            )}
          </div>
        );
      })}

      {/* Quick Links */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          {lang === "bn" ? "সম্পর্কিত পৃষ্ঠা" : "Related Pages"}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to="/terms"
            className="rounded-lg border border-ink-100 bg-ink-25 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-600"
          >
            {lang === "bn" ? "ব্যবহারের শর্তাবলী" : "Terms of Use"}
          </Link>
          <Link
            to="/cookies"
            className="rounded-lg border border-ink-100 bg-ink-25 px-4 py-2 text-sm text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-600"
          >
            {lang === "bn" ? "কুকি সেটিংস" : "Cookie Settings"}
          </Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-relaxed text-amber-800">
          {lang === "bn"
            ? "দাবিত্যাগ: এই ডকুমেন্টটি আইনি পরামর্শ নয়। এটি শুধুমাত্র তথ্যগত উদ্দেশ্যে প্রদান করা হয়েছে। এটি TomoDine প্ল্যাটফর্ম এবং সেবার মাধ্যমে আপনার ব্যক্তিগত তথ্যের সংগ্রহ, ব্যবহার এবং সুরক্ষা সম্পর্কিত নীতি নির্ধারণ করে। আইনি পরামর্শের জন্য অনুগ্রহ করে একজন যোগ্য আইনজীবীর সাথে পরামর্শ করুন।"
            : "Disclaimer: This document is not legal advice. It is provided for informational purposes only and constitutes the policy governing the collection, use, and protection of your personal information through the TomoDine platform and services. For legal advice, please consult a qualified legal professional."}
        </p>
      </div>
    </section>
  );
}
