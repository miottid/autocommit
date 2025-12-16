export class UserError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UserError'
    }
}

export class GitError extends Error {
    constructor(
        message: string,
        public readonly command: string,
        public readonly stderr: string,
    ) {
        super(message)
        this.name = 'GitError'
    }
}

export class ApiError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ApiError'
    }
}

export function handleError(error: unknown): never {
    if (error instanceof UserError) {
        console.error(error.message)
        process.exit(1)
    }

    if (error instanceof GitError) {
        console.error(`Git error: ${error.message}`)
        if (error.stderr) {
            console.error(`Details: ${error.stderr}`)
        }
        process.exit(1)
    }

    if (error instanceof ApiError) {
        console.error(`API error: ${error.message}`)
        process.exit(1)
    }

    console.error(`Unexpected error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
}
