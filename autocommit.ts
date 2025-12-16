#!/usr/bin/env bun

import Anthropic from '@anthropic-ai/sdk'
import { ApiError, UserError, handleError } from './lib/errors'
import { getStagedDiff, getStagedFiles, gitCommit } from './lib/git'

async function generateCommitMessage(diff: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        throw new ApiError('ANTHROPIC_API_KEY environment variable is not set.')
    }

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
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
        // Check for staged changes
        const stagedFiles = await getStagedFiles()
        if (stagedFiles.length === 0) {
            throw new UserError("No staged changes found. Stage your changes with 'git add' first.")
        }

        console.log(`Staged files:\n  ${stagedFiles.join('\n  ')}`)

        // Get the staged diff
        const diff = await getStagedDiff()
        if (!diff.trim()) {
            throw new UserError('No diff content found in staged changes.')
        }

        // Generate commit message
        console.log('\nGenerating commit message...')
        const commitMessage = await generateCommitMessage(diff)
        console.log(`\nCommit message: ${commitMessage}`)

        // Commit with the generated message
        const output = await gitCommit(commitMessage)
        console.log(output)
        console.log('\nCommit successful!')
    } catch (error) {
        handleError(error)
    }
}

main()
