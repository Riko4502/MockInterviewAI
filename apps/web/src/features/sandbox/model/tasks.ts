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
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}
`,
      javascript: `function twoSum(nums, target) {
  // Напишите ваше решение здесь
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
`,
      python: `def twoSum(nums: list[int], target: int) -> list[int]:
    # Ваше решение здесь
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
      go: `package main

func twoSum(nums []int, target int) []int {
	seen := make(map[int]int)
	for i, num := range nums {
		complement := target - num
		if idx, ok := seen[complement]; ok {
			return []int{idx, i}
		}
		seen[num] = i
	}
	return nil
}
`,
      cpp: `#include <vector>
#include <unordered_map>

using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};
`,
      java: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] { seen.get(complement), i };
            }
            seen.put(nums[i], i);
        }
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
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0;
  let right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
}
`,
      javascript: `function isPalindrome(s) {
  // Напишите ваше решение здесь
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let left = 0;
  let right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
}
`,
      python: `def isPalindrome(s: str) -> bool:
    clean = [c.lower() for c in s if c.isalnum()]
    return clean == clean[::-1]
`,
      go: `package main

import "unicode"

func isPalindrome(s string) bool {
	runes := []rune(s)
	left, right := 0, len(runes)-1
	for left < right {
		for left < right && !isAlphaNum(runes[left]) {
			left++
		}
		for left < right && !isAlphaNum(runes[right]) {
			right--
		}
		if unicode.ToLower(runes[left]) != unicode.ToLower(runes[right]) {
			return false
		}
		left++
		right--
	}
	return true
}

func isAlphaNum(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}
`,
      cpp: `#include <string>
#include <cctype>

using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        int left = 0, right = s.size() - 1;
        while (left < right) {
            while (left < right && !isalnum(s[left])) left++;
            while (left < right && !isalnum(s[right])) right--;
            if (tolower(s[left]) != tolower(s[right])) return false;
            left++;
            right--;
        }
        return true;
    }
};
`,
      java: `class Solution {
    public boolean isPalindrome(String s) {
        int left = 0, right = s.length() - 1;
        while (left < right) {
            while (left < right && !Character.isLetterOrDigit(s.charAt(left))) left++;
            while (left < right && !Character.isLetterOrDigit(s.charAt(right))) right--;
            if (Character.toLowerCase(s.charAt(left)) != Character.toLowerCase(s.charAt(right))) {
                return false;
            }
            left++;
            right--;
        }
        return true;
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
  // Напишите ваше решение здесь (Sliding Window)
  const map = new Map<string, number>();
  let maxLength = 0;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    if (map.has(char) && map.get(char)! >= left) {
      left = map.get(char)! + 1;
    }
    map.set(char, right);
    maxLength = Math.max(maxLength, right - left + 1);
  }

  return maxLength;
}
`,
      javascript: `function lengthOfLongestSubstring(s) {
  // Напишите ваше решение здесь
  const map = new Map();
  let maxLength = 0;
  let left = 0;

  for (let right = 0; right < s.length; right++) {
    const char = s[right];
    if (map.has(char) && map.get(char) >= left) {
      left = map.get(char) + 1;
    }
    map.set(char, right);
    maxLength = Math.max(maxLength, right - left + 1);
  }

  return maxLength;
}
`,
      python: `def lengthOfLongestSubstring(s: str) -> int:
    seen = {}
    max_len = 0
    left = 0
    for right, char in enumerate(s):
        if char in seen and seen[char] >= left:
            left = seen[char] + 1
        seen[char] = right
        max_len = max(max_len, right - left + 1)
    return max_len
`,
      go: `package main

func lengthOfLongestSubstring(s string) int {
	seen := make(map[byte]int)
	maxLen, left := 0, 0
	for right := 0; right < len(s); right++ {
		b := s[right]
		if idx, exists := seen[b]; exists && idx >= left {
			left = idx + 1
		}
		seen[b] = right
		if curr := right - left + 1; curr > maxLen {
			maxLen = curr
		}
	}
	return maxLen
}
`,
      cpp: `#include <string>
#include <unordered_map>
#include <algorithm>

using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> seen;
        int maxLen = 0, left = 0;
        for (int right = 0; right < s.length(); ++right) {
            if (seen.count(s[right]) && seen[s[right]] >= left) {
                left = seen[s[right]] + 1;
            }
            seen[s[right]] = right;
            maxLen = max(maxLen, right - left + 1);
        }
        return maxLen;
    }
};
`,
      java: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> seen = new HashMap<>();
        int maxLen = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (seen.containsKey(c) && seen.get(c) >= left) {
                left = seen.get(c) + 1;
            }
            seen.put(c, right);
            maxLen = Math.max(maxLen, right - left + 1);
        }
        return maxLen;
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
      typescript: `function reverseList(head: number[]): number[] {
  // Для тестирования в песочнице работаем с массивом как с представлением списка
  return [...head].reverse();
}
`,
      javascript: `function reverseList(head) {
  return [...head].reverse();
}
`,
      python: `def reverseList(head: list[int]) -> list[int]:
    return head[::-1]
`,
      go: `package main

func reverseList(head []int) []int {
	res := make([]int, len(head))
	for i, v := range head {
		res[len(head)-1-i] = v
	}
	return res
}
`,
      cpp: `#include <vector>
#include <algorithm>

using namespace std;

class Solution {
public:
    vector<int> reverseList(vector<int>& head) {
        vector<int> res = head;
        reverse(res.begin(), res.end());
        return res;
    }
};
`,
      java: `class Solution {
    public int[] reverseList(int[] head) {
        int[] res = new int[head.length];
        for (int i = 0; i < head.length; i++) {
            res[head.length - 1 - i] = head[i];
        }
        return res;
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
