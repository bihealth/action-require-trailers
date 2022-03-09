const core = require('@actions/core')
const github = require('@actions/github')

const RE_TRAILER_LINE = /^([a-zA-Z_-]+):\s*(.*)\s*/
const RE_ISSUE = /^#\d+$/
const IMPACTS = ["none", "require-revalidation"]

try {
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  core.warning(`The event payload: ${payload}`);

  let allGood = true
  let seenRelatedIssue = false
  let seenProjectedImpact = false

  const commits = github.context.payload.commits
  for (const commit of commits) {
    const msg = commit.message
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
            seenRelatedIssue = true
            if (!(value in IMPACTS)) {
              core.error(`Projected-Results-Impact value "${value}" is not valid!`)
              allGood = false
            }
            break
        }
      } else {
        break  // first non-trailer line
      }
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
} catch (error) {
  core.setFailed(error.message)
}
