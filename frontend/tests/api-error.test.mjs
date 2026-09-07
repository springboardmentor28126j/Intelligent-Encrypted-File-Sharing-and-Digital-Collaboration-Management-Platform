import assert from 'node:assert/strict'
import test from 'node:test'
import { FILE_INTEGRITY_ERROR, getErrorMessage } from '../src/services/api.js'

test('maps encrypted file integrity API errors to the safe user message', () => {
  const error = { response: { status: 422, data: new Blob(['internal error']) } }
  assert.equal(getErrorMessage(error), FILE_INTEGRITY_ERROR)
})

test('preserves normal API detail messages', () => {
  const error = { response: { status: 404, data: { detail: 'File not found' } } }
  assert.equal(getErrorMessage(error), 'File not found')
})
