import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { DEFAULT_MODEL, getModel } from './config'

describe('config', () => {
    const originalEnv = process.env.AUTOCOMMIT_MODEL

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.AUTOCOMMIT_MODEL
        } else {
            process.env.AUTOCOMMIT_MODEL = originalEnv
        }
    })

    test('getModel returns default model when env var not set', () => {
        delete process.env.AUTOCOMMIT_MODEL
        expect(getModel()).toBe(DEFAULT_MODEL)
    })

    test('getModel returns env var value when set', () => {
        process.env.AUTOCOMMIT_MODEL = 'claude-3-haiku-20240307'
        expect(getModel()).toBe('claude-3-haiku-20240307')
    })

    test('DEFAULT_MODEL is a valid model string', () => {
        expect(DEFAULT_MODEL).toMatch(/^claude-/)
    })
})
