# chore(deps): bump @clack/prompts from 0.11.0 to 1.1.0

**Issue:** [#26](https://github.com/dexhorthy/kustomark-ralph-bash/pull/26)
**Author:** dependabot[bot]
**Created:** 2026-03-09
**State:** open

Bumps [@clack/prompts](https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts) from 0.11.0 to 1.1.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/bombshell-dev/clack/releases"><code>@​clack/prompts</code>'s releases</a>.</em></p>
<blockquote>
<h2><code>@​clack/prompts</code><a href="https://github.com/1"><code>@​1</code></a>.1.0</h2>
<h3>Minor Changes</h3>
<ul>
<li>e3333fb: Replaces <code>picocolors</code> with Node.js built-in <code>styleText</code>.</li>
</ul>
<h3>Patch Changes</h3>
<ul>
<li>c3666e2: destruct <code>limitOption</code> param for better code readability, tweak types definitions</li>
<li>ba3df8e: Fixes withGuide support in intro, outro, and cancel messages.</li>
<li>Updated dependencies [e3333fb]
<ul>
<li><code>@​clack/core</code><a href="https://github.com/1"><code>@​1</code></a>.1.0</li>
</ul>
</li>
</ul>
<h2><code>@​clack/prompts</code><a href="https://github.com/1"><code>@​1</code></a>.0.1</h2>
<h3>Patch Changes</h3>
<ul>
<li>6404dc1: Disallows selection of <code>disabled</code> options in autocomplete.</li>
<li>86e36d8: Adds <code>withGuide</code> support to select prompt.</li>
<li>c697439: Fixes line wrapping behavior in autocomplete.</li>
<li>0ded19c: Simplifies <code>withGuide</code> option checks.</li>
<li>0e4ddc9: Fixes <code>withGuide</code> support in password and path prompts.</li>
<li>76550d6: Adds <code>withGuide</code> support to selectKey prompt.</li>
<li>f9b9953: Adds <code>withGuide</code> support to password prompt.</li>
<li>0e93ccb: Adds <code>vertical</code> arrangement option to <code>confirm</code> prompt.</li>
<li>4e9ae13: Adds <code>withGuide</code> support to confirm prompt.</li>
<li>0256238: Adds <code>withGuide</code> support to spinner prompt.</li>
<li>Updated dependencies [6404dc1]</li>
<li>Updated dependencies [2533180]
<ul>
<li><code>@​clack/core</code><a href="https://github.com/1"><code>@​1</code></a>.0.1</li>
</ul>
</li>
</ul>
<h2><code>@​clack/prompts</code><a href="https://github.com/1"><code>@​1</code></a>.0.0</h2>
<h3>Major Changes</h3>
<ul>
<li>
<p>c713fd5: The package is now distributed as ESM-only. In <code>v0</code> releases, the package was dual-published as CJS and ESM.</p>
<p>For existing CJS projects using Node v20+, please see Node's guide on <a href="https://nodejs.org/docs/latest-v20.x/api/modules.html#loading-ecmascript-modules-using-require">Loading ECMAScript modules using <code>require()</code></a>.</p>
</li>
</ul>
<h3>Minor Changes</h3>
<ul>
<li>
<p>415410b: This adds a custom filter function to autocompleteMultiselect. It could be used, for example, to support fuzzy searching logic.</p>
</li>
<li>
<p>7bc3301: Prompts now have a <code>userInput</code> stored separately from their <code>value</code>.</p>
</li>
<li>
<p>8409f2c: feat: add styleFrame option for spinner</p>
</li>
<li>
<p>2837845: Adds suggestion and path prompts</p>
</li>
<li>
<p>99c3530: Adds <code>format</code> option to the note prompt to allow formatting of individual lines</p>
</li>
<li>
<p>0aaee4c: Added new <code>taskLog</code> prompt for log output which is cleared on success</p>
</li>
</ul>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Changelog</summary>
<p><em>Sourced from <a href="https://github.com/bombshell-dev/clack/blob/main/packages/prompts/CHANGELOG.md"><code>@​clack/prompts</code>'s changelog</a>.</em></p>
<blockquote>
<h2>1.1.0</h2>
<h3>Minor Changes</h3>
<ul>
<li>e3333fb: Replaces <code>picocolors</code> with Node.js built-in <code>styleText</code>.</li>
</ul>
<h3>Patch Changes</h3>
<ul>
<li>c3666e2: destruct <code>limitOption</code> param for better code readability, tweak types definitions</li>
<li>ba3df8e: Fixes withGuide support in intro, outro, and cancel messages.</li>
<li>Updated dependencies [e3333fb]
<ul>
<li><code>@​clack/core</code><a href="https://github.com/1"><code>@​1</code></a>.1.0</li>
</ul>
</li>
</ul>
<h2>1.0.1</h2>
<h3>Patch Changes</h3>
<ul>
<li>6404dc1: Disallows selection of <code>disabled</code> options in autocomplete.</li>
<li>86e36d8: Adds <code>withGuide</code> support to select prompt.</li>
<li>c697439: Fixes line wrapping behavior in autocomplete.</li>
<li>0ded19c: Simplifies <code>withGuide</code> option checks.</li>
<li>0e4ddc9: Fixes <code>withGuide</code> support in password and path prompts.</li>
<li>76550d6: Adds <code>withGuide</code> support to selectKey prompt.</li>
<li>f9b9953: Adds <code>withGuide</code> support to password prompt.</li>
<li>0e93ccb: Adds <code>vertical</code> arrangement option to <code>confirm</code> prompt.</li>
<li>4e9ae13: Adds <code>withGuide</code> support to confirm prompt.</li>
<li>0256238: Adds <code>withGuide</code> support to spinner prompt.</li>
<li>Updated dependencies [6404dc1]</li>
<li>Updated dependencies [2533180]
<ul>
<li><code>@​clack/core</code><a href="https://github.com/1"><code>@​1</code></a>.0.1</li>
</ul>
</li>
</ul>
<h2>1.0.0</h2>
<h3>Major Changes</h3>
<ul>
<li>
<p>c713fd5: The package is now distributed as ESM-only. In <code>v0</code> releases, the package was dual-published as CJS and ESM.</p>
<p>For existing CJS projects using Node v20+, please see Node's guide on <a href="https://nodejs.org/docs/latest-v20.x/api/modules.html#loading-ecmascript-modules-using-require">Loading ECMAScript modules using <code>require()</code></a>.</p>
</li>
</ul>
<h3>Minor Changes</h3>
<ul>
<li>
<p>415410b: This adds a custom filter function to autocompleteMultiselect. It could be used, for example, to support fuzzy searching logic.</p>
</li>
<li>
<p>7bc3301: Prompts now have a <code>userInput</code> stored separately from their <code>value</code>.</p>
</li>
<li>
<p>8409f2c: feat: add styleFrame option for spinner</p>
</li>
<li>
<p>2837845: Adds suggestion and path prompts</p>
</li>
<li>
<p>99c3530: Adds <code>format</code> option to the note prompt to allow formatting of individual lines</p>
</li>
<li>
<p>0aaee4c: Added new <code>taskLog</code> prompt for log output which is cleared on success</p>
</li>
<li>
<p>729bbb6: Add support for customizable spinner cancel and error messages. Users can now customize these messages either per spinner instance or globally via the <code>updateSettings</code> function to support multilingual CLIs.</p>
<p>This update also improves the architecture by exposing the core settings to the prompts package, enabling more consistent default message handling across the codebase.</p>
</li>
</ul>
<!-- raw HTML omitted -->
</blockquote>
<p>... (truncated)</p>
</details>
<details>
<summary>Commits</summary>
<ul>
<li><a href="https://github.com/bombshell-dev/clack/commit/56edf9790b3340918e3773575e58c08b0154b756"><code>56edf97</code></a> [ci] release (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/472">#472</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/ba3df8e81abfd5aa8de7c49abe87901d1aac7713"><code>ba3df8e</code></a> fix(prompts): honor withGuide for intro/outro/cancel messages (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/474">#474</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/e3333fbf31bbc51e02fa399cd2b56674f44872c8"><code>e3333fb</code></a> refactor(core, prompts): replace picocolors with styleText  (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/403">#403</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/594c58a730798db996113a5178be4bfd9f270b3f"><code>594c58a</code></a> [ci] format</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/c3666e2acfb4f1603f0c6552cf8887d72034c26e"><code>c3666e2</code></a> chore(prompts): destruct <code>limitOption</code> param for better code readability (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/457">#457</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/667572b221380cca0c5b02e31c165c3570c059ce"><code>667572b</code></a> [ci] release (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/456">#456</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/6404dc1054682c05b71ea2819888f9c8c48a5a97"><code>6404dc1</code></a> fix: support disabled options in autocomplete (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/466">#466</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/ba1072166a3bdb11d6389a3a1c881cfc3ce985d1"><code>ba10721</code></a> [ci] format</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/0e4ddc91cf1a3300a77814d3245ec51218541657"><code>0e4ddc9</code></a> fix: respect withGuide option in password and path prompts (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/460">#460</a>)</li>
<li><a href="https://github.com/bombshell-dev/clack/commit/0ded19ceb3927a6d790d6a0b855a17017caed314"><code>0ded19c</code></a> chore(prompts): simplify guide option checks (<a href="https://github.com/bombshell-dev/clack/tree/HEAD/packages/prompts/issues/459">#459</a>)</li>
<li>Additional commits viewable in <a href="https://github.com/bombshell-dev/clack/commits/@clack/prompts@1.1.0/packages/prompts">compare view</a></li>
</ul>
</details>
<details>
<summary>Maintainer changes</summary>
<p>This version was pushed to npm by [GitHub Actions](<a href="https://www.npmjs.com/~GitHub">https://www.npmjs.com/~GitHub</a> Actions), a new releaser for <code>@​clack/prompts</code> since your current version.</p>
</details>
<br />


[![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=@clack/prompts&package-manager=npm_and_yarn&previous-version=0.11.0&new-version=1.1.0)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)

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
- `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency
- `@dependabot ignore this major version` will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this minor version` will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- `@dependabot ignore this dependency` will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)


</details>
