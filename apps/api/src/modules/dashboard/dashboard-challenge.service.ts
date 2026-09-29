import { Injectable } from "@nestjs/common";
import type { DailyChallengeResponseDto } from "@packages/dto";

interface ChallengeProblem {
  problemId: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  pointsReward: number;
}

const DAILY_PROBLEMS_CATALOG: ChallengeProblem[] = [
  {
    problemId: "two-sum",
    title: "1. Two Sum (Поиск двух чисел с заданной суммой)",
    difficulty: "EASY",
    tags: ["Array", "Hash Table"],
    pointsReward: 30,
  },
  {
    problemId: "valid-parentheses",
    title: "20. Valid Parentheses (Правильная скобочная последовательность)",
    difficulty: "EASY",
    tags: ["String", "Stack"],
    pointsReward: 30,
  },
  {
    problemId: "lru-cache",
    title:
      "146. LRU Cache (Проектирование кэша наименее используемых элементов)",
    difficulty: "MEDIUM",
    tags: ["Hash Table", "Linked List", "Design"],
    pointsReward: 50,
  },
  {
    problemId: "binary-tree-level-order",
    title: "102. Binary Tree Level Order Traversal (Обход дерева по уровням)",
    difficulty: "MEDIUM",
    tags: ["Tree", "Breadth-First Search"],
    pointsReward: 50,
  },
  {
    problemId: "merge-k-sorted-lists",
    title: "23. Merge k Sorted Lists (Слияние k отсортированных списков)",
    difficulty: "HARD",
    tags: ["Linked List", "Heap (Priority Queue)"],
    pointsReward: 80,
  },
  {
    problemId: "trapping-rain-water",
    title: "42. Trapping Rain Water (Удержание дождевой воды)",
    difficulty: "HARD",
    tags: ["Array", "Two Pointers", "Dynamic Programming"],
    pointsReward: 90,
  },
  {
    problemId: "longest-substring-without-repeating",
    title:
      "3. Longest Substring Without Repeating Characters (Подстрока без повторов)",
    difficulty: "MEDIUM",
    tags: ["Hash Table", "String", "Sliding Window"],
    pointsReward: 50,
  },
];

@Injectable()
export class DashboardChallengeService {
  /**
   * Возвращает задачу дня, детерминированно рассчитанную по текущей дате UTC.
   */
  async getDailyChallenge(_userId: string): Promise<DailyChallengeResponseDto> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    // Детерминированный псевдослучайный выбор на основе даты
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash << 5) - hash + dateStr.charCodeAt(i);
      hash |= 0;
    }
    const problemIndex = Math.abs(hash) % DAILY_PROBLEMS_CATALOG.length;
    const selectedProblem = DAILY_PROBLEMS_CATALOG[problemIndex];

    // Расчет секунд до 00:00:00 следующего дня (UTC)
    const tomorrowUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      ),
    );
    const timeUntilResetSeconds = Math.max(
      0,
      Math.round((tomorrowUtc.getTime() - now.getTime()) / 1000),
    );

    return {
      problemId: selectedProblem.problemId,
      title: selectedProblem.title,
      difficulty: selectedProblem.difficulty,
      tags: selectedProblem.tags,
      timeUntilResetSeconds,
      isSolvedToday: false,
      solvedAt: null,
      pointsReward: selectedProblem.pointsReward,
    };
  }
}
