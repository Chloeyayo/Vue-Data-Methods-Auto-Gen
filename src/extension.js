const vscode = require('vscode')
const cheerio = require('cheerio')
const recast = require('recast')
const types = recast.types
const parser = require('recast/parsers/babel')
const he = require('he');
const { extractMethods, buildMethodsObject, generateMethodsString } = require('./methodsGen')
const { extractBlock, extractContent, ensureTrailingComma, insertOrUpdateData, insertOrUpdateMethods, removeComments } = require('./utils')
let outputChannel;

  function activate(context) {
    console.log('Extension "Vue Data Methods Auto Gen" is now active!');
  
    // 创建输出通道
    outputChannel = vscode.window.createOutputChannel('Vue Data Methods Auto Gen');
    outputChannel.appendLine('Extension "Vue Data Methods Auto Gen!" is now active!');
  
    try {
      const generateDataCommand = vscode.commands.registerCommand('extension.generateMissingData', () => generateMissing('data'));
      const generateMethodsCommand = vscode.commands.registerCommand('extension.generateMissingMethods', () => generateMissing('methods'));
      const generateDataAndMethodsCommand = vscode.commands.registerCommand('extension.generateMissingDataAndMethods', () => generateMissing('both'));
  
      context.subscriptions.push(generateDataCommand, generateMethodsCommand, generateDataAndMethodsCommand);
      
      outputChannel.appendLine('Commands registered successfully.');
    } catch (error) {
      outputChannel.appendLine(`Error registering commands: ${error.message}`);
    }
  }

