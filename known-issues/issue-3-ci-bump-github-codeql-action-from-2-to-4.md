# ci: bump github/codeql-action from 2 to 4

**Issue:** [#3](https://github.com/dexhorthy/kustomark-ralph-bash/pull/3)
**Author:** dependabot[bot]
**Created:** 2026-01-02
**State:** open

Bumps [github/codeql-action](https://github.com/github/codeql-action) from 2 to 4.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/github/codeql-action/releases">github/codeql-action's releases</a>.</em></p>
<blockquote>
<h2>v3.31.9</h2>
<h1>CodeQL Action Changelog</h1>
<p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p>
<h2>3.31.9 - 16 Dec 2025</h2>
<p>No user facing changes.</p>
<p>See the full <a href="https://github.com/github/codeql-action/blob/v3.31.9/CHANGELOG.md">CHANGELOG.md</a> for more information.</p>
<h2>v3.31.8</h2>
<h1>CodeQL Action Changelog</h1>
<p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p>
<h2>3.31.8 - 11 Dec 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.8. <a href="https://redirect.github.com/github/codeql-action/pull/3354">#3354</a></li>
</ul>
<p>See the full <a href="https://github.com/github/codeql-action/blob/v3.31.8/CHANGELOG.md">CHANGELOG.md</a> for more information.</p>
<h2>v3.31.7</h2>
<h1>CodeQL Action Changelog</h1>
<p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p>
<h2>3.31.7 - 05 Dec 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.7. <a href="https://redirect.github.com/github/codeql-action/pull/3343">#3343</a></li>
</ul>
<p>See the full <a href="https://github.com/github/codeql-action/blob/v3.31.7/CHANGELOG.md">CHANGELOG.md</a> for more information.</p>
<h2>v3.31.6</h2>
<h1>CodeQL Action Changelog</h1>
<p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p>
<h2>3.31.6 - 01 Dec 2025</h2>
<p>No user facing changes.</p>
<p>See the full <a href="https://github.com/github/codeql-action/blob/v3.31.6/CHANGELOG.md">CHANGELOG.md</a> for more information.</p>
<h2>v3.31.5</h2>
<h1>CodeQL Action Changelog</h1>
<p>See the <a href="https://github.com/github/codeql-action/releases">releases page</a> for the relevant changes to the CodeQL CLI and language packs.</p>
<h2>3.31.5 - 24 Nov 2025</h2>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/github/codeql-action/blob/main/CHANGELOG.md">github/codeql-action's changelog</a>.</em></p>
<blockquote>
<h2>4.31.9 - 16 Dec 2025</h2>
<p>No user facing changes.</p>
<h2>4.31.8 - 11 Dec 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.8. <a href="https://redirect.github.com/github/codeql-action/pull/3354">#3354</a></li>
</ul>
<h2>4.31.7 - 05 Dec 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.7. <a href="https://redirect.github.com/github/codeql-action/pull/3343">#3343</a></li>
</ul>
<h2>4.31.6 - 01 Dec 2025</h2>
<p>No user facing changes.</p>
<h2>4.31.5 - 24 Nov 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.6. <a href="https://redirect.github.com/github/codeql-action/pull/3321">#3321</a></li>
</ul>
<h2>4.31.4 - 18 Nov 2025</h2>
<p>No user facing changes.</p>
<h2>4.31.3 - 13 Nov 2025</h2>
<ul>
<li>CodeQL Action v3 will be deprecated in December 2026.  The Action now logs a warning for customers who are running v3 but could be running v4. For more information, see <a href="https://github.blog/changelog/2025-10-28-upcoming-deprecation-of-codeql-action-v3/">Upcoming deprecation of CodeQL Action v3</a>.</li>
<li>Update default CodeQL bundle version to 2.23.5. <a href="https://redirect.github.com/github/codeql-action/pull/3288">#3288</a></li>
</ul>
<h2>4.31.2 - 30 Oct 2025</h2>
<p>No user facing changes.</p>
<h2>4.31.1 - 30 Oct 2025</h2>
<ul>
<li>The <code>add-snippets</code> input has been removed from the <code>analyze</code> action. This input has been deprecated since CodeQL Action 3.26.4 in August 2024 when this removal was announced.</li>
</ul>
<h2>4.31.0 - 24 Oct 2025</h2>
<ul>
<li>Bump minimum CodeQL bundle version to 2.17.6. <a href="https://redirect.github.com/github/codeql-action/pull/3223">#3223</a></li>
<li>When SARIF files are uploaded by the <code>analyze</code> or <code>upload-sarif</code> actions, the CodeQL Action automatically performs post-processing steps to prepare the data for the upload. Previously, these post-processing steps were only performed before an upload took place. We are now changing this so that the post-processing steps will always be performed, even when the SARIF files are not uploaded. This does not change anything for the <code>upload-sarif</code> action. For <code>analyze</code>, this may affect Advanced Setup for CodeQL users who specify a value other than <code>always</code> for the <code>upload</code> input. <a href="https://redirect.github.com/github/codeql-action/pull/3222">#3222</a></li>
</ul>
<h2>4.30.9 - 17 Oct 2025</h2>
<ul>
<li>Update default CodeQL bundle version to 2.23.3. <a href="https://redirect.github.com/github/codeql-action/pull/3205">#3205</a></li>
<li>Experimental: A new <code>setup-codeql</code> action has been added which is similar to <code>init</code>, except it only installs the CodeQL CLI and does not initialize a database. Do not use this in production as it is part of an internal experiment and subject to change at any time. <a href="https://redirect.github.com/github/codeql-action/pull/3204">#3204</a></li>
</ul>
<h2>4.30.8 - 10 Oct 2025</h2>
<p>No user facing changes.</p>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/github/codeql-action/commit/5d4e8d1aca955e8d8589aabd499c5cae939e33c7"><code>5d4e8d1</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/3371">#3371</a> from github/update-v4.31.9-998798e34</li>
<li><a href="https://github.com/github/codeql-action/commit/1dc115f17a8c6966e94a6477313dd3df6319bc83"><code>1dc115f</code></a> Update changelog for v4.31.9</li>
<li><a href="https://github.com/github/codeql-action/commit/998798e34d79baddb1566c60bbb8f68a901c04e6"><code>998798e</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/3352">#3352</a> from github/nickrolfe/jar-min-ff-cleanup</li>
<li><a href="https://github.com/github/codeql-action/commit/5eb751966fe18977cdefa4e41e0f90e92801ce90"><code>5eb7519</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/3358">#3358</a> from github/henrymercer/database-upload-telemetry</li>
<li><a href="https://github.com/github/codeql-action/commit/d29eddb39b7c33171bb0250114b1c9e3ff8fe2bc"><code>d29eddb</code></a> Extract version number to constant</li>
<li><a href="https://github.com/github/codeql-action/commit/e9626872ef3347a9c18091d60da647084c2451a6"><code>e962687</code></a> Merge branch 'main' into henrymercer/database-upload-telemetry</li>
<li><a href="https://github.com/github/codeql-action/commit/19c7f96922a6269458f2cadcc23faf0ebaa1368b"><code>19c7f96</code></a> Rename <code>isOverlayBase</code></li>
<li><a href="https://github.com/github/codeql-action/commit/ae5de9a20d0468cc3818a0dc5c99e456f996d9cf"><code>ae5de9a</code></a> Use <code>getErrorMessage</code> in log too</li>
<li><a href="https://github.com/github/codeql-action/commit/0cb86337c5111af4ff3dc7e8f9b98c479c9ea954"><code>0cb8633</code></a> Prefer <code>performance.now()</code></li>
<li><a href="https://github.com/github/codeql-action/commit/c07cc0d3a95a282fc5a54477464931c776d124ec"><code>c07cc0d</code></a> Merge pull request <a href="https://redirect.github.com/github/codeql-action/issues/3351">#3351</a> from github/henrymercer/ghec-dr-determine-tools-vers...</li>
<li>Additional commits viewable in <a href="https://github.com/github/codeql-action/compare/v2...v4">compare view</a></li>
</ul>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=github/codeql-action&package-manager=github_actions&previous-version=2&new-version=4)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
