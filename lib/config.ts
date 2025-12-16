export const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export function getModel(): string {
    return process.env.AUTOCOMMIT_MODEL || DEFAULT_MODEL
}
