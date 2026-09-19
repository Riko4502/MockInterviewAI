import type { InterviewTask } from "./types";

export const MOCK_INTERVIEW_TASKS: InterviewTask[] = [
  {
    id: "two-sum",
    title: "1. Two Sum (Сумма двух чисел)",
    difficulty: "Easy",
    category: "Algorithms",
    functionName: "twoSum",
    description: `Дан массив целых чисел \`nums\` и целое число \`target\`. Верните **индексы** двух чисел таких, чтобы их сумма была равна \`target\`.

Вы можете предположить, что каждый входной набор имеет **ровно одно решение**, и вы не можете использовать один и тот же элемент дважды.

Ответ можно вернуть в любом порядке.`,
    examples: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
        explanation: "Поскольку nums[0] + nums[1] == 9, возвращаем [0, 1].",
      },
      {
        input: "nums = [3, 2, 4], target = 6",
        output: "[1, 2]",
        explanation: "nums[1] + nums[2] == 6, возвращаем [1, 2].",
      },
      {
        input: "nums = [3, 3], target = 6",
        output: "[0, 1]",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Существует ровно одно валидное решение.",
    ],
    starterCode: {
      typescript: `function twoSum(nums: number[], target: number): number[] {
  // Напишите ваше решение здесь
  return [];
}
`,
      javascript: `function twoSum(nums, target) {
  // Напишите ваше решение здесь
  return [];
}
`,
      python: `def twoSum(nums: list[int], target: int) -> list[int]:
    # Ваше решение здесь
    pass
`,
      go: `package main

func twoSum(nums []int, target int) []int {
	// Ваше решение здесь
	return nil
}
`,
      cpp: `#include <vector>

using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Ваше решение здесь
        return {};
    }
};
`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Ваше решение здесь
        return new int[0];
    }
}
`,
    },
    testCases: [
      {
        id: "two-sum-1",
        input: "nums = [2, 7, 11, 15], target = 9",
        expectedOutput: "[0, 1]",
        args: [[2, 7, 11, 15], 9],
        expected: [0, 1],
      },
      {
        id: "two-sum-2",
        input: "nums = [3, 2, 4], target = 6",
        expectedOutput: "[1, 2]",
        args: [[3, 2, 4], 6],
        expected: [1, 2],
      },
      {
        id: "two-sum-3",
        input: "nums = [3, 3], target = 6",
        expectedOutput: "[0, 1]",
        args: [[3, 3], 6],
        expected: [0, 1],
      },
    ],
    hints: [
      "💡 Подсказка 1: Попробуйте наивный подход с двойным циклом за O(n^2). Что в нем избыточно?",
      "💡 Подсказка 2: Можем ли мы запоминать числа, которые уже видели? Какая структура данных обеспечивает поиск за O(1)?",
      "💡 Подсказка 3: Используйте Hash Map: сохраняйте пару (значение -> индекс) при проходе по массиву.",
    ],
  },
  {
    id: "valid-palindrome",
    title: "2. Valid Palindrome (Проверка палиндрома)",
    difficulty: "Easy",
    category: "Strings",
    functionName: "isPalindrome",
    description: `Строка считается **палиндромом**, если после перевода всех заглавных букв в строчные и удаления всех небуквенно-цифровых символов она читается одинаково слева направо и справа налево.

Буквенно-цифровые символы включают буквы и цифры.

