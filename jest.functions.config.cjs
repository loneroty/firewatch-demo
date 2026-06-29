/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  clearMocks: true,
  testMatch: ["<rootDir>/functions/src/**/*.test.ts"],
  testTimeout: 30000
};
