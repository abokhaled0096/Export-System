import { execFileSync } from "node:child_process";
import path from "node:path";

export default async function globalTeardown() {
  execFileSync(process.execPath, [require.resolve("tsx/cli"), path.join(__dirname, "scripts", "delete-test-user.ts")], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
}
