#!/usr/bin/env bun

import Anthropic from '@anthropic-ai/sdk'
import { getStagedDiff, getStagedFiles, gitCommit } from './lib/git'

async function generateCommitMessage(diff: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        throw new Error(
            'ANTHROPIC_API_KEY environment variable is not set. Please set it to use autocommit.',
        )
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
        throw new Error('Unexpected response type from Claude')
    }

    return content.text.trim()
}

async function main() {
    try {
        // Check for staged changes
        const stagedFiles = await getStagedFiles()
        if (stagedFiles.length === 0) {
            console.error("No staged changes found. Stage your changes with 'git add' first.")
            process.exit(1)
        }

        console.log(`Staged files:\n  ${stagedFiles.join('\n  ')}`)

        // Get the staged diff
        const diff = await getStagedDiff()
        if (!diff.trim()) {
            console.error('No diff content found in staged changes.')
            process.exit(1)
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
        console.error(`Error: ${error instanceof Error ? error.message : error}`)
        process.exit(1)
    }
}

main()
