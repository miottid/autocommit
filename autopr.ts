#!/usr/bin/env bun

import Anthropic from '@anthropic-ai/sdk'
import * as readline from 'readline'
import {
    checkUnpushedCommits,
    createPR,
    getChangedFiles,
    getCommits,
    getCurrentBranch,
    getDefaultBranch,
    getDiff,
    getExistingPR,
    pushBranch,
    remoteBranchExists,
} from './lib/git'

async function getPRTemplate(): Promise<string | null> {
    const templatePaths = [
        '.github/PULL_REQUEST_TEMPLATE.md',
        '.github/pull_request_template.md',
        'PULL_REQUEST_TEMPLATE.md',
        'pull_request_template.md',
    ]

    for (const path of templatePaths) {
        const file = Bun.file(path)
        if (await file.exists()) {
            return await file.text()
        }
    }

    return null
}

function askQuestion(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close()
            resolve(answer.trim())
        })
    })
}

interface PRContent {
    title: string
    body: string
    needsClarification?: boolean
    clarificationQuestion?: string
}

async function generatePRContent(
    commits: string,
    diff: string,
    changedFiles: string[],
    template: string | null,
    additionalContext?: string,
): Promise<PRContent> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
        throw new Error(
            'ANTHROPIC_API_KEY environment variable is not set. Please set it to use autopr.',
        )
    }

    const client = new Anthropic({ apiKey })

    const templateInstructions = template
        ? `Use this PR template as a guide for the body structure. IMPORTANT: Remove any sections from the template that are not relevant to the changes (e.g., if there are no breaking changes, remove the breaking changes section; if there are no migrations, remove the migration section).\n\nTemplate:\n${template}\n\n`
        : `Structure the PR body with these sections (only include sections relevant to the changes):
## Summary
Brief description of changes

## Changes
- Bullet points of specific changes

## Testing
How to test these changes
`

    const contextInfo = additionalContext
        ? `\nAdditional context from user: ${additionalContext}\n`
        : ''

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: `Generate a GitHub Pull Request title and description based on the following information.
${contextInfo}
${templateInstructions}
Changed files:
${changedFiles.join('\n')}

Commits:
${commits}

Diff (truncated if too long):
${diff.slice(0, 8000)}

Respond in JSON format:
{
  "title": "PR title (concise, max 72 chars)",
  "body": "PR description following the template",
  "needsClarification": false,
  "clarificationQuestion": null
}

If the changes are unclear or you need more context to write a good PR description, set needsClarification to true and provide a specific clarificationQuestion.

Only output valid JSON, no markdown code blocks.`,
            },
        ],
    })

    const content = response.content[0]
    if (content?.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
    }

    try {
        return JSON.parse(content.text) as PRContent
    } catch {
        throw new Error(`Failed to parse Claude response: ${content.text}`)
    }
}

async function main() {
    try {
        const currentBranch = await getCurrentBranch()
        if (!currentBranch) {
            console.error('Not on a branch. Please checkout a branch first.')
            process.exit(1)
        }

        const baseBranch = await getDefaultBranch()
        console.log(`Current branch: ${currentBranch}`)
        console.log(`Base branch: ${baseBranch}`)

        if (currentBranch === baseBranch) {
            console.error(
                `You are on the base branch (${baseBranch}). Create a feature branch first.`,
            )
            process.exit(1)
        }

        // Check if PR already exists
        const existingPR = await getExistingPR()
        if (existingPR) {
            console.log(`A PR already exists for this branch: ${existingPR}`)
            process.exit(0)
        }

        // Push branch if needed
        const remoteExists = await remoteBranchExists()
        const hasUnpushed = await checkUnpushedCommits()

        if (!remoteExists || hasUnpushed) {
            await pushBranch()
        }

        // Gather PR information
        console.log('\nGathering commit information...')
        const [commits, diff, changedFiles, template] = await Promise.all([
            getCommits(baseBranch),
            getDiff(baseBranch),
            getChangedFiles(baseBranch),
            getPRTemplate(),
        ])

        if (changedFiles.length === 0) {
            console.error('No changes found compared to base branch.')
            process.exit(1)
        }

        console.log(`\nChanged files (${changedFiles.length}):`)
        changedFiles.slice(0, 10).forEach((f) => {
            console.log(`  ${f}`)
        })
        if (changedFiles.length > 10) {
            console.log(`  ... and ${changedFiles.length - 10} more`)
        }

        // Generate PR content
        console.log('\nGenerating PR description...')
        let prContent = await generatePRContent(commits, diff, changedFiles, template)

        // Handle clarification if needed
        while (prContent.needsClarification && prContent.clarificationQuestion) {
            console.log('\nClarification needed:')
            const answer = await askQuestion(`${prContent.clarificationQuestion}\n> `)
            if (!answer) {
                console.log('Proceeding without additional context...')
                prContent.needsClarification = false
            } else {
                prContent = await generatePRContent(commits, diff, changedFiles, template, answer)
            }
        }

        // Show preview
        console.log(`\n${'='.repeat(60)}`)
        console.log('PR PREVIEW')
        console.log('='.repeat(60))
        console.log(`\nTitle: ${prContent.title}`)
        console.log(`\nBody:\n${prContent.body}`)
        console.log(`\n${'='.repeat(60)}`)

        // Confirm
        const confirm = await askQuestion('\nCreate this PR? (Y/n): ')
        if (confirm.toLowerCase() === 'n') {
            console.log('PR creation cancelled.')
            process.exit(0)
        }

        // Create PR
        console.log('\nCreating PR...')
        const prUrl = await createPR(prContent.title, prContent.body, baseBranch, currentBranch)
        console.log(`\nPR created: ${prUrl}`)
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`)
        process.exit(1)
    }
}

main()
