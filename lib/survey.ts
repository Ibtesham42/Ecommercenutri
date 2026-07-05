/**
 * NutriYet "Consumer Awareness & Healthy Snacking Survey" — the single source
 * of truth for sections, questions and options (bilingual EN + HI). Client-safe
 * (no Prisma). The public form (/survey), the Zod schema and the admin
 * analytics all read this catalog, so labels/options live in exactly one place.
 * Question `id`s match SurveyResponse column names; option `key`s are what gets
 * stored (never the display labels).
 */

export type SurveyOption = {
  key: string;
  en: string;
  hi?: string;
  /** Shows a small free-text input when selected (stored in `otherField`). */
  other?: boolean;
};

export type SurveyQuestion = {
  /** SurveyResponse column name. */
  id: string;
  num: number;
  type: "single" | "multi" | "text";
  required?: boolean;
  en: string;
  hi: string;
  options?: SurveyOption[];
  /** SurveyResponse column that stores the "Other …" free text. */
  otherField?: string;
};

export type SurveySection = {
  key: string;
  en: string;
  hi: string;
  questions: SurveyQuestion[];
};

const YES_NO_NOTSURE: SurveyOption[] = [
  { key: "yes", en: "Yes", hi: "हाँ" },
  { key: "no", en: "No", hi: "नहीं" },
  { key: "not-sure", en: "Not Sure", hi: "निश्चित नहीं" },
];

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    key: "about",
    en: "Section A – About You",
    hi: "आपके बारे में",
    questions: [
      {
        id: "ageGroup",
        num: 1,
        type: "single",
        required: true,
        en: "Age Group",
        hi: "आयु वर्ग",
        options: [
          { key: "under-18", en: "Under 18", hi: "18 वर्ष से कम" },
          { key: "18-24", en: "18–24" },
          { key: "25-34", en: "25–34" },
          { key: "35-44", en: "35–44" },
          { key: "45-54", en: "45–54" },
          { key: "55+", en: "55+" },
        ],
      },
      {
        id: "gender",
        num: 2,
        type: "single",
        required: true,
        en: "Gender",
        hi: "लिंग",
        options: [
          { key: "male", en: "Male", hi: "पुरुष" },
          { key: "female", en: "Female", hi: "महिला" },
          { key: "prefer-not", en: "Prefer not to say", hi: "बताना नहीं चाहते" },
          { key: "other", en: "Other", hi: "अन्य" },
        ],
      },
      {
        id: "occupation",
        num: 3,
        type: "single",
        required: true,
        en: "Occupation",
        hi: "व्यवसाय",
        otherField: "occupationOther",
        options: [
          { key: "student", en: "Student", hi: "विद्यार्थी" },
          { key: "professional", en: "Working Professional", hi: "नौकरीपेशा" },
          { key: "business", en: "Business", hi: "व्यवसाय" },
          { key: "homemaker", en: "Homemaker", hi: "गृहिणी" },
          { key: "farmer", en: "Farmer", hi: "किसान" },
          { key: "retired", en: "Retired", hi: "सेवानिवृत्त" },
          { key: "other", en: "Other", hi: "अन्य", other: true },
        ],
      },
      {
        id: "city",
        num: 4,
        type: "text",
        en: "City / District",
        hi: "शहर / जिला",
      },
    ],
  },
  {
    key: "habits",
    en: "Section B – Food & Snacking Habits",
    hi: "भोजन एवं नाश्ते की आदतें",
    questions: [
      {
        id: "snackFrequency",
        num: 5,
        type: "single",
        required: true,
        en: "How often do you eat snacks between meals?",
        hi: "आप भोजन के बीच में कितनी बार नाश्ता करते हैं?",
        options: [
          { key: "daily", en: "Daily", hi: "प्रतिदिन" },
          { key: "3-5-week", en: "3–5 times/week", hi: "सप्ताह में 3–5 बार" },
          { key: "occasionally", en: "Occasionally", hi: "कभी-कभी" },
          { key: "rarely", en: "Rarely", hi: "बहुत कम" },
        ],
      },
      {
        id: "snacks",
        num: 6,
        type: "multi",
        en: "Which snacks do you usually eat?",
        hi: "आप सामान्यतः कौन-सा नाश्ता खाते हैं?",
        otherField: "snacksOther",
        options: [
          { key: "chips", en: "Chips", hi: "चिप्स" },
          { key: "biscuits", en: "Biscuits", hi: "बिस्किट्स" },
          { key: "namkeen", en: "Namkeen", hi: "नमकीन" },
          { key: "fruits", en: "Fruits", hi: "फल" },
          { key: "makhana", en: "Makhana", hi: "मखाना" },
          { key: "dry-fruits", en: "Dry Fruits", hi: "सूखे मेवे" },
          { key: "sprouts", en: "Sprouts", hi: "अंकुरित अनाज" },
          { key: "other", en: "Other", hi: "अन्य", other: true },
        ],
      },
      {
        id: "snackPriority",
        num: 7,
        type: "single",
        required: true,
        en: "What is most important when choosing a snack?",
        hi: "आप नाश्ता चुनते समय किस बात को सबसे अधिक महत्व देते हैं?",
        options: [
          { key: "taste", en: "Taste", hi: "स्वाद" },
          { key: "nutrition", en: "Nutrition", hi: "पोषण" },
          { key: "price", en: "Price", hi: "कीमत" },
          { key: "brand", en: "Brand", hi: "ब्रांड" },
          { key: "availability", en: "Availability", hi: "आसानी से मिलना" },
          { key: "convenience", en: "Convenience", hi: "सुविधा" },
        ],
      },
    ],
  },
  {
    key: "makhana",
    en: "Section C – Makhana Awareness",
    hi: "मखाना जागरूकता",
    questions: [
      {
        id: "makhanaEaten",
        num: 8,
        type: "single",
        required: true,
        en: "Have you ever eaten Makhana?",
        hi: "क्या आपने कभी मखाना खाया है?",
        options: YES_NO_NOTSURE,
      },
      {
        id: "makhanaAware",
        num: 9,
        type: "single",
        required: true,
        en: "Before today, were you aware that Makhana can be included as part of a balanced diet?",
        hi: "क्या आज से पहले आपको पता था कि मखाना संतुलित आहार का हिस्सा हो सकता है?",
        options: YES_NO_NOTSURE,
      },
      {
        id: "makhanaForms",
        num: 10,
        type: "multi",
        en: "How do you usually eat Makhana?",
        hi: "आप मखाना किस रूप में खाना पसंद करते हैं?",
        options: [
          { key: "plain-roasted", en: "Plain Roasted", hi: "सादा भुना हुआ" },
          { key: "flavoured", en: "Flavoured", hi: "फ्लेवर वाला" },
          { key: "homemade", en: "Homemade Recipes", hi: "घर की रेसिपी" },
          { key: "sweet", en: "Sweet Dishes", hi: "मीठे व्यंजन" },
          { key: "never-tried", en: "Never Tried", hi: "कभी नहीं खाया" },
        ],
      },
      {
        id: "makhanaBarriers",
        num: 11,
        type: "multi",
        en: "What prevents you from eating Makhana more often?",
        hi: "आप मखाना नियमित रूप से क्यों नहीं खाते?",
        otherField: "makhanaBarrierOther",
        options: [
          { key: "expensive", en: "Too Expensive", hi: "महंगा लगता है" },
          { key: "not-available", en: "Not Easily Available", hi: "आसानी से नहीं मिलता" },
          { key: "dont-know-prepare", en: "Don't Know How to Prepare", hi: "बनाने का तरीका नहीं पता" },
          { key: "prefer-other", en: "Prefer Other Snacks", hi: "अन्य स्नैक्स पसंद हैं" },
          { key: "never-tried", en: "Never Tried", hi: "कभी नहीं खाया" },
          { key: "other", en: "Other", hi: "अन्य", other: true },
        ],
      },
    ],
  },
  {
    key: "buying",
    en: "Section D – Buying Preferences",
    hi: "खरीदारी की पसंद",
    questions: [
      {
        id: "buyPlaces",
        num: 12,
        type: "multi",
        en: "Where do you usually buy healthy snacks?",
        hi: "आप स्वस्थ नाश्ता कहाँ से खरीदते हैं?",
        options: [
          { key: "local-store", en: "Local Store", hi: "स्थानीय दुकान" },
          { key: "supermarket", en: "Supermarket", hi: "सुपरमार्केट, मॉल" },
          { key: "online", en: "Online", hi: "ऑनलाइन" },
          { key: "brand-website", en: "Brand Website", hi: "ब्रांड वेबसाइट" },
          { key: "pharmacy", en: "Pharmacy", hi: "मेडिकल स्टोर" },
        ],
      },
      {
        id: "packSize",
        num: 13,
        type: "single",
        required: true,
        en: "Which pack size would you prefer?",
        hi: "आप कौन-सा पैक साइज़ पसंद करेंगे?",
        options: [
          { key: "trial-85", en: "Trial Pack (85g)" },
          { key: "small-170", en: "Small Pack (170g)" },
          { key: "medium-235", en: "Medium Pack (235g)" },
          { key: "family-510", en: "Family Pack (510g+)" },
        ],
      },
      {
        id: "flavours",
        num: 14,
        type: "multi",
        en: "Which flavours would you like?",
        hi: "आप कौन-से फ्लेवर पसंद करेंगे?",
        otherField: "flavourOther",
        options: [
          { key: "plain", en: "Plain", hi: "सादा" },
          { key: "himalayan-salt-pepper", en: "Himalayan Salt and Pepper", hi: "हिमालय नमक और काली मिर्च" },
          { key: "peri-peri", en: "Peri-Peri", hi: "पेरी-पेरी" },
          { key: "mint", en: "Mint", hi: "पुदीना" },
          { key: "cheese-herbs", en: "Cheese and Herbs", hi: "चीज़ और जड़ी-बूटियां" },
          { key: "tango-tomato", en: "Tango Tomato", hi: "खट्टा-मीठा टमाटर" },
          { key: "chatpata-masala", en: "Chatpata Masala", hi: "चटपटा मसाला" },
          { key: "other", en: "Other", hi: "अन्य", other: true },
        ],
      },
    ],
  },
  {
    key: "awareness",
    en: "Section E – Nutrition Awareness",
    hi: "पोषण जागरूकता",
    questions: [
      {
        id: "learnInterest",
        num: 15,
        type: "single",
        required: true,
        en: "Would you like to learn more about healthy eating and traditional Indian foods?",
        hi: "क्या आप स्वस्थ भोजन और पारंपरिक भारतीय खाद्य पदार्थों के बारे में अधिक जानना चाहेंगे?",
        options: [
          { key: "yes", en: "Yes", hi: "हाँ" },
          { key: "maybe", en: "Maybe", hi: "शायद" },
          { key: "no", en: "No", hi: "नहीं" },
        ],
      },
      {
        id: "topics",
        num: 16,
        type: "multi",
        en: "What topics interest you most?",
        hi: "आप किन विषयों के बारे में सीखना चाहेंगे?",
        options: [
          { key: "healthy-snacking", en: "Healthy Snacking", hi: "स्वस्थ नाश्ता" },
          { key: "nutrition-basics", en: "Nutrition Basics", hi: "पोषण की मूल बातें" },
          { key: "makhana-recipes", en: "Makhana Recipes", hi: "मखाना रेसिपी" },
          { key: "millets", en: "Millets", hi: "मोटे अनाज" },
          { key: "moringa", en: "Moringa", hi: "सहजन" },
          { key: "family-nutrition", en: "Family Nutrition", hi: "परिवार का पोषण" },
          { key: "weight-management", en: "Weight Management", hi: "वजन प्रबंधन" },
          { key: "traditional-foods", en: "Traditional Indian Foods", hi: "पारंपरिक भारतीय भोजन" },
        ],
      },
    ],
  },
  {
    key: "connect",
    en: "Section F – Stay Connected",
    hi: "जुड़े रहें",
    questions: [
      {
        id: "wantsUpdates",
        num: 17,
        type: "single",
        required: true,
        en: "Would you like to receive healthy recipes, nutrition tips, and wellness updates from NutriYet?",
        hi: "क्या आप NutriYet से स्वस्थ रेसिपी, पोषण सुझाव और वेलनेस अपडेट प्राप्त करना चाहेंगे?",
        options: [
          { key: "yes", en: "Yes", hi: "हाँ" },
          { key: "no", en: "No", hi: "नहीं" },
        ],
      },
    ],
  },
];

/** Flat question list (skips the free-text city question when not needed). */
export const SURVEY_QUESTIONS: SurveyQuestion[] = SURVEY_SECTIONS.flatMap(
  (s) => s.questions,
);

export function surveyQuestion(id: string): SurveyQuestion | undefined {
  return SURVEY_QUESTIONS.find((q) => q.id === id);
}

/** Display label (EN + HI) for a stored option key. */
export function surveyOptionLabel(questionId: string, key: string): string {
  const opt = surveyQuestion(questionId)?.options?.find((o) => o.key === key);
  if (!opt) return key;
  return opt.hi ? `${opt.en} | ${opt.hi}` : opt.en;
}

export const optionKeys = (q: SurveyQuestion): [string, ...string[]] => {
  const keys = (q.options ?? []).map((o) => o.key);
  return keys as [string, ...string[]];
};
