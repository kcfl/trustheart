import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      getAllSourceFiles(fullPath, fileList)
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') ||
        entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.js') ||
        entry.name.endsWith('.jsx'))
    ) {
      fileList.push(fullPath)
    }
  }
  return fileList
}

describe('Privacy and Zero-Client-Persistence Guard', () => {
  it('ensures no occurrence of localStorage, sessionStorage, indexedDB, or document.cookie exists in src/', () => {
    const srcDir = path.resolve(__dirname, '../src')
    const files = getAllSourceFiles(srcDir)
    expect(files.length).toBeGreaterThan(0)

    // Regex forbidden storage pattern
    const forbiddenPattern = /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/

    const violations: { file: string; line: number; match: string }[] = []

    for (const file of files) {
      // Exclude this test file itself from flagging its own pattern
      if (file.endsWith('noStorage.test.ts')) {
        continue
      }

      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, index) => {
        const match = line.match(forbiddenPattern)
        if (match) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            match: match[0],
          })
        }
      })
    }

    expect(
      violations,
      `Forbidden client storage APIs found in src/: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([])
  })
})
