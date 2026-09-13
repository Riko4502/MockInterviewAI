export interface ActivityItem {
  id: number;
  user: string;
  role: string;
  verdict: string;
  score: string;
  time: string;
}

export const ACTIVITIES: readonly ActivityItem[] = [
  {
    id: 1,
    user: "Alex K.",
    role: "Senior React Engineer",
    verdict: "Strong Hire",
    score: "96/100",
    time: "just now",
  },
  {
    id: 2,
    user: "Dmitry V.",
    role: "Go Realtime Architect",
    verdict: "Strong Hire",
    score: "94/100",
    time: "2m ago",
  },
  {
    id: 3,
    user: "Elena S.",
    role: "System Design Lead",
    verdict: "Hire",
    score: "89/100",
    time: "4m ago",
  },
];
