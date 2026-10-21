import { act, renderHook } from "@testing-library/react";
import type { TFunction } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserMultiSelectPicker } from "./useUserMultiSelectPicker";
import * as userSearchModule from "./useUserSearch";

vi.mock("./useUserSearch", () => ({
  useUserSearch: vi.fn(),
}));

describe("useUserMultiSelectPicker - handleBulkAdd", () => {
  const mockResolveIdentifiers = vi.fn();
  const mockT = ((key: string) => key) as unknown as TFunction<"common">;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userSearchModule.useUserSearch).mockReturnValue({
      results: [],
      isLoading: false,
      isError: false,
      error: null,
      resolveIdentifiers: mockResolveIdentifiers,
      resolveRecipientIds: vi.fn(),
    });
  });

  it("limits additions so that total selected count does not exceed maxSelected", async () => {
    const initialUsers = [
      {
        id: "1",
        email: "u1@test.com",
        username: "u1",
        displayName: "User 1",
        avatarUrl: null,
        isActive: true,
      },
    ];
    const onChange = vi.fn();

    mockResolveIdentifiers.mockResolvedValue({
      users: [
        {
          id: "2",
          email: "u2@test.com",
          username: "u2",
          displayName: "User 2",
          avatarUrl: null,
          isActive: true,
        },
        {
          id: "3",
          email: "u3@test.com",
          username: "u3",
          displayName: "User 3",
          avatarUrl: null,
          isActive: true,
        },
        {
          id: "4",
          email: "u4@test.com",
          username: "u4",
          displayName: "User 4",
          avatarUrl: null,
          isActive: true,
        },
      ],
      unresolved: [],
    });

    const { result } = renderHook(() =>
      useUserMultiSelectPicker({
        value: initialUsers,
        onChange,
        disabled: false,
        maxSelected: 2,
        t: mockT,
      }),
    );

    act(() => {
      result.current.setBulkText("u2@test.com, u3@test.com, u4@test.com");
    });

    await act(async () => {
      await result.current.handleBulkAdd();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const addedValue = onChange.mock.calls[0][0];
    expect(addedValue).toHaveLength(2);
    expect(addedValue[0].id).toBe("1");
    expect(addedValue[1].id).toBe("2");
  });
});
