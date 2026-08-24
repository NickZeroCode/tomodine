/**
 * TermsPage — Terms of Use for TomoDine platform.
 *
 * Full bilingual (English / Bengali) terms covering: acceptance, service
 * description, account registration, subscriptions, user obligations,
 * IP, data & privacy, payments, liability, termination, dispute resolution,
 * governing law, severability, and contact information.
 *
 * Follows the TomoDine Design System.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* ── Section data ────────────────────────────────────────────── */

const SECTIONS = [
  /* 1. Acceptance of Terms */
  {
    id: "acceptance",
    en: {
      title: "1. Acceptance of Terms",
      body: `By accessing or using the TomoDine platform ("Platform"), including our website, mobile applications, APIs, and all related services (collectively, the "Services"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Use ("Terms") and our Privacy Policy. If you do not agree to these Terms, you must not access or use the Services.

These Terms constitute a legally binding agreement between you ("User", "you", or "your") and TomoDine ("Company", "we", "us", or "our"), a company incorporated under the laws of the People's Republic of Bangladesh. By creating an account or using any part of the Services, you represent and warrant that you have the legal capacity to enter into this agreement under the Contract Act 1872 of Bangladesh.`,
    },
    bn: {
      title: "১. শর্তাবলীর গ্রহণ",
      body: `TomoDine প্ল্যাটফর্ম ("প্ল্যাটফর্ম") অ্যাক্সেস বা ব্যবহার করে, আমাদের ওয়েবসাইট, মোবাইল অ্যাপ্লিকেশন, API এবং সমস্ত সম্পর্কিত সেবা (সম্মিলিতভাবে, "সেবা") সহ, আপনি স্বীকার করেন যে আপনি এই ব্যবহারের শর্তাবলী ("শর্তাবলী") এবং আমাদের গোপনীয়তা নীতি পড়েছেন, বুঝেছেন এবং তাদের দ্বারা আবদ্ধ হতে সম্মত হয়েছেন। আপনি যদি এই শর্তাবলীতে সম্মত না হন, তাহলে আপনাকে অবশ্যই সেবা অ্যাক্সেস বা ব্যবহার করা উচিত নয়।

এই শর্তাবলী আপনার ("ব্যবহারকারী", "আপনি") এবং TomoDine ("কোম্পানি", "আমরা") এর মধ্যে একটি আইনত বাধ্যকরী চুক্তি গঠন করে, যা গণপ্রজাতন্ত্রী বাংলাদেশের আইনের অধীনে অন্তর্ভুক্ত। অ্যাকাউন্ট তৈরি করে বা সেবার যেকোনো অংশ ব্যবহার করে, আপনি প্রতিনিধিত্ব এবং ওয়ারেন্টি দেন যে আপনার বাংলাদেশের চুক্তি আইন ১৮৭২ এর অধীনে এই চুক্তিতে প্রবেশের আইনি ক্ষমতা রয়েছে।`,
    },
  },

  /* 2. Description of Service */
  {
    id: "description",
    en: {
      title: "2. Description of Service",
      body: `TomoDine is a cloud-based restaurant management platform ("Software as a Service") designed for restaurants, cafés, and food-service establishments operating in Bangladesh and beyond. The Platform provides the following core capabilities:`,
      list: [
        "QR Code Ordering — customers scan table-specific QR codes to browse menus and place orders digitally.",
        "Menu Management — create, organise, and update dish listings with images, prices, categories, and dietary tags.",
        "Order Tracking — real-time order lifecycle management from placement through preparation to service.",
        "Staff & Role Management — invite team members, assign roles (Owner, Manager, Kitchen, Waiter), and manage granular permissions.",
        "Inventory & Cost Management — track raw ingredients, stock levels, recipes (Bill of Materials), and cost of goods sold.",
        "Analytics & Reporting — revenue trends, top dishes, peak-hour analysis, table utilisation, and exportable reports.",
        "AI Concierge — an intelligent chatbot that assists customers with menu discovery, recommendations, order placement, and waiter calls.",
        "Multi-branch Support — manage multiple restaurant locations from a single account with branch-level data isolation.",
        "Billing & Subscriptions — integrated subscription management with local payment methods.",
      ],
      after:
        "We continuously improve the Platform and may add, modify, or discontinue features at our sole discretion. Material changes to core functionality will be communicated to active subscribers in advance.",
    },
    bn: {
      title: "২. সেবার বিবরণ",
      body: `TomoDine হল একটি ক্লাউড-ভিত্তিক রেস্তোরাঁ ব্যবস্থাপনা প্ল্যাটফর্ম ("সফটওয়্যার এজ আ সার্ভিস") যা বাংলাদেশ এবং তার বাইরে পরিচালিত রেস্তোরাঁ, ক্যাফে এবং খাদ্য-সেবা প্রতিষ্ঠানের জন্য ডিজাইন করা হয়েছে। প্ল্যাটফর্ম নিম্নলিখিত মূল সক্ষমতা প্রদান করে:`,
      list: [
        "QR কোড অর্ডারিং — গ্রাহকরা টেবিল-নির্দিষ্ট QR কোড স্ক্যান করে মেনু ব্রাউজ করে এবং ডিজিটালভাবে অর্ডার দেয়।",
        "মেনু ব্যবস্থাপনা — ছবি, মূল্য, ক্যাটাগরি এবং ডায়েটারি ট্যাগ সহ ডিশ তালিকা তৈরি, সংগঠিত এবং আপডেট করুন।",
        "অর্ডার ট্র্যাকিং — অর্ডার দেওয়া থেকে প্রস্তুতি পর্যন্ত রিয়েল-টাইম অর্ডার জীবনচক্র ব্যবস্থাপনা।",
        "কর্মী ও ভূমিকা ব্যবস্থাপনা — টিম সদস্যদের আমন্ত্রণ জানান, ভূমিকা নির্ধারণ করুন (মালিক, ম্যানেজার, কিচেন, ওয়েটার) এবং অনুমতি পরিচালনা করুন।",
        "ইনভেন্টরি ও খরচ ব্যবস্থাপনা — কাঁচামাল, স্টক লেভেল, রেসিপি এবং পণ্যের খরচ ট্র্যাক করুন।",
        "বিশ্লেষণ ও রিপোর্টিং — আয়ের প্রবণতা, শীর্ষ ডিশ, পিক আওয়ার বিশ্লেষণ এবং রপ্তানিযোগ্য রিপোর্ট।",
        "AI কনসিয়ার্জ — মেনু আবিষ্কার, সুপারিশ, অর্ডার এবং ওয়েটার কলে গ্রাহকদের সহায়তা করে এমন একটি বুদ্ধিমান চ্যাটবট।",
        "মাল্টি-ব্রাঞ্চ সমর্থন — একটি একক অ্যাকাউন্ট থেকে একাধিক রেস্তোরাঁ অবস্থান পরিচালনা করুন।",
        "বিলিং ও সাবস্ক্রিপশন — স্থানীয় পেমেন্ট পদ্ধতি সহ ইন্টিগ্রেটেড সাবস্ক্রিপশন ব্যবস্থাপনা।",
      ],
      after:
        "আমরা ক্রমাগত প্ল্যাটফর্ম উন্নত করি এবং আমাদের একচেটিয়া বিবেচনায় বৈশিষ্ট্য যোগ, পরিবর্তন বা বন্ধ করতে পারি। মূল কার্যকারিতায় উল্লেখযোগ্য পরিবর্তন সক্রিয় সাবস্ক্রাইবারদের আগাম জানানো হবে।",
    },
  },

  /* 3. Account Registration */
  {
    id: "account",
    en: {
      title: "3. Account Registration",
      body: `To access the full functionality of the Platform, you must create an account. By registering, you agree to the following:`,
      list: [
        "You must be at least 18 years of age, or the age of legal majority in Bangladesh, whichever is greater.",
        "You must provide accurate, current, and complete information during registration and keep your account information up to date.",
        "You are solely responsible for maintaining the confidentiality of your account credentials, including your password.",
        "You are responsible for all activities that occur under your account, whether or not you authorised them.",
        "You must notify us immediately at support@tomodine.com if you suspect any unauthorised access to your account.",
        "We reserve the right to suspend or terminate accounts that contain false or misleading information.",
        "Each account is intended for use by a single restaurant business. Sharing accounts across unrelated businesses is not permitted.",
      ],
      after:
        "We implement industry-standard security measures including encrypted password storage, secure token-based authentication, and optional two-factor authentication. However, you acknowledge that no system is completely secure and you use the Platform at your own risk.",
    },
    bn: {
      title: "৩. অ্যাকাউন্ট নিবন্ধন",
      body: `প্ল্যাটফর্মের সম্পূর্ণ কার্যকারিতা অ্যাক্সেস করতে, আপনাকে একটি অ্যাকাউন্ট তৈরি করতে হবে। নিবন্ধন করে, আপনি নিম্নলিখিত বিষয়ে সম্মত হন:`,
      list: [
        "আপনাকে অবশ্যই কমপক্ষে ১৮ বছর বয়সী হতে হবে, অথবা বাংলাদেশে আইনি পরিপক্বতার বয়স, যেটি বেশি।",
        "নিবন্ধনের সময় আপনাকে সঠিক, বর্তমান এবং সম্পূর্ণ তথ্য প্রদান করতে হবে এবং আপনার অ্যাকাউন্ট তথ্য আপডেট রাখতে হবে।",
        "আপনার অ্যাকাউন্টের শংসাপত্রের গোপনীয়তা বজায় রাখার দায়িত্ব সম্পূর্ণরূপে আপনার।",
        "আপনার অ্যাকাউন্টের অধীনে ঘটে এমন সমস্ত কার্যকলাপের জন্য আপনি দায়ী, আপনি তা অনুমোদন করেছেন কিনা তা নির্বিশেষে।",
        "আপনার অ্যাকাউন্টে কোনো অননুমোদিত প্রবেশের সন্দেহ হলে আপনাকে অবিলম্বে support@tomodine.com এ জানাতে হবে।",
        "মিথ্যা বা বিভ্রান্তিকর তথ্য সহ অ্যাকাউন্ট স্থগিত বা বাতিল করার অধিকার আমরা সংরক্ষণ করি।",
        "প্রতিটি অ্যাকাউন্ট একটি একক রেস্তোরাঁ ব্যবসার জন্য প্রযোজ্য।",
      ],
      after:
        "আমরা এনক্রিপ্টেড পাসওয়ার্ড স্টোরেজ, সুরক্ষিটোকেন-ভিত্তিক প্রমাণীকরণ এবং ঐচ্ছিক দ্বি-ফ্যাক্টর প্রমাণীকরণ সহ শিল্প-মানের নিরাপত্তা ব্যবস্থা প্রয়োগ করি। তবে, আপনি স্বীকার করেন যে কোনো সিস্টেম সম্পূর্ণ নিরাপদ নয় এবং আপনি নিজ ঝুঁকিতে প্ল্যাটফর্ম ব্যবহার করেন।",
    },
  },

  /* 4. Free Trial and Subscription */
  {
    id: "trial",
    en: {
      title: "4. Free Trial and Subscription",
      body: `TomoDine offers a 14-day free trial to all new users, subject to the following terms:`,
      list: [
        "The free trial begins on the date of account creation and expires automatically after 14 calendar days.",
        "During the trial period, you have access to all features of the Platform without charge.",
        "At the end of the trial, your account will be restricted until you select and subscribe to a paid plan.",
        "Your data, configurations, and settings are preserved for 90 days after trial expiry, after which they may be permanently deleted.",
        "Only one free trial is permitted per restaurant business. Creating multiple accounts to obtain additional trials is prohibited.",
      ],
      after: `Upon subscribing, your subscription will automatically renew at the end of each billing cycle (monthly or annually, as selected) unless you cancel before the renewal date. Subscription fees are charged in Bangladeshi Taka (BDT). We reserve the right to modify subscription prices with at least 30 days' prior notice to existing subscribers.`,
    },
    bn: {
      title: "৪. ফ্রি ট্রায়াল এবং সাবস্ক্রিপশন",
      body: `TomoDine সমস্ত নতুন ব্যবহারকারীদের জন্য ১৪ দিনের ফ্রি ট্রায়াল অফার করে, নিম্নলিখিত শর্তের অধীনে:`,
      list: [
        "ফ্রি ট্রায়াল অ্যাকাউন্ট তৈরির তারিখ থেকে শুরু হয় এবং ১৪ দিন পর স্বয়ংক্রিয়ভাবে মেয়াদ শেষ হয়ে যায়।",
        "ট্রায়াল সময়কালে, আপনি বিনামূল্যে প্ল্যাটফর্মের সমস্ত বৈশিষ্ট্য অ্যাক্সেস করতে পারেন।",
        "ট্রায়াল শেষে, আপনি একটি পেইড প্ল্যান সিলেক্ট এবং সাবস্ক্রাইব না করা পর্যন্ত আপনার অ্যাকাউন্ট সীমিত থাকবে।",
        "আপনার ডেটা, কনফিগারেশন এবং সেটিংস ট্রায়াল মেয়াদ শেষের পর ৯০ দিন সংরক্ষিত থাকে, তারপর স্থায়ীভাবে মুছে যেতে পারে।",
        "প্রতি রেস্তোরাঁ ব্যবসার জন্য শুধুমাত্র একটি ফ্রি ট্রায়াল অনুমোদিত।",
      ],
      after: `সাবস্ক্রাইব করলে, প্রতিটি বিলিং চক্রের শেষে আপনার সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে নবায়ন হবে, যদি না আপনি নবায়নের আগে বাতিল করেন। সাবস্ক্রিপশন ফি বাংলাদেশি টাকায় (BDT) চার্জ করা হয়। বিদ্যমান সাবস্ক্রাইবারদের কমপক্ষে ৩০ দিনের আগাম বিজ্ঞপ্তি সহ সাবস্ক্রিপশন মূল্য পরিবর্তন করার অধিকার আমরা সংরক্ষণ করি।`,
    },
  },

  /* 5. User Obligations */
  {
    id: "obligations",
    en: {
      title: "5. User Obligations",
      body: `By using the Platform, you agree to:`,
      list: [
        "Use the Services only for lawful purposes and in compliance with all applicable laws of Bangladesh, including the Information and Communication Technology Act 2006 and the Cyber Security Ordinance 2025.",
        "Not use the Platform for any fraudulent, harmful, or illegal activity, including but not limited to money laundering, tax evasion, or violation of food safety regulations.",
        "Not attempt to reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Platform or any component thereof.",
        "Not attempt to gain unauthorised access to any part of the Platform, other users' accounts, or any systems or networks connected to the Platform.",
        "Not use automated systems, bots, scrapers, or similar tools to access the Platform without our prior written consent.",
        "Not transmit any viruses, malware, or other harmful code through the Platform.",
        "Not interfere with or disrupt the integrity or performance of the Platform or the data contained therein.",
        "Comply with all applicable food safety and hygiene regulations when using the Platform to manage restaurant operations.",
        "Ensure that all content you upload (including menu images, descriptions, and pricing) is accurate and does not infringe upon third-party intellectual property rights.",
      ],
    },
    bn: {
      title: "৫. ব্যবহারকারীর বাধ্যবাধকতা",
      body: `প্ল্যাটফর্ম ব্যবহার করে, আপনি সম্মত হন:`,
      list: [
        "শুধুমাত্র বৈধ উদ্দেশ্যে এবং বাংলাদেশের সমস্ত প্রযোজ্য আইন মেনে সেবা ব্যবহার করবেন, তথ্য ও যোগাযোগ প্রযুক্তি আইন ২০০৬ এবং সাইবার নিরাপত্তা অধ্যাদেশ ২০২৫ সহ।",
        "কোনো জালিয়াতি, ক্ষতিকর বা বেআইনি কার্যকলাপের জন্য প্ল্যাটফর্ম ব্যবহার করবেন না।",
        "প্ল্যাটফর্ম বা তার যেকোনো উপাদানের সোর্স কোড বের করার জন্য রিভার্স ইঞ্জিনিয়ার, ডিকম্পাইল বা বিচ্ছিন্ন করার চেষ্টা করবেন না।",
        "প্ল্যাটফর্মের কোনো অংশ, অন্য ব্যবহারকারীদের অ্যাকাউন্ট বা প্ল্যাটফর্মের সাথে সংযুক্ত কোনো সিস্টেমে অননুমোদিত প্রবেশের চেষ্টা করবেন না।",
        "আমাদের পূর্ব লিখিত সম্মতি ছাড়া অটোমেটেড সিস্টেম, বট, স্ক্র্যাপার বা অনুরূপ সরঞ্জাম ব্যবহার করবেন না।",
        "প্ল্যাটফর্মের মাধ্যমে কোনো ভাইরাস, ম্যালওয়্যার বা অন্যান্য ক্ষতিকর কোড প্রেরণ করবেন না।",
        "প্ল্যাটফর্মের অখণ্ডতা বা কার্যকারিতায় হস্তক্ষেপ বা বিঘ্ন ঘটাবেন না।",
        "রেস্তোরাঁ পরিচালনা পরিচালনা করতে প্ল্যাটফর্ম ব্যবহার করার সময় সমস্ত প্রযোজ্য খাদ্য নিরাপত্তা এবং স্বাস্থ্যবিধি বিধি মেনে চলবেন।",
      ],
    },
  },

  /* 6. Intellectual Property */
  {
    id: "ip",
    en: {
      title: "6. Intellectual Property",
      body: `The Platform, including its software, design, logos, trademarks, documentation, and all related intellectual property, is owned by TomoDine and protected under the Copyright Act 2000 and the Trademarks Act 2009 of Bangladesh.

You retain full ownership of all data, content, and materials you upload to the Platform ("User Content"), including menu items, images, pricing, restaurant information, and customer data. By uploading User Content, you grant TomoDine a limited, non-exclusive, worldwide licence to host, store, display, and process such content solely for the purpose of providing the Services to you.

You may not:
• Copy, modify, or distribute any part of the Platform without our prior written consent.
• Use TomoDine's trademarks, logos, or branding without authorisation.
• Create derivative works based on the Platform.

Upon termination of your account, we will delete your User Content within 30 days, except where retention is required by applicable law.`,
    },
    bn: {
      title: "৬. বৌদ্বিক সম্পদ",
      body: `প্ল্যাটফর্ম, এর সফটওয়্যার, ডিজাইন, লোগো, ট্রেডমার্ক, ডকুমেন্টেশন এবং সমস্ত সম্পর্কিত বৌদ্বিক সম্পদ সহ, TomoDine-এর মালিকানাধীন এবং বাংলাদেশের কপিরাইট আইন ২০০০ এবং ট্রেডমার্ক আইন ২০০৯ এর অধীনে সুরক্ষিত।

আপনি প্ল্যাটফর্মে আপলোড করা সমস্ত ডেটা, বিষয়বস্তু এবং উপকরণের ("ব্যবহারকারী বিষয়বস্তু") সম্পূর্ণ মালিকানা বজায় রাখেন, যার মধ্যে মেনু আইটেম, ছবি, মূল্য, রেস্তোরাঁ তথ্য এবং গ্রাহক ডেটা অন্তর্ভুক্ত। ব্যবহারকারী বিষয়বস্তু আপলোড করে, আপনি TomoDine-কে শুধুমাত্র আপনাকে সেবা প্রদানের উদ্দেশ্যে এমন বিষয়বস্তু হোস্ট, স্টোর, প্রদর্শন এবং প্রক্রিয়া করার জন্য একটি সীমিত, অ-একচেটিয়া, বিশ্বব্যাপী লাইসেন্স প্রদান করেন।

আপনি পারবেন না:
• আমাদের পূর্ব লিখিত সম্মতি ছাড়া প্ল্যাটফর্মের কোনো অংশ কপি, পরিবর্তন বা বিতরণ করতে।
• অনুমোদন ছাড়া TomoDine-এর ট্রেডমার্ক, লোগো বা ব্র্যান্ডিং ব্যবহার করতে।

আপনার অ্যাকাউন্ট বাতিল হলে, প্রযোজ্য আইন দ্বারা প্রয়োজন ছাড়া, আমরা ৩০ দিনের মধ্যে আপনার ব্যবহারকারী বিষয়বস্তু মুছে ফেলব।`,
    },
  },

  /* 7. Data and Privacy */
  {
    id: "data",
    en: {
      title: "7. Data and Privacy",
      body: `Your privacy is important to us. Our collection, use, storage, and disclosure of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.

By using the Platform, you consent to the processing of personal data as described in the Privacy Policy. We comply with the provisions of the Information and Communication Technology Act 2006 of Bangladesh regarding data protection.

Key commitments include:
• We do not sell your personal data to third parties.
• Customer data collected through the Platform (e.g., orders, preferences) belongs to you and is processed solely to provide the Services.
• We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure, or destruction.
• You have the right to request access to, correction of, or deletion of your personal data by contacting us at support@tomodine.com.

For complete details, please review our Privacy Policy.`,
    },
    bn: {
      title: "৭. ডেটা ও গোপনীয়তা",
      body: `আপনার গোপনীয়তা আমাদের কাছে গুরুত্বপূর্ণ। আপনার ব্যক্তিগত তথ্য সংগ্রহ, ব্যবহার, সংরক্ষণ এবং প্রকাশ আমাদের গোপনীয়তা নীতি দ্বারা নিয়ন্ত্রিত, যা রেফারেন্স দ্বারা এই শর্তাবলীতে অন্তর্ভুক্ত।

প্ল্যাটফর্ম ব্যবহার করে, আপনি গোপনীয়তা নীতিতে বর্ণিত ব্যক্তিগত ডেটা প্রক্রিয়াকরণে সম্মত হন। আমরা ডেটা সুরক্ষা সম্পর্কে বাংলাদেশের তথ্য ও যোগাযোগ প্রযুক্তি আইন ২০০৬ এর বিধান মেনে চলি।

মূল প্রতিশ্রুতি:
• আমরা আপনার ব্যক্তিগত ডেটা তৃতীয় পক্ষের কাছে বিক্রি করি না।
• প্ল্যাটফর্মের মাধ্যমে সংগৃহীত গ্রাহক ডেটা আপনার এবং শুধুমাত্র সেবা প্রদানের জন্য প্রক্রিয়া করা হয়।
• আমরা আপনার ডেটা সুরক্ষার জন্য উপযুক্ত প্রযুক্তিগত এবং সাংগঠনিক ব্যবস্থা প্রয়োগ করি।
• support@tomodine.com এ যোগাযোগ করে আপনার ব্যক্তিগত ডেটা অ্যাক্সেস, সংশোধন বা মুছে ফেলার অনুরোধ করার অধিকার আপনার আছে।`,
    },
  },

  /* 8. Payment Terms */
  {
    id: "payment",
    en: {
      title: "8. Payment Terms",
      body: `All subscription fees are quoted and charged in Bangladeshi Taka (BDT). Payment terms are as follows:`,
      list: [
        "Billing Cycle — subscriptions are billed in advance on a monthly or annual basis, as selected during subscription.",
        "Payment Methods — we accept payments through methods supported by our payment processor, subject to Bangladesh Bank regulations.",
        "Auto-Renewal — subscriptions automatically renew at the end of each billing cycle unless cancelled at least 24 hours before the renewal date.",
        "Price Changes — we will provide at least 30 days' notice of any price changes. Continued use after a price change constitutes acceptance of the new price.",
        "Taxes — all fees are exclusive of applicable taxes (e.g., VAT). You are responsible for any taxes imposed on your use of the Services.",
        "Failed Payments — if a payment fails, we will attempt to charge your payment method up to three times over seven days. If payment is not received, your account may be suspended.",
      ],
      after: `Refund Policy: Subscription fees are non-refundable for partial months or unused portions of a billing cycle. If you believe you have been charged in error, please contact support@tomodine.com within 14 days of the charge. Annual subscriptions may be eligible for a pro-rata refund at our discretion, calculated from the date of cancellation.`,
    },
    bn: {
      title: "৮. পেমেন্ট শর্তাবলী",
      body: `সমস্ত সাবস্ক্রিপশন ফি বাংলাদেশি টাকায় (BDT) উদ্ধৃত এবং চার্জ করা হয়। পেমেন্ট শর্তাবলী:`,
      list: [
        "বিলিং চক্র — সাবস্ক্রিপশনের সময় নির্বাচিত মাসিক বা বাৎসরিক ভিত্তিতে অগ্রিম বিল করা হয়।",
        "পেমেন্ট পদ্ধতি — আমরা বাংলাদেশ ব্যাংক বিধি সাপেক্ষে আমাদের পেমেন্ট প্রসেসর দ্বারা সমর্থিত পদ্ধতিতে পেমেন্ট গ্রহণ করি।",
        "স্বয়ংক্রিয় নবায়ন — নবায়নের তারিখের কমপক্ষে ২৪ ঘণ্টা আগে বাতিল না করলে সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে নবায়ন হয়।",
        "মূল্য পরিবর্তন — আমরা যেকোনো মূল্য পরিবর্তনের কমপক্ষে ৩০ দিনের নোটিশ প্রদান করব।",
        "কর — সমস্ত ফি প্রযোজ্য কর (যেমন VAT) ব্যতীত।",
        "ব্যর্থ পেমেন্ট — পেমেন্ট ব্যর্থ হলে, আমরা সাত দিনের মধ্যে তিনবার পর্যন্ত চার্জ করার চেষ্টা করব। পেমেন্ট না পেলে আপনার অ্যাকাউন্ট স্থগিত হতে পারে।",
      ],
      after: `ফেরত নীতি: আংশিক মাস বা বিলিং চক্রের অব্যবহৃত অংশের জন্য সাবস্ক্রিপশন ফি ফেরতযোগ্য নয়। ভুল চার্জের বিষয়ে, চার্জের ১৪ দিনের মধ্যে support@tomodine.com এ যোগাযোগ করুন। বাৎসরিক সাবস্ক্রিপশন আমাদের বিবেচনায় আনুপাতিক ফেরতের জন্য যোগ্য হতে পারে।`,
    },
  },

  /* 9. Limitation of Liability */
  {
    id: "liability",
    en: {
      title: "9. Limitation of Liability",
      body: `To the maximum extent permitted by applicable law, including the Consumer Protection Act 2009 of Bangladesh:`,
      list: [
        "TomoDine's total aggregate liability to you for any claims arising from or related to these Terms or the Services shall not exceed the total amount you paid to TomoDine in the 12-month period immediately preceding the event giving rise to the claim.",
        "In no event shall TomoDine be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, revenue, data, business opportunities, or goodwill, even if we have been advised of the possibility of such damages.",
        "TomoDine shall not be liable for any failure or delay in performing its obligations due to events beyond its reasonable control, including natural disasters, government actions, power outages, internet disruptions, or force majeure events.",
        "The Platform is provided on an 'as is' and 'as available' basis. We do not warrant that the Platform will be uninterrupted, error-free, or completely secure.",
        "You acknowledge that restaurant operations involve inherent risks, and TomoDine is not responsible for any food safety incidents, customer disputes, or operational losses arising from your use of the Platform.",
      ],
    },
    bn: {
      title: "৯. দায়বদ্ধতার সীমাবদ্ধতা",
      body: `বাংলাদেশের ভোক্তা সুরক্ষা আইন ২০০৯ সহ প্রযোজ্য আইনের অধীনে অনুমোদিত সর্বোচ্চ সীমা পর্যন্ত:`,
      list: [
        "এই শর্তাবলী বা সেবা থেকে উদ্ভূত যেকোনো দাবির জন্য TomoDine-এর মোট সামগ্রিক দায়বদ্ধতা দাবির জন্য ঘটনার ঠিক আগের ১২ মাসের সময়কালে আপনার দ্বারা TomoDine-কে প্রদত্ত মোট পরিমাণ অতিক্রম করবে না।",
        "TomoDine কোনো পরোক্ষ, আনুষঙ্গিক, বিশেষ, পরিণামগত বা শাস্তিমূলক ক্ষতির জন্য দায়ী থাকবে না, লাভ, আয়, ডেটা বা ব্যবসায়িক সুযোগের ক্ষতি সহ।",
        "TomoDine তার যুক্তিসঙ্গত নিয়ন্ত্রণের বাইরের ঘটনার কারণে তার বাধ্যবাধকতা পালনে ব্যর্থতা বা বিলম্বের জন্য দায়ী থাকবে না।",
        "প্ল্যাটফর্ম 'যেমন আছে' এবং 'যেমন পাওয়া যায়' ভিত্তিতে প্রদান করা হয়।",
        "আপনি স্বীকার করেন যে রেস্তোরাঁ পরিচালনায় সহজাত ঝুঁকি রয়েছে এবং TomoDine খাদ্য নিরাপত্তা ঘটনা, গ্রাহক বিরোধ বা পরিচালন ক্ষতির জন্য দায়ী নয়।",
      ],
    },
  },

  /* 10. Termination */
  {
    id: "termination",
    en: {
      title: "10. Termination",
      body: `Either party may terminate this agreement as follows:`,
      list: [
        "By You — you may cancel your subscription and close your account at any time through the Settings page or by contacting support@tomodine.com. Cancellation takes effect at the end of the current billing cycle.",
        "By TomoDine — we may suspend or terminate your account immediately if you violate these Terms, engage in fraudulent activity, fail to pay subscription fees, or if we are required to do so by law.",
        "Effect of Termination — upon termination, your right to access and use the Platform ceases immediately. We will retain your data for 30 days to allow for export, after which it may be permanently deleted.",
        "Survival — sections relating to intellectual property, limitation of liability, dispute resolution, and governing law shall survive termination of these Terms.",
      ],
    },
    bn: {
      title: "১০. বাতিলকরণ",
      body: `উভয় পক্ষ নিম্নলিখিতভাবে এই চুক্তি বাতিল করতে পারে:`,
      list: [
        "আপনার দ্বারা — আপনি যেকোনো সময় সেটিংস পৃষ্ঠা বা support@tomodine.com এ যোগাযোগ করে আপনার সাবস্ক্রিপশন বাতিল এবং অ্যাকাউন্ট বন্ধ করতে পারেন। বাতিলকরণ বর্তমান বিলিং চক্রের শেষে কার্যকর হয়।",
        "TomoDine দ্বারা — আপনি এই শর্তাবলী লঙ্ঘন করলে, জালিয়াতিমূলক কার্যকলাপে লিপ্ত হলে, সাবস্ক্রিপশন ফি প্রদানে ব্যর্থ হলে আমরা আপনার অ্যাকাউন্ট তৎক্ষণাত স্থগিত বা বাতিল করতে পারি।",
        "বাতিলকরণের প্রভাব — বাতিলকরণের পর, প্ল্যাটফর্ম অ্যাক্সেস এবং ব্যবহার করার আপনার অধিকার তৎক্ষণাত বন্ধ হয়ে যায়। রপ্তানির জন্য আমরা ৩০ দিন আপনার ডেটা রাখব।",
        "বেঁচে থাকা — বৌদ্বিক সম্পদ, দায়বদ্ধতার সীমাবদ্ধতা, বিরোধ নিষ্পত্তি এবং শাসন আইন সম্পর্কিত বিভাগগুলি এই শর্তাবলীর বাতিলকরণের পরেও বলবৎ থাকবে।",
      ],
    },
  },

  /* 11. Dispute Resolution */
  {
    id: "disputes",
    en: {
      title: "11. Dispute Resolution",
      body: `We aim to resolve disputes amicably and efficiently. The following process applies:`,
      list: [
        "Informal Resolution — before initiating any formal proceedings, you agree to contact us at support@tomodine.com with a detailed description of your concern. We will attempt to resolve the matter within 30 business days.",
        "Mediation — if informal resolution fails, either party may request mediation through a mutually agreed mediator in Dhaka.",
        "Arbitration — if mediation is unsuccessful, disputes shall be resolved by arbitration in accordance with the Arbitration Act 2001 of Bangladesh, conducted in Dhaka.",
        "30-Day Notice — before initiating any legal action, the aggrieved party must provide written notice to the other party and allow a 30-day cure period for the alleged breach.",
        "Class Action Waiver — to the extent permitted by law, you agree to resolve disputes with TomoDine on an individual basis and waive any right to participate in class action lawsuits or class-wide arbitrations.",
      ],
    },
    bn: {
      title: "১১. বিরোধ নিষ্পত্তি",
      body: `আমরা বিরোধ বন্ধুত্বপূর্ণ এবং দক্ষভাবে সমাধান করতে চাই। নিম্নলিখিত প্রক্রিয়া প্রযোজ্য:`,
      list: [
        "অনানুষ্ঠানিক সমাধান — কোনো আনুষ্ঠানিক কার্যক্রম শুরু করার আগে, আপনি support@tomodine.com এ আপনার উদ্বেগের বিস্তারিত বিবরণ সহ যোগাযোগ করতে সম্মত হন।",
        "মধ্যস্থতা — অনানুষ্ঠানিক সমাধান ব্যর্থ হলে, উভয় পক্ষ ঢাকায় পারস্পরিক সম্মত মধ্যস্থতাকারীর মাধ্যমে মধ্যস্থতা অনুরোধ করতে পারে।",
        "সালিশি — মধ্যস্থতা ব্যর্থ হলে, বিরোধ বাংলাদেশের সালিশি আইন ২০০১ অনুসারে ঢাকায় সালিশির মাধ্যমে সমাধান করা হবে।",
        "৩০ দিনের নোটিশ — কোনো আইনি কার্যক্রম শুরু করার আগে, ক্ষতিগ্রস্ত পক্ষকে অবশ্যই অন্য পক্ষকে লিখিত নোটিশ প্রদান করতে হবে এবং ৩০ দিনের সময়কাল দিতে হবে।",
      ],
    },
  },

  /* 12. Changes to Terms */
  {
    id: "changes",
    en: {
      title: "12. Changes to Terms",
      body: `We reserve the right to modify these Terms at any time. When we make changes, we will:`,
      list: [
        "Update the 'Last updated' date at the top of this page.",
        "For material changes, notify active subscribers via email or an in-app notification at least 15 days before the changes take effect.",
        "Post the revised Terms on this page with a clear indication of what has changed.",
      ],
      after: `Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the revised Terms. If you do not agree with the changes, you must stop using the Platform and cancel your subscription before the changes take effect.`,
    },
    bn: {
      title: "১২. শর্তাবলীতে পরিবর্তন",
      body: `আমরা যেকোনো সময় এই শর্তাবলী পরিবর্তন করার অধিকার সংরক্ষণ করি। আমরা পরিবর্তন করলে:`,
      list: [
        "এই পৃষ্ঠার শীর্ষে 'সর্বশেষ আপডেট' তারিখ আপডেট করব।",
        "উল্লেখযোগ্য পরিবর্তনের জন্য, পরিবর্তন কার্যকর হওয়ার কমপক্ষে ১৫ দিন আগে সক্রিয় সাবস্ক্রাইবারদের ইমেইল বা ইন-অ্যাপ বিজ্ঞপ্তির মাধ্যমে জানাব।",
        "কী পরিবর্তন হয়েছে তার স্পষ্ট নির্দেশনা সহ সংশোধিত শর্তাবলী এই পৃষ্ঠায় পোস্ট করব।",
      ],
      after: `কোনো পরিবর্তনের কার্যকর তারিখের পর প্ল্যাটফর্মের আপনার ক্রমাগত ব্যবহার সংশোধিত শর্তাবলীর আপনার গ্রহণযোগ্যতা গঠন করে। আপনি যদি পরিবর্তনগুলির সাথে সম্মত না হন, তাহলে আপনাকে প্ল্যাটফর্ম ব্যবহার বন্ধ করতে হবে এবং পরিবর্তন কার্যকর হওয়ার আগে আপনার সাবস্ক্রিপশন বাতিল করতে হবে।`,
    },
  },

  /* 13. Governing Law */
  {
    id: "governing-law",
    en: {
      title: "13. Governing Law",
      body: `These Terms shall be governed by and construed in accordance with the laws of the People's Republic of Bangladesh, including but not limited to:`,
      list: [
        "The Contract Act 1872",
        "The Information and Communication Technology Act 2006",
        "The Cyber Security Ordinance 2025",
        "The Consumer Protection Act 2009",
        "The Arbitration Act 2001",
        "Applicable Bangladesh Bank regulations for payment processing",
      ],
      after: `Any legal proceedings arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Dhaka, Bangladesh.`,
    },
    bn: {
      title: "১৩. শাসন আইন",
      body: `এই শর্তাবলী গণপ্রজাতন্ত্রী বাংলাদেশের আইন দ্বারা শাসিত এবং ব্যাখ্যা করা হবে, যার মধ্যে রয়েছে:`,
      list: [
        "চুক্তি আইন ১৮৭২",
        "তথ্য ও যোগাযোগ প্রযুক্তি আইন ২০০৬",
        "সাইবার নিরাপত্তা অধ্যাদেশ ২০২৫",
        "ভোক্তা সুরক্ষা আইন ২০০৯",
        "সালিশি আইন ২০০১",
        "পেমেন্ট প্রক্রিয়াকরণের জন্য প্রযোজ্য বাংলাদেশ ব্যাংক বিধি",
      ],
      after: `এই শর্তাবলী থেকে উদ্ভূত যেকোনো আইনি কার্যক্রম ঢাকা, বাংলাদেশের আদালতের একচেটিয়া এখতিয়ারের অধীন হবে।`,
    },
  },

  /* 14. Severability */
  {
    id: "severability",
    en: {
      title: "14. Severability",
      body: `If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, or if modification is not possible, it shall be severed from these Terms. The remaining provisions shall continue in full force and effect.`,
    },
    bn: {
      title: "১৪. পৃথকীকরণ",
      body: `এই শর্তাবলীর কোনো বিধান যদি একটি সক্ষম এখতিয়ারের আদালত দ্বারা অবৈধ, বেআইনি বা প্রয়োগযোগ্য নয় বলে বিবেচিত হয়, তাহলে সেই বিধানটি বৈধ এবং প্রয়োগযোগ্য করার জন্য ন্যূনতম পরিমাণে পরিবর্তন করা হবে, অথবা পরিবর্তন সম্ভব না হলে, এটি এই শর্তাবলী থেকে পৃথক করা হবে। অবশিষ্ট বিধানগুলি সম্পূর্ণ শক্তি এবং কার্যকারিতায় চলতে থাকবে।`,
    },
  },

  /* 15. Contact Information */
  {
    id: "contact",
    en: {
      title: "15. Contact Information",
      body: `If you have any questions, concerns, or complaints regarding these Terms, please contact us:`,
      list: [
        "Email: support@tomodine.com",
        "WhatsApp: +880 1779 184386",
        "Website: www.tomodine.com",
      ],
      after: `We aim to respond to all enquiries within 2 business days.`,
    },
    bn: {
      title: "১৫. যোগাযোগ তথ্য",
      body: `এই শর্তাবলী সম্পর্কে আপনার কোনো প্রশ্ন, উদ্বেগ বা অভিযোগ থাকলে, আমাদের সাথে যোগাযোগ করুন:`,
      list: [
        "ইমেইল: support@tomodine.com",
        "হোয়াটসঅ্যাপ: +880 1779 184386",
        "ওয়েবসাইট: www.tomodine.com",
      ],
      after: `আমরা ২ কার্যদিবসের মধ্যে সমস্ত অনুসন্ধানের উত্তর দিতে চেষ্টা করি।`,
    },
  },
] as const;

