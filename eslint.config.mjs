import nextConfig from "eslint-config-next";

const projectConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "out/**"],
    rules: {
      // These are valuable React Compiler recommendations, but the existing
      // app intentionally uses effects for browser/storage synchronization.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default projectConfig;
