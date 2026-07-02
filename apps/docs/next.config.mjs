import nextra from "nextra";

const withNextra = nextra({
  // Docs live at the site root (no contentDirBasePath).
  search: { codeblocks: false },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The workspace packages ship raw TypeScript/TSX from `src`, so Next must
  // transpile them (they are not pre-built for the docs build).
  transpilePackages: ["@telekinesis/core", "@telekinesis/schema"],
};

export default withNextra(nextConfig);