function generateMissing(type) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  if (document.languageId !== 'vue') {
    vscode.window.showInformationMessage('Please open a Vue file.');
    return;
  }

  try {
    const { template, script } = getTemplateAndScript(document);
    let newScript = script;

    if (type === 'data' || type === 'both') {
      const dataNames = extractDataNames(template);
      const { vForItems, vForItemsItemList } = parseVFor(template);
      const existingKeys = extractExistingKeys(script);
      const dataObject = buildDataObject(dataNames, vForItems, existingKeys, vForItemsItemList);
      const newData = generateDataString(dataObject);

      if (newData) {
        newScript = insertOrUpdateData(newScript, newData);
        outputChannel.appendLine(`Data generated: ${Object.keys(dataObject).join(', ')}`);
      } else if (type === 'data') {
        vscode.window.showInformationMessage('No data to create.');
      }
    }

    if (type === 'methods' || type === 'both') {
      const methodNames = extractMethods(template);
      const methodsObject = buildMethodsObject(methodNames, extractExistingKeys(script));
      const newMethods = generateMethodsString(methodsObject);

      if (newMethods) {
        newScript = insertOrUpdateMethods(newScript, newMethods);
        outputChannel.appendLine(`Methods generated: ${Object.keys(methodsObject).join(', ')}`);
      } else if (type === 'methods') {
        vscode.window.showInformationMessage('No methods to create.');
      }
    }

    if (newScript !== script) {
      applyEdits(editor, document, newScript);
      outputChannel.appendLine('Script updated successfully.');
    } else if (type === 'both') {
      vscode.window.showInformationMessage('No data or methods to create.');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`);
    outputChannel.appendLine(`Error: ${error.message}`);
  }
}

function getTemplateAndScript(document) {
  const text = document.getText()
  const $ = cheerio.load(text, { xmlMode: true })
  console.log(123)

  removeComments($)

  const template = he.decode($('template').html())
  const script = he.decode($('script').html())

  if (!template || !script) {
    throw new Error('Invalid Vue file format.')
  }

  return { template, script }
}

function extractDataNames(template) {
  const dataNames = new Set()
  const booleanValues = new Set(['true', 'false'])
  const commonAttributes = new Set(['class', 'value', 'prop', 'style', 'key','Object','Array','length'])
  const scopeVariables = new Set()
  const validIdentifier = /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/

  // 解析插值表达式和常规绑定
  const bindingsRegex =
    /v-on:\[([^\]]+)\]\s*=\s*['"]?([^'"]+)['"]?|(?<!v-on)(?::[\w.-]+|v-bind|v-if|v-show|v-else-if|v-model|v-loading)\s*=\s*['"]?([^'"]+)['"]?|{{\s*([^}]+)\s*}}/g

  const inlineStyleRegex = /:style="\{([^}]+)\}"/g
  const scopeRegex = /(?:v-scope|slot-scope)="([\w]+)"/g

  // 移除注释
  const cleanedTemplate = template.replace(/<!--[\s\S]*?-->/g, '')

  // 提取变量名
  const extractVariables = (regex, content) => {
    let match
    while ((match = regex.exec(content)) !== null) {
      const variables = match[1] || match[2] || match[3] || match[4]
      if (variables) {
        if (variables.includes('{')) {
          // 解析对象语法
          const objectRegex = /[\w.$]+\s*:\s*([\w.$]+)/g
          let objMatch
          while ((objMatch = objectRegex.exec(variables)) !== null) {
            const objVar = objMatch[1]
            if (isValidDataName(objVar)) {
              dataNames.add(objVar)
            }
          }
        } else if (isValidDataName(variables)) {
          dataNames.add(variables)
        }
      }
    }
  }

  // 检查变量名是否有效
  const isValidDataName = name => {
    name = name.trim().split('.')
    return name.every(part => validIdentifier.test(part) && !booleanValues.has(part) && !commonAttributes.has(part))
  }

  // 处理模板中的绑定和插值
  extractVariables(bindingsRegex, cleanedTemplate)

  // 处理内联样式中的变量
  let styleMatch
  while ((styleMatch = inlineStyleRegex.exec(cleanedTemplate)) !== null) {
    const styleContent = styleMatch[1]
    styleContent.split(',').forEach(style => {
      const styleVariable = style.split(':')[1]?.trim().split(' ')[0]
      if (isValidDataName(styleVariable)) {
        dataNames.add(styleVariable)
      }
    })
  }

  // 处理作用域变量
  let scopeMatch
  while ((scopeMatch = scopeRegex.exec(cleanedTemplate)) !== null) {
    scopeVariables.add(scopeMatch[1])
  }

  // 移除作用域变量中的匹配项
  scopeVariables.forEach(scopeVar => {
    dataNames.forEach(variable => {
      if (variable.startsWith(`${scopeVar}.`)) {
        dataNames.delete(variable)
      }
    })
  })

  return dataNames
}

function parseVFor(template) {
  const vForRegex = /v-for="\(?\s*([\w.$]+)(?:\s*,\s*([\w.$]+))?\s*\)?\s+in\s+(\[.*?\]|\w[\w.$]*)"/g
  const validIdentifier = /^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/
  const vForItems = {}
  const vForItemsItemList = new Set()
  let match

  while ((match = vForRegex.exec(template)) !== null) {
    const [item, index, list] = [match[1], match[2], match[3]]
    vForItemsItemList.add(item)
    vForItemsItemList.add(index)
    if ([match[1], match[2], match[3]].some(part => !validIdentifier.test(part))) continue // 跳过无效的标识符
    vForItems[list] = { item, index }
  }

  return { vForItems, vForItemsItemList }
}

function extractExistingKeys(script) {
  try {
    const ast = recast.parse(script, {
      parser: parser
    })

    let dataKeys = []
    let computedKeys = []
    let propsKeys = []
    let methodsKeys = []

    recast.visit(ast, {
      visitObjectMethod(path) {
        if (path.node.key.name === 'data') {
          const returnStatement = path.node.body.body.find(n => n.type === 'ReturnStatement')
          if (returnStatement && returnStatement.argument && returnStatement.argument.properties) {
            dataKeys = returnStatement.argument.properties.map(prop => prop.key.name)
          }
        }
        this.traverse(path)
      },
      visitObjectProperty(path) {
        if (path.node.key.name === 'computed') {
          if (path.node.value.type === 'ObjectExpression') {
            computedKeys = path.node.value.properties.map(prop => prop.key.name)
          }
        } else if (path.node.key.name === 'props') {
          if (path.node.value.type === 'ObjectExpression') {
            propsKeys = path.node.value.properties.map(prop => prop.key.name)
          } else if (path.node.value.type === 'ArrayExpression') {
            propsKeys = path.node.value.elements.map(element => element.value)
          }
        } else if (path.node.key.name === 'methods') {
          if (path.node.value.type === 'ObjectExpression') {
            methodsKeys = methodsKeys.concat(path.node.value.properties.map(prop => prop.key.name))
          }
          return false // Prevent further traversal within the methods object
        }
        this.traverse(path)
      }
    })

    return [...new Set([...dataKeys, ...computedKeys, ...propsKeys, ...methodsKeys])]
  } catch (error) {
    throw new Error(`Failed to parse the script content.
    Details: ${error.message}`)
  }
}

function buildDataObject(dataNames, vForItems, existingKeys, vForItemsItemList) {
  const dataObject = {}

  dataNames.forEach(name => {
    const currentName = name.split('.')[0].trim()
    if (existingKeys.includes(currentName)) return // 如果已经存在则跳过

    // const vForParent = Object.entries(vForItems).find(([key, value]) => value?.item === currentName)
    // const parent = vForParent?.[0].split('.')[0]

    // const arrayRegex = /^\[.*\]$/
    // if (arrayRegex.test(parent)) return // 如果parent是数组的则跳过

    // // if (existingKeys.includes(parent)) return // 如果是vForItems中的某个key的item key已经存在则跳过

    // if (vForItemsItemList.has(currentName) ) return // 如果是vForItems中的某个key 且parent不存在则跳过 用于处理非法的vForItems

    // if (Object.entries(vForItems).find(([key, value]) => value?.index === currentName)) return // 如果是v-for的index则跳过

    if (Object.keys(vForItems).includes(currentName)) return //如果是vForItems中的某个key，则跳过 由下一步处理

    if (vForItemsItemList.has(currentName)) return // 如果是vForItems中的某个item或index则跳过

    const parts = name.trim().split('.')
    let currentLevel = dataObject

    parts.forEach((part, index) => {
      if (!currentLevel[part]) {
        currentLevel[part] = index === parts.length - 1 ? null : {}
      }
      currentLevel = currentLevel[part]
    })
  })

  Object.keys(vForItems).forEach(list => {
    // 处理[a,b]的情况
    const arrayRegex = /^\[.*\]$/
    if (arrayRegex.test(list)) return
    if (existingKeys.includes(list.split('.')?.[0])) return

    const item = vForItems[list]?.item
    const parentPath = list.split('.')
    let parent = dataObject

    parentPath.forEach((segment, index) => {
      if (!parent[segment]) {
        parent[segment] = {}
      }
      if (index === parentPath.length - 1) {
        parent[segment] = [createEmptyObjectFromKeys(item, dataObject)]
      } else {
        parent = parent[segment]
      }
    })
  })

  return dataObject
}

function createEmptyObjectFromKeys(item, dataObject) {
  const result = {}
  Object.keys(dataObject).forEach(key => {
    if (typeof dataObject[key] === 'object' && key === item) {
      Object.assign(result, dataObject[key])
      delete dataObject[key]
    }
  })

  if (Object.keys(result).length === 0) {
    result[item] = null
  }

  return result
}

function generateDataString(obj, indent = '') {
  return Object.entries(obj)
    .map(([key, value]) => {
      if (value === null) {
        return `${indent}${key}: null`
      } else if (Array.isArray(value)) {
        const arrayContent = value.map(item => `${indent}  {\n${generateDataString(item, `${indent}    `)}\n${indent}  }`).join(',\n')
        return `${indent}${key}: []`
        // return `${indent}${key}: [\n${arrayContent}\n${indent}]`
      } else if (typeof value === 'object') {
        return `${indent}${key}: {\n${generateDataString(value, `${indent}  `)}\n${indent}}`
      }
    })
    .join(',\n')
}

function applyEdits(editor, document, newScript) {
  const documentText = document.getText()

  // 使用正则表达式查找所有 <script> 标签
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let match

  // 我们假设要替换第一个 <script> 标签的内容
  if ((match = scriptRegex.exec(documentText)) !== null) {
    const scriptStart = match.index
    const scriptEnd = scriptStart + match[0].length

    const start = document.positionAt(scriptStart)
    const end = document.positionAt(scriptEnd)

    const range = new vscode.Range(start, end)

    // 创建新的 <script> 标签内容
    const newScriptTag = `<script>\n${newScript.trim()}\n</script>`

    editor
      .edit(editBuilder => editBuilder.replace(range, newScriptTag))
      .then(success => {
        if (success) {
          vscode.window.showInformationMessage('Script updated successfully.')
        } else {
          vscode.window.showErrorMessage('Failed to edit the document.')
        }
      })
      .catch(err => {
        vscode.window.showErrorMessage('Error: ' + err)
      })
  } else {
    vscode.window.showErrorMessage('No <script> tag found in the document.')
  }
}

exports.activate = activate

function deactivate() {}

exports.deactivate = deactivate
