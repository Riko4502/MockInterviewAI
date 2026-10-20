"use client";

import {
  adminUsersControllerGetUserById,
  adminUsersControllerGetUsersList,
  type UserAdminResponseDto,
  useAdminUsersControllerGetUsersList,
} from "@packages/api";
import { useCallback, useEffect, useMemo, useState } from "react";

export type PickerUser = Pick<
  UserAdminResponseDto,
  "id" | "email" | "username" | "displayName" | "avatarUrl" | "isActive"
>;

const SEARCH_DEBOUNCE_MS = 300;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ResolveIdentifiersResult {
  users: PickerUser[];
  unresolved: string[];
}

function toPickerUser(user: UserAdminResponseDto): PickerUser;
function toPickerUser(
  user: Awaited<ReturnType<typeof adminUsersControllerGetUserById>>,
): PickerUser;
function toPickerUser(
  user:
    | UserAdminResponseDto
    | Awaited<ReturnType<typeof adminUsersControllerGetUserById>>,
): PickerUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
  };
}

export function useUserSearch(search: string, enabled = true) {
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const normalizedSearch = search.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedSearch]);

  const query = useAdminUsersControllerGetUsersList(
    {
      search: debouncedSearch || undefined,
      page: 1,
      limit: 10,
      isActive: true,
      isDeleted: false,
    },
    {
      query: {
        enabled: enabled && debouncedSearch.length > 0,
      },
    },
  );

  const results = useMemo(() => {
    if (normalizedSearch !== debouncedSearch) return [];
    return (query.data?.items ?? []).map(toPickerUser);
  }, [debouncedSearch, normalizedSearch, query.data?.items]);

  const resolveIdentifiers = useCallback(
    async (identifiers: string[]): Promise<ResolveIdentifiersResult> => {
      const uniqueIdentifiers = Array.from(
        new Set(identifiers.map((value) => value.trim()).filter(Boolean)),
      );
      const resolved = await Promise.all(
        uniqueIdentifiers.map(async (identifier) => {
          if (UUID_PATTERN.test(identifier)) {
            try {
              const user = await adminUsersControllerGetUserById(identifier);
              return user.isActive ? toPickerUser(user) : null;
            } catch {
              return null;
            }
          }

          if (EMAIL_PATTERN.test(identifier)) {
            try {
              const response = await adminUsersControllerGetUsersList({
                search: identifier,
                page: 1,
                limit: 100,
                isActive: true,
                isDeleted: false,
              });
              const user = response.items.find(
                (item) => item.email.toLowerCase() === identifier.toLowerCase(),
              );
              return user ? toPickerUser(user) : null;
            } catch {
              return null;
            }
          }

          return null;
        }),
      );
      const foundUsers = resolved.filter(
        (user): user is PickerUser => user !== null,
      );
      const foundIds = new Set(foundUsers.map((user) => user.id));
      const unresolved = uniqueIdentifiers.filter((_identifier, index) => {
        const user = resolved[index];
        return user === null || !foundIds.has(user.id);
      });

      return {
        users: Array.from(
          new Map(foundUsers.map((user) => [user.id, user])).values(),
        ),
        unresolved,
      };
    },
    [],
  );

  const resolveRecipientIds = useCallback(
    async (ids: string[]): Promise<ResolveIdentifiersResult> => {
      const uniqueIds = Array.from(new Set(ids));
      const users: PickerUser[] = [];
      const unresolved: string[] = [];
      for (let offset = 0; offset < uniqueIds.length; offset += 25) {
        const batch = uniqueIds.slice(offset, offset + 25);
        const resolved = await Promise.all(
          batch.map(async (id) => {
            try {
              return toPickerUser(await adminUsersControllerGetUserById(id));
            } catch {
              return null;
            }
          }),
        );
        resolved.forEach((user, index) => {
          if (user) users.push(user);
          else unresolved.push(batch[index]);
        });
      }
      return { users, unresolved };
    },
    [],
  );
  return {
    results,
    isLoading:
      normalizedSearch.length > 0 &&
      (normalizedSearch !== debouncedSearch || query.isLoading),
    isError: query.isError,
    error: query.error,
    resolveIdentifiers,
    resolveRecipientIds,
  };
}
