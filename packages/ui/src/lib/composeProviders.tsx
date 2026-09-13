import {
  type ComponentType,
  createElement,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type ProviderComponent = ComponentType<PropsWithChildren>;

/**
 * Собирает несколько провайдеров в один компонент:
 *
 *   composeProviders(A, B, C)  ===  <A><B><C>{children}</C></B></A>
 *
 * Порядок аргументов = порядок вложенности: первый провайдер — самый внешний.
 */
export function composeProviders(...providers: ProviderComponent[]) {
  return function ComposedProviders({
    children,
  }: PropsWithChildren): ReactNode {
    return providers.reduceRight<ReactNode>(
      (acc, Provider) => createElement(Provider, null, acc),
      children,
    );
  };
}