/* ── Component ───────────────────────────────────────────────── */

export function TermsPage() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("bn") ? "bn" : "en";

  return (
    <section aria-labelledby="terms-heading" className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
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
        <h1 id="terms-heading" className="text-lg font-semibold text-ink-900">
          {lang === "bn" ? "ব্যবহারের শর্তাবলী" : "Terms of Use"}
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
            ? "TomoDine-তে স্বাগতম। এই ডকুমেন্টটি TomoDine প্ল্যাটফর্ম এবং সেবার ব্যবহারকে নিয়ন্ত্রণকারী শর্তাবলী নির্ধারণ করে। অনুগ্রহ করে এগুলি সাবধানে পড়ুন।"
            : "Welcome to TomoDine. This document sets out the terms that govern your use of the TomoDine platform and services. Please read them carefully."}
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

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs leading-relaxed text-amber-800">
          {lang === "bn"
            ? "দাবিত্যাগ: এই ডকুমেন্টটি আইনি পরামর্শ নয়। এটি শুধুমাত্র তথ্যগত উদ্দেশ্যে প্রদান করা হয়েছে। TomoDine প্ল্যাটফর্ম এবং সেবার ব্যবহারকে নিয়ন্ত্রণকারী শর্তাবলী নির্ধারণ করে। আইনি পরামর্শের জন্য অনুগ্রহ করে একজন যোগ্য আইনজীবীর সাথে পরামর্শ করুন।"
            : "Disclaimer: This document is not legal advice. It is provided for informational purposes only and constitutes the terms governing use of the TomoDine platform and services. For legal advice, please consult a qualified legal professional."}
        </p>
      </div>
    </section>
  );
}
