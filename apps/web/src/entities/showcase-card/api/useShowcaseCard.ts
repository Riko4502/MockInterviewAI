import { useShowcaseControllerFindOne } from "@packages/api";
import type { ShowcaseCardResponseDto } from "@packages/dto";

export function useShowcaseCard(id: string) {
  return useShowcaseControllerFindOne<ShowcaseCardResponseDto>(id, {
    query: {
      enabled: !!id,
    },
  });
}
