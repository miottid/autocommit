export async function runGit(args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    await proc.exited

    if (proc.exitCode !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${stderr}`)
    }

    return stdout.trim()
}

export async function runGh(args: string[]): Promise<string> {
    const proc = Bun.spawn(['gh', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    await proc.exited

    if (proc.exitCode !== 0) {
        throw new Error(`gh ${args.join(' ')} failed: ${stderr}`)
    }

    return stdout.trim()
}

export async function getCurrentBranch(): Promise<string> {
    return runGit(['branch', '--show-current'])
}

export async function getDefaultBranch(): Promise<string> {
    try {
        const remote = await runGit(['remote', 'show', 'origin'])
        const match = remote?.match(/HEAD branch: (.+)/)
        if (match?.[1]) {
            return match[1].trim()
        }
        return 'main'
    } catch {
        return 'main'
    }
}

export async function getStagedDiff(): Promise<string> {
    return runGit(['diff', '--staged'])
}

export async function getStagedFiles(): Promise<string[]> {
    const output = await runGit(['diff', '--staged', '--name-only'])
    return output.split('\n').filter(Boolean)
}

export async function gitCommit(message: string): Promise<string> {
    return runGit(['commit', '-m', message])
}

export async function remoteBranchExists(): Promise<boolean> {
    try {
        const branch = await getCurrentBranch()
        await runGit(['ls-remote', '--exit-code', '--heads', 'origin', branch])
        return true
    } catch {
        return false
    }
}

export async function checkUnpushedCommits(): Promise<boolean> {
    try {
        const status = await runGit(['status', '-sb'])
        return status.includes('ahead')
    } catch {
        return false
    }
}

export async function pushBranch(): Promise<void> {
    const branch = await getCurrentBranch()
    console.log(`Pushing branch ${branch}...`)
    await runGit(['push', '-u', 'origin', branch])
}

export async function getCommits(baseBranch: string): Promise<string> {
    try {
        return await runGit(['log', `${baseBranch}..HEAD`, '--pretty=format:%s%n%b', '--reverse'])
    } catch {
        return await runGit(['log', '-10', '--pretty=format:%s%n%b', '--reverse'])
    }
}

export async function getDiff(baseBranch: string): Promise<string> {
    try {
        return await runGit(['diff', `${baseBranch}...HEAD`])
    } catch {
        return await runGit(['diff', 'HEAD~5', 'HEAD'])
    }
}

export async function getChangedFiles(baseBranch: string): Promise<string[]> {
    try {
        const output = await runGit(['diff', '--name-only', `${baseBranch}...HEAD`])
        return output.split('\n').filter(Boolean)
    } catch {
        const output = await runGit(['diff', '--name-only', 'HEAD~5', 'HEAD'])
        return output.split('\n').filter(Boolean)
    }
}

export async function getExistingPR(): Promise<string | null> {
    try {
        const prUrl = await runGh(['pr', 'view', '--json', 'url', '--jq', '.url'])
        return prUrl || null
    } catch {
        return null
    }
}

export async function createPR(
    title: string,
    body: string,
    baseBranch: string,
    headBranch: string,
): Promise<string> {
    return await runGh([
        'pr',
        'create',
        '--title',
        title,
        '--body',
        body,
        '--base',
        baseBranch,
        '--head',
        headBranch,
    ])
}
