#!/usr/bin/env bun

import Anthropic from '@anthropic-ai/sdk'
import { getModel } from './lib/config'
import { ApiError, UserError, handleError } from './lib/errors'
import { getStagedDiff, getStagedFiles, gitCommit } from './lib/git'

const MAX_DIFF_SIZE = 8000

interface Options {
    dryRun: boolean
}

function parseArgs(): Options {
    const args = process.argv.slice(2)
    return {
        dryRun: args.includes('--dry-run'),
    }
}

function truncateDiff(diff: string): { truncated: string; wasTruncated: boolean } {
    if (diff.length <= MAX_DIFF_SIZE) {
        return { truncated: diff, wasTruncated: false }
    }
    return {
        truncated: `${diff.slice(0, MAX_DIFF_SIZE)}\n\n... (diff truncated, ${diff.length - MAX_DIFF_SIZE} characters omitted)`,
        wasTruncated: true,
    }
}

async function generateCommitMessage(diff: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        throw new ApiError('ANTHROPIC_API_KEY environment variable is not set.')
    }

    const client = new Anthropic({ apiKey })
    const model = getModel()

    const response = await client.messages.create({
        model,
        max_tokens: 256,
        messages: [
            {
                role: 'user',
                content: `Generate a concise git commit message for the following diff. The message should:
- Start with a type prefix (feat, fix, docs, style, refactor, test, chore)
- Be written in imperative mood
- Be a single line, max 72 characters
- Not include any explanation, just the commit message

Diff:
${diff}`,
            },
        ],
    })

    const content = response.content[0]
    if (content?.type !== 'text') {
        throw new ApiError('Unexpected response type from API')
    }

    return content.text.trim()
}

async function main() {
    try {
        const options = parseArgs()

        // Check for staged changes
        const stagedFiles = await getStagedFiles()
        if (stagedFiles.length === 0) {
            throw new UserError("No staged changes found. Stage your changes with 'git add' first.")
        }

        console.log(`Staged files:\n  ${stagedFiles.join('\n  ')}\n`)

        // Get the staged diff
        const rawDiff = await getStagedDiff()
        if (!rawDiff.trim()) {
            throw new UserError('No diff content found in staged changes.')
        }

        // Truncate large diffs
        const { truncated: diff, wasTruncated } = truncateDiff(rawDiff)
        if (wasTruncated) {
            console.log(
                `\nNote: Diff was truncated (${rawDiff.length} chars -> ${MAX_DIFF_SIZE} chars)`,
            )
        }

        // Generate commit message
        const commitMessage = await generateCommitMessage(diff)

        // Exit if dry-run
        if (options.dryRun) {
            console.log('\n[dry-run] Would commit with the above message.')
            process.exit(0)
        }

        // Commit with the generated message
        const output = await gitCommit(commitMessage)
        console.log(output)
    } catch (error) {
        handleError(error)
    }
}

main()
