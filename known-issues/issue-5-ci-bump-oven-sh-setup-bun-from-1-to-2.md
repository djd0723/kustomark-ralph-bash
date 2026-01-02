# ci: bump oven-sh/setup-bun from 1 to 2

**Issue:** [#5](https://github.com/dexhorthy/kustomark-ralph-bash/pull/5)
**Author:** dependabot[bot]
**Created:** 2026-01-02
**State:** open

Bumps [oven-sh/setup-bun](https://github.com/oven-sh/setup-bun) from 1 to 2.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/oven-sh/setup-bun/releases">oven-sh/setup-bun's releases</a>.</em></p>
<blockquote>
<h2>v2</h2>
<p><code>oven-sh/setup-bun</code> is the github action for setting up Bun.</p>
<p>This release introduces support for the <code>bun-version-file</code> option, fixes <a href="https://redirect.github.com/oven-sh/setup-bun/issues/79">oven-sh/setup-bun#79</a>, and adds bun paths &amp; urls to the output (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/81">oven-sh/setup-bun#81</a>)</p>
<p>For more information, see <a href="https://redirect.github.com/oven-sh/setup-bun/pull/76">oven-sh/setup-bun#76</a> by <a href="https://github.com/adeherysh"><code>@​adeherysh</code></a> and <a href="https://redirect.github.com/oven-sh/setup-bun/pull/80">oven-sh/setup-bun#80</a> by <a href="https://github.com/xHyroM"><code>@​xHyroM</code></a> :tada:</p>
<p><strong>Full Changelog</strong>: <a href="https://github.com/oven-sh/setup-bun/compare/v1...v2">https://github.com/oven-sh/setup-bun/compare/v1...v2</a></p>
<h2>v1.2.2</h2>
<p><code>oven-sh/setup-bun</code> is the github action for setting up Bun.</p>
<p>This release introduces support for the <code>bun-download-url</code> input, which lets you override the URL used to download the .zip file for Bun.</p>
<p>Here's an example:</p>
<pre lang="yaml"><code>- name: Setup Bun
  uses: oven-sh/setup-bun@v1.2.2
  with:
    bun-version: latest
    bun-download-url: &quot;https://github.com/oven-sh/bun/releases/latest/download/bun-${{runner.os == 'macOS' &amp;&amp; 'darwin' || runner.os}}-${{ runner.arch == 'X64' &amp;&amp; 'x64' || 'arm64' }}.zip&quot;
</code></pre>
<h2>v1.2.1</h2>
<h1>setup-bun <code>v1.2.1</code></h1>
<p>Download, install, and setup <a href="https://bun.sh">Bun</a> in GitHub Actions.</p>
<h2>Usage</h2>
<pre lang="yaml"><code>- uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest
</code></pre>
<h3>Using a custom NPM registry</h3>
<pre lang="yaml"><code>- uses: oven-sh/setup-bun@v1
  with:
    registry-url: &quot;https://npm.pkg.github.com/&quot;
    scope: &quot;@foo&quot;
</code></pre>
<p>If you need to authenticate with a private registry, you can set the <code>BUN_AUTH_TOKEN</code> environment variable.</p>
<pre lang="yaml"><code>- name: Install Dependencies
  env:
&lt;/tr&gt;&lt;/table&gt; 
</code></pre>
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/oven-sh/setup-bun/commit/735343b667d3e6f658f44d0eca948eb6282f2b76"><code>735343b</code></a> [autofix.ci] apply automated fixes</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/27ecfffdee6d0784bbca041b42dfa94a77a0d00d"><code>27ecfff</code></a> ci: update autofix ci</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/fcc30ed971ed73ecf5f7abd8e12455fda9c64a8c"><code>fcc30ed</code></a> fix(docs): remove wildcard in version (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/124">#124</a>)</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/56408e9a3f6d4f21fb6b1bf4fd7529dc366d7611"><code>56408e9</code></a> release: v2.0.2</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/85cb7f6e7e70ced99b21961bd999ddb1af91a907"><code>85cb7f6</code></a> build: bump <code>@​actions/cache</code> version (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/128">#128</a>)</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/54cb141c5c91e2fdc396be3155a391f28e1822eb"><code>54cb141</code></a> ci: remove unnecessary steps &amp; cleanup (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/118">#118</a>)</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/6fb6603cc1311b0873754721be144a54b091a2f2"><code>6fb6603</code></a> build: use text-based Bun lockfile (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/116">#116</a>)</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/9bdeab43204a7e54c77e5e6fae776e2aa912dad5"><code>9bdeab4</code></a> [autofix.ci] apply automated fixes</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/f09eb1edd0a8b355ceeffa8389f83b91db37b51a"><code>f09eb1e</code></a> fix: make bun resolve to given file path when an absolute path is given (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/114">#114</a>)</li>
<li><a href="https://github.com/oven-sh/setup-bun/commit/8f1bc2eeb376efbcaee0c5f579dee0d2f81582c6"><code>8f1bc2e</code></a> ci: add setup bun download url (<a href="https://redirect.github.com/oven-sh/setup-bun/issues/105">#105</a>)</li>
<li>Additional commits viewable in <a href="https://github.com/oven-sh/setup-bun/compare/v1...v2">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=oven-sh/setup-bun&package-manager=github_actions&previous-version=1&new-version=2)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
