/**
 * Client-safe single-source-of-truth catalog for the Teacher AI Toolkit
 * (`/admin/jnv/ai-toolkit`) — the form and the generation prompt both read
 * this list so labels and instructions can never drift. Store the KEY,
 * render the label, matching the project's quiz/survey/showcase catalogs.
 */

export type JnvTeacherContentKey =
  | "LESSON_PLAN"
  | "DAILY_PLAN"
  | "WEEKLY_PLAN"
  | "PPT_OUTLINE"
  | "MCQS"
  | "SHORT_QUESTIONS"
  | "LONG_QUESTIONS"
  | "PRACTICAL_ACTIVITY"
  | "CLASSROOM_ACTIVITY"
  | "HOMEWORK"
  | "ASSIGNMENT"
  | "WORKSHEET"
  | "VIVA_QUESTIONS"
  | "QUESTION_PAPER"
  | "ANSWER_KEY"
  | "REVISION_NOTES"
  | "LEARNING_OBJECTIVES"
  | "BLOOMS_QUESTIONS";

export const JNV_TEACHER_CONTENT_TYPES: { key: JnvTeacherContentKey; label: string; instruction: string }[] = [
  {
    key: "LESSON_PLAN",
    label: "Complete Lesson Plan",
    instruction:
      "Write a complete lesson plan: learning objectives, prerequisite knowledge, materials needed, a warm-up, step-by-step teaching procedure with approximate timings, a formative assessment/check for understanding, and a closing summary.",
  },
  {
    key: "DAILY_PLAN",
    label: "Daily Teaching Plan",
    instruction:
      "Write a single-period daily teaching plan with a clear time breakdown (introduction, main teaching, activity, wrap-up), the key point to cover, and one quick check-for-understanding question at the end.",
  },
  {
    key: "WEEKLY_PLAN",
    label: "Weekly Teaching Plan",
    instruction:
      "Write a 5-day (Monday-Friday) weekly teaching plan breaking the topic into daily sub-topics, each with a one-line objective and the main activity for that day, plus a suggestion for a short Friday recap/quiz.",
  },
  {
    key: "PPT_OUTLINE",
    label: "PPT Outline",
    instruction:
      "Write a classroom presentation outline as a slide-by-slide list: a short slide title followed by 3-5 bullet points per slide (do not exceed 12 slides). Note this is an outline only, not a downloadable .pptx file.",
  },
  {
    key: "MCQS",
    label: "MCQs",
    instruction:
      "Generate multiple-choice questions, each with 4 options (A-D) and the correct answer marked at the end as \"Answer: X\".",
  },
  {
    key: "SHORT_QUESTIONS",
    label: "Short Answer Questions",
    instruction: "Generate short-answer questions (each answerable in 1-2 sentences), numbered, with model answers.",
  },
  {
    key: "LONG_QUESTIONS",
    label: "Long Answer Questions",
    instruction:
      "Generate long-answer/descriptive questions (each expecting a multi-paragraph answer), numbered, with a brief answer outline for each (not a full essay).",
  },
  {
    key: "PRACTICAL_ACTIVITY",
    label: "Practical Activity",
    instruction:
      "Design a hands-on practical/lab activity: objective, materials/software needed, step-by-step instructions students follow, and an expected outcome or observation to record.",
  },
  {
    key: "CLASSROOM_ACTIVITY",
    label: "Classroom Activity",
    instruction:
      "Design an engaging in-class activity or game (no computer required) that reinforces the topic, with clear rules, approximate duration, and the concept it reinforces.",
  },
  {
    key: "HOMEWORK",
    label: "Homework",
    instruction: "Generate a homework assignment: a short set of questions/tasks a student can complete independently at home, with clear instructions.",
  },
  {
    key: "ASSIGNMENT",
    label: "Assignment",
    instruction:
      "Generate a graded assignment: a clear task description, deliverable, and a simple marking breakdown (e.g. what each part is worth).",
  },
  {
    key: "WORKSHEET",
    label: "Worksheet",
    instruction:
      "Generate a student worksheet: a mix of fill-in-the-blanks, short questions, and one small diagram/labeling or matching exercise described in text, numbered for easy printing.",
  },
  {
    key: "VIVA_QUESTIONS",
    label: "Viva Questions",
    instruction:
      "Generate oral viva-voce questions a teacher can ask one-on-one, with brief expected-answer points (not full essays) for the teacher's reference.",
  },
  {
    key: "QUESTION_PAPER",
    label: "Question Paper",
    instruction:
      "Generate a full exam question paper with clear sections (e.g. Section A: MCQs, Section B: Short Answer, Section C: Long Answer), marks indicated for each question, and a total marks line at the top.",
  },
  {
    key: "ANSWER_KEY",
    label: "Answer Key",
    instruction:
      "Generate a complete answer key matching a typical question paper on this topic: correct options for MCQs and model answers for short/long questions, numbered to match.",
  },
  {
    key: "REVISION_NOTES",
    label: "Revision Notes",
    instruction:
      "Generate concise exam-ready revision notes: key definitions, important points as bullet lists, and 2-3 things students commonly get wrong or forget.",
  },
  {
    key: "LEARNING_OBJECTIVES",
    label: "Learning Objectives",
    instruction:
      "Write clear, measurable learning objectives for this topic (\"By the end of this lesson, students will be able to...\"), 4-6 objectives, ordered from foundational to advanced.",
  },
  {
    key: "BLOOMS_QUESTIONS",
    label: "Bloom's Taxonomy Questions",
    instruction:
      "Generate one question for each level of Bloom's Taxonomy on this topic — Remember, Understand, Apply, Analyze, Evaluate, Create — clearly labelling which level each question targets.",
  },
];

export function jnvTeacherContentLabel(key: string): string {
  return JNV_TEACHER_CONTENT_TYPES.find((t) => t.key === key)?.label ?? key;
}
