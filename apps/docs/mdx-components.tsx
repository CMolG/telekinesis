import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import { DemoGif, Divider, Frame, Header } from "./components/telekinesis";

const docsComponents = getDocsMDXComponents();

/**
 * Global MDX components. Beyond the theme defaults we register the Telekinesis
 * authoring primitives so any `.mdx` page can drop in `<Frame>`, `<DemoGif>`,
 * `<Divider>` and `<Header>` without an import.
 */
export const useMDXComponents = <T extends Record<string, unknown>>(components?: T) => ({
  ...docsComponents,
  Frame,
  DemoGif,
  Divider,
  Header,
  ...components,
});
