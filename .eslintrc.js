module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true, // Assuming tests might be present or added later
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended', // From eslint-plugin-react-hooks
    'prettier', // From eslint-config-prettier (disables ESLint rules that conflict with Prettier)
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    'react-hooks',
  ],
  settings: {
    react: {
      version: 'detect', // Automatically detect the React version
    },
  },
  rules: {
    // Add any project-specific rules here if needed in the future
    // For now, start with a basic set from the extended configurations.
    'react/prop-types': 'off', // Turning off prop-types for now as it can be noisy
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+ new JSX transform
  },
  globals: {
    process: 'readonly',
  },
};
