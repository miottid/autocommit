import { describe, expect, test } from 'bun:test'
import { ApiError, GitError, UserError } from './errors'

describe('errors', () => {
    describe('UserError', () => {
        test('creates error with correct name', () => {
            const error = new UserError('test message')
            expect(error.name).toBe('UserError')
            expect(error.message).toBe('test message')
        })

        test('is instanceof Error', () => {
            const error = new UserError('test')
            expect(error instanceof Error).toBe(true)
            expect(error instanceof UserError).toBe(true)
        })
    })

    describe('GitError', () => {
        test('creates error with command and stderr', () => {
            const error = new GitError('command failed', 'git status', 'fatal: not a git repo')
            expect(error.name).toBe('GitError')
            expect(error.message).toBe('command failed')
            expect(error.command).toBe('git status')
            expect(error.stderr).toBe('fatal: not a git repo')
        })

        test('is instanceof Error', () => {
            const error = new GitError('test', 'cmd', 'stderr')
            expect(error instanceof Error).toBe(true)
            expect(error instanceof GitError).toBe(true)
        })
    })

    describe('ApiError', () => {
        test('creates error with correct name', () => {
            const error = new ApiError('api failed')
            expect(error.name).toBe('ApiError')
            expect(error.message).toBe('api failed')
        })

        test('is instanceof Error', () => {
            const error = new ApiError('test')
            expect(error instanceof Error).toBe(true)
            expect(error instanceof ApiError).toBe(true)
        })
    })
})
