# chore(deps): bump chokidar from 4.0.3 to 5.0.0

**Issue:** [#6](https://github.com/dexhorthy/kustomark-ralph-bash/pull/6)
**Author:** dependabot[bot]
**Created:** 2026-01-02
**State:** open

Bumps [chokidar](https://github.com/paulmillr/chokidar) from 4.0.3 to 5.0.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/paulmillr/chokidar/releases">chokidar's releases</a>.</em></p>
<blockquote>
<h2>5.0.0</h2>
<ul>
<li>Make the package ESM-only. Reduces on-disk package size from ~150kb to ~80kb</li>
<li>Increase minimum node.js version to v20.19. The versions starting from it support loading esm files from cjs</li>
<li>fix: Make types more precise <a href="https://redirect.github.com/paulmillr/chokidar/pull/1424">paulmillr/chokidar#1424</a></li>
<li>perf: re-use double slash regex <a href="https://redirect.github.com/paulmillr/chokidar/pull/1435">paulmillr/chokidar#1435</a></li>
<li>Update readdirp to ESM-only v5</li>
<li>Lots of minor improvements in tests</li>
<li>Increase security of NPM releases. Switch to token-less Trusted Publishing, with help of <a href="https://github.com/paulmillr/jsbt">jsbt</a></li>
<li>Switch compilation mode to isolatedDeclaration-based typescript for simplified auto-generated docs</li>
</ul>
<h2>New Contributors</h2>
<ul>
<li><a href="https://github.com/mhkeller"><code>@​mhkeller</code></a> made their first contribution in <a href="https://redirect.github.com/paulmillr/chokidar/pull/1426">paulmillr/chokidar#1426</a></li>
<li><a href="https://github.com/btea"><code>@​btea</code></a> made their first contribution in <a href="https://redirect.github.com/paulmillr/chokidar/pull/1432">paulmillr/chokidar#1432</a></li>
</ul>
<p><strong>Full Changelog</strong>: <a href="https://github.com/paulmillr/chokidar/compare/4.0.3...5.0.0">https://github.com/paulmillr/chokidar/compare/4.0.3...5.0.0</a></p>
</blockquote>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/paulmillr/chokidar/commit/c0c8d20e49d337491891078d1081bf91bd178de6"><code>c0c8d20</code></a> Release 5.0.0.</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/b211ceca34b1d30326334de21ed30b4a4ceb4c7e"><code>b211cec</code></a> Remove src from npm</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/87422468fd353426a53a78788b8718979c8725cc"><code>8742246</code></a> Upgrade dev deps, jsbt, ci files. Upgrade readdirp to v5.</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/de5a34c3cccf2d6fc812a6080e29fb4dd1583ec1"><code>de5a34c</code></a> Merge pull request <a href="https://redirect.github.com/paulmillr/chokidar/issues/1442">#1442</a> from paulmillr/flaky-buns</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/c08a6c4ed6a67b2cb16f61592f763b33e6bce7d3"><code>c08a6c4</code></a> fix: throttle based on dir + target</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/0c55ab3b049682fae9c1ee278ebc964dbfb92f08"><code>0c55ab3</code></a> test: wait for explicit calls in directory test</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/ce81be5a51ae72920649e2a74aeba86688c2a5ee"><code>ce81be5</code></a> perf: re-use double slash regex (<a href="https://redirect.github.com/paulmillr/chokidar/issues/1435">#1435</a>)</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/7d9c1ed27d2b9150077601677a8a8bad27b8f3da"><code>7d9c1ed</code></a> Merge pull request <a href="https://redirect.github.com/paulmillr/chokidar/issues/1433">#1433</a> from paulmillr/super-matrices</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/391554143f582fe78f7d37cf54b834c42f84652b"><code>3915541</code></a> Merge pull request <a href="https://redirect.github.com/paulmillr/chokidar/issues/1430">#1430</a> from paulmillr/esm-only</li>
<li><a href="https://github.com/paulmillr/chokidar/commit/9308bedee986abac912100e4bcc4823a1504a10f"><code>9308bed</code></a> chore: use Nodejs 24 in CI (<a href="https://redirect.github.com/paulmillr/chokidar/issues/1432">#1432</a>)</li>
<li>Additional commits viewable in <a href="https://github.com/paulmillr/chokidar/compare/4.0.3...5.0.0">compare view</a></li>
</ul>
</details>
<details>
<summary>Maintainer changes</summary>
<p>This version was pushed to npm by [GitHub Actions](<a href="https://www.npmjs.com/~GitHub">https://www.npmjs.com/~GitHub</a> Actions), a new releaser for chokidar since your current version.</p>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=chokidar&package-manager=npm_and_yarn&previous-version=4.0.3&new-version=5.0.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.

[//]: # (dependabot-automerge-start)
[//]: # (dependabot-automerge-end)

---

<details>
<summary>Dependabot commands and options</summary>
<br />

You can trigger Dependabot actions by commenting on this PR:
- `@dependabot rebase` will rebase this PR
- `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it
- `@dependabot merge` will merge this PR after your CI passes on it
- `@dependabot squash and merge` will squash and merge this PR after your CI passes on it
- `@dependabot cancel merge` will cancel a previously requested merge and block automerging
- `@dependabot reopen` will reopen this PR if it is closed
- `@dependabot close` will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)


</details>
