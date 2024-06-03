function extractBlock(str, keyword) {
  const startPattern = keyword === 'export default' ? 'export default {' : `${keyword}: {`
  const blockStart = keyword === 'data' ? str.search(/data\s*\(\s*\)\s*{/) : str.indexOf(startPattern)

  if (blockStart === -1) return null

  let braceCount = 0,
    inString = false,
    stringChar = '',
    escape = false

  for (let i = blockStart; i < str.length; i++) {
    const char = str[i]

    if (inString) {
      escape = char === '\\' ? !escape : false
      inString = !escape && char === stringChar ? false : inString
    } else {
      if (char === '"' || char === "'" || char === '`') {
        inString = true
        stringChar = char
      } else if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) return str.slice(blockStart, i + 1)
      }
    }
  }

  return null
}

function extractContent(block, keyword) {
  if (!block) return null

  const start = block.indexOf('{')
  const end = block.lastIndexOf('}')

  if (start === -1 || end === -1 || start >= end) return null

  const content = block.slice(start + 1, end)

  if (keyword === 'data') {
    const returnStart = content.indexOf('return {')
    if (returnStart === -1) return { functionBody: content.trim() ? content.trimEnd() : '', returnObject: '' }

    const functionBody = content.slice(0, returnStart)?.trim() ? content.slice(0, returnStart)?.trimEnd() : ''
    const returnObjectStart = content.indexOf('{', returnStart) + 1 // Skip the opening brace
    const returnObjectEnd = content.lastIndexOf('}') // Skip the closing brace
    if (returnObjectStart === -1 || returnObjectEnd === -1) return null

    const returnObject = content.slice(returnObjectStart, returnObjectEnd) || ''

    return { functionBody, returnObject }
  }

  return content
}

function removeComments($) {
  $('*')
    .contents()
    .each(function () {
      if (this.type === 'comment') {
        $(this).remove()
      }
    })
}

function ensureTrailingComma(str) {
  // 使用正则表达式去除末尾的空白字符和换行符
  const trimmedStr = str.replace(/\s+$/, '')
  if (!trimmedStr) return str

  // 确保字符串以逗号结尾
  let resultStr = trimmedStr.endsWith(',') ? trimmedStr : trimmedStr + ','

  // 还原末尾的空白字符和换行符
  resultStr = resultStr + str.match(/\s+$/)[0]
  return resultStr
}

function insertOrUpdateBlock(script, blockName, newContent) {
  const block = extractBlock(script, blockName)

  if (block) {
    const blockContent = extractContent(block, blockName)
    let existingContent

    if (blockName === 'data') {
      const { functionBody, returnObject } = blockContent
      existingContent = ensureTrailingComma(returnObject).trimEnd()
      newContent = `${existingContent}\n${newContent
        .split('\n')
        .map(line => `      ${line}`)
        .join('\n')}`
      newContent = `data() {${functionBody}\n    return {${newContent}\n    };\n  }`
    } else {
      existingContent = ensureTrailingComma(blockContent).trimEnd()
      newContent = `${existingContent}\n${newContent
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n')}`
      newContent = `${blockName}: {${newContent}\n  }`
    }

    return script.replace(block, newContent)
  } else {
    let newBlock

    if (blockName === 'data') {
      newBlock = `data() {\n    return {\n${newContent
        .split('\n')
        .map(line => `      ${line}`)
        .join('\n')},\n    };\n  }`
    } else {
      newBlock = `${blockName}: {\n${newContent
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n')}\n  },`
    }

    const exportBlock = extractBlock(script, 'export default')
    if (!exportBlock) return `${script}\nexport default {\n  ${newBlock}\n};`

    let existingExportContent = ensureTrailingComma(extractContent(exportBlock, 'export default')).trimEnd()
    const updatedExportContent = `${existingExportContent}\n  ${newBlock}`

    const newExportDefault = `export default {${updatedExportContent}\n}`
    return script.replace(exportBlock, newExportDefault)
  }
}

// 用于插入或更新 `data` 块
function insertOrUpdateData(script, newData) {
  return insertOrUpdateBlock(script, 'data', newData)
}

// 用于插入或更新 `methods` 块
function insertOrUpdateMethods(script, newMethods) {
  return insertOrUpdateBlock(script, 'methods', newMethods)
}

function colorize(text, color) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
  };
  return `${colors[color]}${text}${colors.reset}`;
}

module.exports = {
  extractBlock,
  extractContent,
  removeComments,
  ensureTrailingComma,
  insertOrUpdateData,
  insertOrUpdateMethods,
  colorize
}