Дана строка \`s\`, верните \`true\`, если она является палиндромом, или \`false\` в противном случае.`,
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: "true",
        explanation: '"amanaplanacanalpanama" является палиндромом.',
      },
      {
        input: 's = "race a car"',
        output: "false",
        explanation: '"raceacar" не является палиндромом.',
      },
      {
        input: 's = " "',
        output: "true",
        explanation:
          "Пустая строка после удаления символов является палиндромом.",
      },
    ],
    constraints: [
      "1 <= s.length <= 2 * 10^5",
      "s состоит только из печатных ASCII символов.",
    ],
    starterCode: {
      typescript: `function isPalindrome(s: string): boolean {
  // Напишите ваше решение здесь
  return false;
}
`,
      javascript: `function isPalindrome(s) {
  // Напишите ваше решение здесь
  return false;
}
`,
      python: `def isPalindrome(s: str) -> bool:
    # Ваше решение здесь
    pass
`,
      go: `package main

func isPalindrome(s string) bool {
	// Ваше решение здесь
	return false
}
`,
      cpp: `#include <string>

using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        // Ваше решение здесь
        return false;
    }
};
`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Ваше решение здесь
        return false;
    }
}
`,
    },
    testCases: [
      {
        id: "palindrome-1",
        input: 's = "A man, a plan, a canal: Panama"',
        expectedOutput: "true",
        args: ["A man, a plan, a canal: Panama"],
        expected: true,
      },
      {
        id: "palindrome-2",
        input: 's = "race a car"',
        expectedOutput: "false",
        args: ["race a car"],
        expected: false,
      },
      {
        id: "palindrome-3",
        input: 's = " "',
        expectedOutput: "true",
        args: [" "],
        expected: true,
      },
    ],
    hints: [
      "💡 Подсказка 1: Обратите внимание, что пробелы и знаки препинания должны игнорироваться.",
      "💡 Подсказка 2: Паттерн двух указателей (Two Pointers) с краев к центру позволяет решить задачу за O(n) времени и O(1) памяти.",
    ],
  },
  {
    id: "longest-substring",
    title: "3. Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Algorithms",
    functionName: "lengthOfLongestSubstring",
    description: `Дана строка \`s\`. Найдите длину **самой длинной подстроки** без повторяющихся символов.`,
    examples: [
      {
        input: 's = "abcabcbb"',
        output: "3",
        explanation: 'Ответом является "abc" с длиной 3.',
      },
      {
        input: 's = "bbbbb"',
        output: "1",
        explanation: 'Ответом является "b" с длиной 1.',
      },
      {
        input: 's = "pwwkew"',
        output: "3",
        explanation: 'Ответом является "wke" с длиной 3.',
      },
    ],
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s состоит из английских букв, цифр, символов и пробелов.",
    ],
    starterCode: {
      typescript: `function lengthOfLongestSubstring(s: string): number {
  // Напишите ваше решение здесь
  return 0;
}
`,
      javascript: `function lengthOfLongestSubstring(s) {
  // Напишите ваше решение здесь
  return 0;
}
`,
      python: `def lengthOfLongestSubstring(s: str) -> int:
    # Ваше решение здесь
    pass
`,
      go: `package main

func lengthOfLongestSubstring(s string) int {
	// Ваше решение здесь
	return 0
}
`,
      cpp: `#include <string>

using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Ваше решение здесь
        return 0;
    }
};
`,
      java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Ваше решение здесь
        return 0;
    }
}
`,
    },
    testCases: [
      {
        id: "longest-1",
        input: 's = "abcabcbb"',
        expectedOutput: "3",
        args: ["abcabcbb"],
        expected: 3,
      },
      {
        id: "longest-2",
        input: 's = "bbbbb"',
        expectedOutput: "1",
        args: ["bbbbb"],
        expected: 1,
      },
      {
        id: "longest-3",
        input: 's = "pwwkew"',
        expectedOutput: "3",
        args: ["pwwkew"],
        expected: 3,
      },
    ],
    hints: [
      "💡 Подсказка 1: Используйте паттерн «Скользящее окно» (Sliding Window).",
      "💡 Подсказка 2: Храните в Hash Map последний индекс каждого встреченного символа.",
    ],
  },
  {
    id: "reverse-linked-list",
    title: "4. Reverse Linked List (Разворот списка)",
    difficulty: "Easy",
    category: "Data Structures",
    functionName: "reverseList",
    description: `Дан \`head\` односвязного списка. Разверните список и верните развернутый список.`,
    examples: [
      {
        input: "head = [1, 2, 3, 4, 5]",
        output: "[5, 4, 3, 2, 1]",
      },
      {
        input: "head = [1, 2]",
        output: "[2, 1]",
      },
      {
        input: "head = []",
        output: "[]",
      },
    ],
    constraints: [
      "Количество узлов в списке находится в диапазоне [0, 5000].",
      "-5000 <= Node.val <= 5000",
    ],
    starterCode: {
      typescript: `class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val?: number, next?: ListNode | null) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
}

function reverseList(head: ListNode | null): ListNode | null {
  // Напишите ваше решение здесь
  return null;
}
`,
      javascript: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
function reverseList(head) {
  // Напишите ваше решение здесь
  return null;
}
`,
      python: `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

def reverseList(head: Optional[ListNode]) -> Optional[ListNode]:
    # Ваше решение здесь
    pass
`,
      go: `package main

// Definition for singly-linked list.
type ListNode struct {
	Val  int
	Next *ListNode
}

func reverseList(head *ListNode) *ListNode {
	// Ваше решение здесь
	return nil
}
`,
      cpp: `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        // Ваше решение здесь
        return nullptr;
    }
};
`,
      java: `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        // Ваше решение здесь
        return null;
    }
}
`,
    },
    testCases: [
      {
        id: "reverse-1",
        input: "head = [1, 2, 3, 4, 5]",
        expectedOutput: "[5, 4, 3, 2, 1]",
        args: [[1, 2, 3, 4, 5]],
        expected: [5, 4, 3, 2, 1],
      },
      {
        id: "reverse-2",
        input: "head = [1, 2]",
        expectedOutput: "[2, 1]",
        args: [[1, 2]],
        expected: [2, 1],
      },
      {
        id: "reverse-3",
        input: "head = []",
        expectedOutput: "[]",
        args: [[]],
        expected: [],
      },
    ],
    hints: [
      "💡 Подсказка 1: Классическое итеративное решение требует 3 указателей: prev, curr, next.",
      "💡 Подсказка 2: Не забудьте обнулить head.next у первого элемента.",
    ],
  },
];
