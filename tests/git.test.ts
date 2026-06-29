import { expect, test } from "bun:test";
import { gitFailureHint, parseGitSource } from "../src/core/git";

test("parse Git HTTPS URL", () => {
  expect(parseGitSource("https://gitlab.company.com/group/repo.git")).toEqual({
    url: "https://gitlab.company.com/group/repo.git",
  });
});

test("parse Git SSH URL with ref and subpath", () => {
  expect(parseGitSource("git@gitlab.company.com:group/repo.git#main:path/to/skill")).toEqual({
    url: "git@gitlab.company.com:group/repo.git",
    ref: "main",
    subpath: "path/to/skill",
  });
});

test("parse Git URL with ref only", () => {
  expect(parseGitSource("https://github.com/foo/bar.git#develop")).toEqual({
    url: "https://github.com/foo/bar.git",
    ref: "develop",
  });
});

test("parse file Git URL for local GitLab-style integration tests", () => {
  expect(parseGitSource("file:///tmp/repo#main:skill")).toEqual({
    url: "file:///tmp/repo",
    ref: "main",
    subpath: "skill",
  });
});

test("git clone authentication failures include a local git credential hint", () => {
  expect(gitFailureHint(["clone", "https://gitlab.company.com/group/repo.git", "/tmp/repo"], "remote: HTTP Basic: Access denied")).toContain(
    "Tools Manager uses your local git command",
  );
});
