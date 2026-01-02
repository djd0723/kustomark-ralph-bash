-1a. list open issues and compare with known-issues/:
    ```bash
    # List issue numbers from GitHub
    curl -s "https://api.github.com/repos/dexhorthy/kustomark-ralph-bash/issues?state=open" | jq -r '.[].number'

    # List existing known-issues files
    ls known-issues/
    ```

-1b. for any issues on GitHub not in known-issues/, fetch and save:
    ```bash
    # Fetch issue #N and save as markdown
    curl -s "https://api.github.com/repos/dexhorthy/kustomark-ralph-bash/issues/N" | \
      jq -r '"# \(.title)\n\n**Issue:** [#\(.number)](\(.html_url))\n**Author:** \(.user.login)\n**Created:** \(.created_at[:10])\n**State:** \(.state)\n\n\(.body)"' \
      > known-issues/issue-N-slug.md
    ```

-1c. read any new issues in known-issues/ and incorporate them into @IMPLEMENTATION_PLAN.md

0a. familiarize yourself with @specs/

0b. familiarize yourself with the code in @src/

1. read @IMPLEMENTATION_PLAN.md and implement the single highest priority feature using up to 5 subagents, including anything in the out of scope / future work - that's now in scope!


2. ensure all tests and linting passes with `bun check && bun test`, then update IMPLEMENTATION_PLAN.md with your progress

3. use `git add -A` and `git commit -m "..."` to commit your changes - do not include any claude attribution
