const core = require("@actions/core")
const github = require("@actions/github")
const octokit = require("@octokit/rest")

const RE_TRAILER_LINE = /^([a-zA-Z_-]+):\s*(.*)\s*/
const RE_ISSUE = /^#\d+$/
const IMPACTS = ["none", "require-revalidation"]

function processCommits (commits) {
  for (const commit of commits) {
    let allGood = true
    let seenRelatedIssue = false
    let seenProjectedImpact = false

    // Skip if commit author is dependabot
    const author = commit.author || commit.commit.author
    const authors = JSON.stringify(author)
    core.error(`author == ${authors}`)
    if (author.id === 49699333) {
        continue
    }
    const msg = commit.message || commit.commit.message
    const lines = msg.match(/[^\r\n]+/g)
    // Iterate commit message lines in reverse order
    for (const line of lines.reverse()) {
      const trimmedLine = line.trim()
      if (!trimmedLine.length) {
        continue  // skip empty lines
      }

      // From the back, we consider each line that looks like a trailer
      // (skipping empty lines) and break on the first non-trailer line.
      // We will check for the required trailers.
      const m = trimmedLine.match(RE_TRAILER_LINE)
      if (m) {
        const label = m[1]
        const value = m[2]

        switch (label) {
          case "Related-Issue":
            seenRelatedIssue = true
            if (!value.match(RE_ISSUE)) {
              core.error(`Related-Issue value "${value}" is not valid!`)
              allGood = false
            }
            break
          case "No-Related-Issue":
            seenRelatedIssue = true
            break
          case "Projected-Results-Impact":
            seenProjectedImpact = true
            if (!IMPACTS.includes(value)) {
              core.error(`Projected-Results-Impact value "${value}" is not valid!`)
              allGood = false
            }
            break
        }
      } else {
        break  // first non-trailer line
      }
    }
    console.log(`all good? ${allGood}`)
    console.log(`seen Related-Issue|No-Related-Issue: ${seenRelatedIssue}`)
    console.log(`seen Projected-Results-Impact: ${seenProjectedImpact}`)

    if (!seenRelatedIssue) {
      core.error(`Missing (No-)Related-Issue trailer!`)
    }
    if (!seenProjectedImpact) {
      core.error(`Missing Project-Results-Impact trailer!`)
    }
    if (!allGood || !seenRelatedIssue || !seenProjectedImpact) {
      core.setFailed("trailer check failed")
    }
  }
}

try {
  if (github.context.payload.commits) {
    processCommits(github.context.payload.commits)
  } else {
    const opts = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.number,
    }
    const kit = new octokit.Octokit()
    kit.rest.pulls
      .listCommits(opts)
      .then(
        response => processCommits(response.data),
        reason => core.error(`could not load commits: ${reason}`),
      )
  }
} catch (error) {
  core.setFailed(error.message)
}
