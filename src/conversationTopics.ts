export const topicGroups = {
  Social: [
    "First meeting",
    "Hobbies",
    "Invite a friend",
    "Party chat",
    "Small talk",
    "Share an experience",
    "Comfort a friend",
    "Discuss opinions",
  ],
  Work: [
    "Introduce yourself",
    "Team meeting",
    "Ask for help",
    "Job interview",
    "Give an update",
    "Make a suggestion",
    "Discuss a deadline",
    "Resolve a disagreement",
  ],
  Study: [
    "Meet a classmate",
    "Ask a question",
    "Study group",
    "Library visit",
    "Explain a project",
    "Campus life",
    "Present an idea",
    "Discuss a reading",
  ],
  Travel: [
    "Hotel check-in",
    "Asking directions",
    "Restaurant ordering",
    "Shopping",
    "Airport check-in",
    "Attraction visit",
    "Flight delay",
    "Asking for medical help",
  ],
} as const;
export type ChatMessage = {
  role: "model" | "user";
  text: string;
  feedback?: string;
  correction?: string;
  audioUri?: string;
};
