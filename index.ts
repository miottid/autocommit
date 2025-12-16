#!/usr/bin/env bun

import Anthropic from '@anthropic-ai/sdk'

async function getStagedDiff(): Promise<string> {
    const proc = Bun.spawn(['git', 'diff', '--staged'], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    await proc.exited

    if (proc.exitCode !== 0) {
        throw new Error(`git diff failed: ${stderr}`)
    }

    return stdout
}

async function getStagedFiles(): Promise<string[]> {
    const proc = Bun.spawn(['git', 'diff', '--staged', '--name-only'], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    return stdout.trim().split('\n').filter(Boolean)
}

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

async function gitCommit(message: string): Promise<void> {
    const proc = Bun.spawn(['git', 'commit', '-m', message], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    await proc.exited

    if (proc.exitCode !== 0) {
        throw new Error(`git commit failed: ${stderr}`)
    }

    console.log(stdout)
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
        await gitCommit(commitMessage)
        console.log('\nCommit successful!')
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`)
        process.exit(1)
    }
}

main()
