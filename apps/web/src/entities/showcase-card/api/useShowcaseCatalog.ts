import {
  type ShowcaseControllerFindAllParams,
  useShowcaseControllerFindAll,
} from "@packages/api";
import type {
  PaginatedResponseDto,
  ShowcaseCardResponseDto,
} from "@packages/dto";
import type { UseQueryResult } from "@tanstack/react-query";

export type ShowcaseCatalogParams = ShowcaseControllerFindAllParams;

export function useShowcaseCatalog(params?: ShowcaseCatalogParams) {
  const query = useShowcaseControllerFindAll(params);

  return query as unknown as UseQueryResult<
    PaginatedResponseDto<ShowcaseCardResponseDto>
  >;
}
