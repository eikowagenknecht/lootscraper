import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

interface FinderOptions {
  rootDir: string;
  exclude?: string[];
  testsOnly?: boolean;
}

/**
 * Finds all TypeScript files in a directory and its subdirectories
 */
export class TypeScriptFinder {
  private readonly options: Required<FinderOptions>;
  private gitIgnorePatterns: string[] = [];

  constructor(options: FinderOptions) {
    this.options = {
      exclude: [],
      testsOnly: false,
      ...options,
    };
  }

  /**
   * Reads and parses .gitignore file
   */
  private async loadGitIgnore(): Promise<void> {
    const gitignorePath = join(this.options.rootDir, ".gitignore");

    if (!existsSync(gitignorePath)) {
      return;
    }

    try {
      const content = await readFile(gitignorePath, "utf-8");
      this.gitIgnorePatterns = content
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) => line && !line.startsWith("#") && !line.startsWith("!"), // Ignore "negative" patterns
        )
        .map((pattern) => {
          // Remove trailing slashes and leading ./ or /
          return pattern.replace(/\/+$/, "").replace(/^\.?\//, "");
        });
    } catch (error) {
      console.warn("Failed to read .gitignore:", error);
    }
  }

  /**
   * Checks if a path matches any gitignore pattern
   */
  private matchesGitIgnore(path: string): boolean {
    const relativePath = relative(this.options.rootDir, path).replace(
      /\\/g,
      "/",
    );

    return this.gitIgnorePatterns.some((pattern) => {
      // Handle directory wildcards
      if (pattern.endsWith("/*")) {
        const dirPattern = pattern.slice(0, -2);
        return relativePath.startsWith(`${dirPattern}/`);
      }

      // Handle file extension patterns
      if (pattern.startsWith("*.")) {
        const ext = pattern.slice(1);
        return relativePath.endsWith(ext);
      }

      // Handle exact matches and simple wildcards
      if (pattern.includes("*")) {
        const regex = new RegExp(
          `^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
        );
        return regex.test(relativePath);
      }

      // Direct match
      return relativePath === pattern || relativePath.startsWith(`${pattern}/`);
    });
  }

  /**
   * Checks if a file is a test file
   */
  private isTestFile(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, "/");

    const isTest =
      normalizedPath.includes("/tests/") ||
      normalizedPath.includes("/test/") ||
      normalizedPath.startsWith("test/") ||
      normalizedPath.startsWith("tests/") ||
      normalizedPath.includes(".test.") ||
      normalizedPath.includes(".spec.") ||
      /\.tests?\.[jt]sx?$/.test(normalizedPath);

    return isTest;
  }

  private shouldExclude(path: string, isDirectory: boolean): boolean {
    // Always exclude .git directory
    if (path.includes("/.git/")) {
      return true;
    }

    // Check custom excludes first
    if (this.options.exclude.some((exclude) => path.includes(exclude))) {
      return true;
    }

    // Only apply test file filtering to files, not directories
    if (!isDirectory) {
      const isTest = this.isTestFile(path);

      // If we only want test files, exclude non-test files
      if (this.options.testsOnly && !isTest) {
        return true;
      }

      // If we don't want test files, exclude test files
      if (!this.options.testsOnly && isTest) {
        return true;
      }
    }

    // Then check gitignore patterns
    return this.matchesGitIgnore(path);
  }

  /**
   * Recursively finds all .ts files in a directory
   */
  private async findFiles(dir: string): Promise<string[]> {
    const dirents = await readdir(dir, { withFileTypes: true });

    const files = await Promise.all(
      dirents.map(async (dirent) => {
        const res = resolve(dir, dirent.name);

        if (this.shouldExclude(res, dirent.isDirectory())) {
          return [];
        }

        if (dirent.isDirectory()) {
          return this.findFiles(res);
        }

        if (
          dirent.isFile() &&
          (dirent.name.endsWith(".ts") || dirent.name.endsWith(".tsx")) &&
          !dirent.name.endsWith(".d.ts")
        ) {
          return [relative(this.options.rootDir, res)];
        }

        return [];
      }),
    );

    return files.flat();
  }

  /**
   * Finds files and formats them as a TypeScript array literal
   */
  public async formatForCodeDump(): Promise<string> {
    await this.loadGitIgnore();
    const files = await this.findFiles(this.options.rootDir);
    const sortedFiles = files.sort();

    return `[\n  ${sortedFiles
      .map((file) => `"${file.replace(/\\/g, "/")}"`)
      .join(",\n  ")}\n]`;
  }
}

// Get raw args from process.argv, which includes node and script path at 0 and 1
const args = process.argv.slice(2);
const testsOnly = args.includes("--tests");

const finder = new TypeScriptFinder({
  rootDir: process.cwd(),
  exclude: [], // Additional excludes beyond .gitignore if needed
  testsOnly,
});

finder
  .formatForCodeDump()
  .then((result) => console.log(result))
  .catch((error) => {
    console.error("Error finding files:", error);
    process.exit(1);
  });
