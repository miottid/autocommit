import { GitError } from './errors'

// Lock files to exclude from diffs and file lists
const EXCLUDED_LOCK_FILES = [
    'package-lock.json',
    'bun.lock',
    'bun.lockb',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Gemfile.lock',
    'Cargo.lock',
    'poetry.lock',
    'composer.lock',
    'go.sum',
    'Pipfile.lock',
    'npm-shrinkwrap.json',
    'deno.lock',
    'flake.lock',
    'pdm.lock',
    'uv.lock',
]

// Generate git pathspec exclusions for lock files
function getLockFileExclusions(): string[] {
    return EXCLUDED_LOCK_FILES.map((file) => `:!${file}`)
}

// Filter out lock files from a list of file paths
function filterLockFiles(files: string[]): string[] {
    return files.filter((file) => {
        const basename = file.split('/').pop() || file
        return !EXCLUDED_LOCK_FILES.includes(basename)
    })
}

export async function runGit(args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    await proc.exited

    if (proc.exitCode !== 0) {
        const command = `git ${args.join(' ')}`
        throw new GitError(`Command failed: ${command}`, command, stderr.trim())
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
        const command = `gh ${args.join(' ')}`
        throw new GitError(`Command failed: ${command}`, command, stderr.trim())
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
    return runGit(['diff', '--staged', '--', '.', ...getLockFileExclusions()])
}

export async function getStagedFiles(): Promise<string[]> {
    const output = await runGit(['diff', '--staged', '--name-only'])
    const files = output.split('\n').filter(Boolean)
    return filterLockFiles(files)
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
        return await runGit(['diff', `${baseBranch}...HEAD`, '--', '.', ...getLockFileExclusions()])
    } catch {
        return await runGit(['diff', 'HEAD~5', 'HEAD', '--', '.', ...getLockFileExclusions()])
    }
}

export async function getChangedFiles(baseBranch: string): Promise<string[]> {
    try {
        const output = await runGit(['diff', '--name-only', `${baseBranch}...HEAD`])
        const files = output.split('\n').filter(Boolean)
        return filterLockFiles(files)
    } catch {
        const output = await runGit(['diff', '--name-only', 'HEAD~5', 'HEAD'])
        const files = output.split('\n').filter(Boolean)
        return filterLockFiles(files)
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
