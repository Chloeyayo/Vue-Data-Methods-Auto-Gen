const recast = require('recast')
const types = recast.types
const parser = require('recast/parsers/babel')
const { extractBlock, extractContent, ensureTrailingComma } = require('./utils')

function extractMethods(template) {
  const methodNames = new Set()
  const eventBindingRegex = /@([\w-]+(?:\.\w+)*)="((?!\$)[\w.$]+(?:\([^)]*\))?)"/g
  const vOnBindingRegex = /v-on:([\w-]+(?:\.\w+)*)="((?!\$)[\w.$]+(?:\([^)]*\))?)"/g
  const dynamicEventBindingRegex = /v-on:\[([\w.$]+)\]="((?!\$)[\w.$]+(?:\([^)]*\))?)"/g

  // 移除注释
  const cleanedTemplate = template.replace(/<!--[\s\S]*?-->/g, '')

  const extractMethodNames = regex => {
    let match
    while ((match = regex.exec(cleanedTemplate)) !== null) {
      const methodName = match[2]
      if (methodName) {
        methodNames.add(methodName)
      }
    }
  }

  // 提取事件绑定方法名
  extractMethodNames(eventBindingRegex)
  extractMethodNames(vOnBindingRegex)
  extractMethodNames(dynamicEventBindingRegex)

  return methodNames
}

function extractScriptContent(vueComponent) {
  const scriptMatch = vueComponent.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return scriptMatch ? scriptMatch[1] : ''
}

function buildMethodsObject(methodNames, existingKeys) {
  const methodsObject = {}

  methodNames.forEach((name, index) => {
    // 提取方法名和参数
    const methodName = name.split('(')[0]
    if (methodsObject.hasOwnProperty(methodName)) return // 如果已经存在则跳过

    const args = name.includes('(') ? name.slice(name.indexOf('(') + 1, -1) : ''

    // 生成新的参数列表
    const argList = args
      ? args
          .split(',')
          .map((_, idx) => `arg${idx + 1}`)
          .join(', ')
      : ''
    const formattedArgs = `(${argList})`

    // 确保方法名不包含现有方法键
    if (!existingKeys.includes(methodName)) {
      methodsObject[methodName] = `${formattedArgs} {}`
    }
  })

  return methodsObject
}

function generateMethodsString(obj, indent = '') {
  return Object.entries(obj)
    .map(([key, value]) => `${indent}${key}${value}`)
    .join(',\n')
}

module.exports = {
  extractMethods,
  extractScriptContent,
  buildMethodsObject,
  generateMethodsString
}
