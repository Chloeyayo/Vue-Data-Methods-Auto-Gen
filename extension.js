const vscode = require("vscode");
const cheerio = require("cheerio");
const recast = require("recast");
const types = recast.types;
const parser = require("recast/parsers/babel");


function activate(context) {
  console.log('Extension "vue-data-creator" is now active!');

  const disposable = vscode.commands.registerCommand(
    "extension.createDataAndMethods",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      if (document.languageId !== "vue") {
        vscode.window.showInformationMessage("Please open a Vue file.");
        return;
      }

      const text = document.getText();
      const $ = cheerio.load(text, { xmlMode: false });

      // Remove comments
      $('*').contents().each(function() {
        if (this.type === 'comment') {
          $(this).remove();
        }
      });

      const template = $("template").html();
      const script = $("script").html();

      if (!template || !script) {
        vscode.window.showInformationMessage("Invalid Vue file format.");
        return;
      }
      
      const dataNames = extractDataNames(template);
      const vForItems = parseVFor(template);

      const existingData = extractExistingData(script);
      const dataObject = buildDataObject(dataNames, vForItems, existingData.dataKeys, existingData.computedKeys);

      const newData = generateDataString(dataObject);
      if (!newData) {
        vscode.window.showInformationMessage("No data to create.");
        return;
      }

      const newScript = insertOrUpdateData(script, existingData.dataKeys.length > 0, newData);
      const newContent = updateScriptContent(text, newScript);

      applyEdits(editor, document, newContent);
    }
  );

  context.subscriptions.push(disposable);
}

function extractDataNames(template) {
  const dataNames = new Set();
  const booleanValues = new Set(['true', 'false']);
  const commonAttributes = new Set(['class', 'title', 'value', 'disabled', 'is', 'prop', 'style', 'key']);
  const scopeVariables = new Set();
  const validIdentifier = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

  // 解析插值表达式和常规绑定
  const bindingsRegex = /(?::[\w.-]+|v-bind|v-if|v-show|v-else-if|v-model|v-loading)\s*=\s*['"]?([\w.$\s,{:}]+)['"]?|{{\s*([\w.$]+)\s*}}/g;
  const inlineStyleRegex = /:style="\{([^}]+)\}"/g;
  const scopeRegex = /(?:v-scope|slot-scope)="([\w]+)"/g;

  // 移除注释
  const cleanedTemplate = template.replace(/<!--[\s\S]*?-->/g, '');

  // 提取变量名
  const extractVariables = (regex, content) => {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const variables = match[1] || match[2];
      if (variables) {
        if (variables.includes('{')) {
          // 解析对象语法
          const objectRegex = /[\w.$]+\s*:\s*([\w.$]+)/g;
          let objMatch;
          while ((objMatch = objectRegex.exec(variables)) !== null) {
            const objVar = objMatch[1];
            if (isValidDataName(objVar)) {
              dataNames.add(objVar);
            }
          }
        } else if (isValidDataName(variables)) {
          dataNames.add(variables);
        }
      }
    }
  };

  // 检查变量名是否有效
  const isValidDataName = (name) => {
    return validIdentifier.test(name) && !name.startsWith('$') && !booleanValues.has(name) && !commonAttributes.has(name);
  };

  // 处理模板中的绑定和插值
  extractVariables(bindingsRegex, cleanedTemplate);

  // 处理内联样式中的变量
  let styleMatch;
  while ((styleMatch = inlineStyleRegex.exec(cleanedTemplate)) !== null) {
    const styleContent = styleMatch[1];
    styleContent.split(',').forEach(style => {
      const styleVariable = style.split(':')[1]?.trim().split(' ')[0];
      if (isValidDataName(styleVariable)) {
        dataNames.add(styleVariable);
      }
    });
  }

  // 处理作用域变量
  let scopeMatch;
  while ((scopeMatch = scopeRegex.exec(cleanedTemplate)) !== null) {
    scopeVariables.add(scopeMatch[1]);
  }

  // 移除作用域变量中的匹配项
  scopeVariables.forEach(scopeVar => {
    dataNames.forEach(variable => {
      if (variable.startsWith(`${scopeVar}.`)) {
        dataNames.delete(variable);
      }
    });
  });

  return dataNames;
}

function parseVFor(template) {
  const vForRegex = /v-for="\(?\s*([\w.$]+)(?:\s*,\s*([\w.$]+))?\s*\)?\s+in\s+([\w.$[\]]+)"/g;
  const vForItems = {};
  let match;

  while ((match = vForRegex.exec(template)) !== null) {
    const [item, index, list] = [match[1], match[2], match[3]];
    vForItems[list] = { item, index };
  }

  return vForItems;
}

function extractExistingData(script) {
  const ast = recast.parse(script, {
    parser: parser,
  });

  let dataKeys = [];
  let computedKeys = [];

  recast.visit(ast, {
    visitObjectMethod(path) {
      if (path.node.key.name === 'data') {
        const returnStatement = path.node.body.body.find(
          (n) => n.type === 'ReturnStatement',
        );
        if (returnStatement && returnStatement.argument && returnStatement.argument.properties) {
          dataKeys = returnStatement.argument.properties.map((prop) => prop.key.name);
        }
      }
      this.traverse(path);
    },
    visitObjectProperty(path) {
      if (path.node.key.name === 'computed') {
        if (path.node.value.type === 'ObjectExpression') {
          computedKeys = path.node.value.properties.map((prop) => prop.key.name);
        }
      }
      this.traverse(path);
    },
  });

  return {
    dataKeys,
    computedKeys,
  };
}

function buildDataObject(dataNames, vForItems, existingDataKeys, existingComputedKeys) {
  const dataObject = {};

  dataNames.forEach(name => {
    const currentName = name.split(".")[0].trim();
    if (existingDataKeys.includes(currentName) || existingComputedKeys.includes(currentName)) return; // 如果已经存在则跳过
    if (Object.entries(vForItems).find(([key, value]) => value?.index === currentName)) return; // 如果是v-for的index则跳过
    const vForParent = Object.entries(vForItems).find(([key, value]) => value?.item === currentName) 
    if (Object.keys(vForItems).includes(currentName) || Object.keys(vForItems).includes(vForParent?.[0])) return; //如果在vForItems中已经存在，则跳过 由下一步处理
    if (vForParent && (existingDataKeys.includes(vForParent[0]) || existingComputedKeys.includes(vForParent[0]))) return; // 如果是v-for的item则跳过

    const parts = name.trim().split(".");
    let currentLevel = dataObject;

    parts.forEach((part, index) => {
      if (!currentLevel[part]) {
        currentLevel[part] = (index === parts.length - 1) ? null : {};
      }
      currentLevel = currentLevel[part];
    });
  });

  Object.keys(vForItems).forEach(list => {
    // if (!existingDataKeys.includes(list.split('.')?.[0] && !existingComputedKeys.includes(list.split('.')?.[0]))) 
      if(existingDataKeys.includes(list.split('.')[0])) return;
      if(existingComputedKeys.includes(list.split('.')[0])) return;

      const item = vForItems[list]?.item;
      const parentPath = list.split(".");
      let parent = dataObject;

      parentPath.forEach((segment, index) => {
        if (!parent[segment]) {
          parent[segment] = {};
        }
        if (index === parentPath.length - 1) {
          parent[segment] = [createEmptyObjectFromKeys(item, dataObject)];
        } else {
          parent = parent[segment];
        }
      });
    
  });

  return dataObject;
}

function createEmptyObjectFromKeys(item, dataObject) {
  const result = {};
  Object.keys(dataObject).forEach(key => {
    if (typeof dataObject[key] === "object" && key === item) {
      Object.assign(result, dataObject[key]);
      delete dataObject[key];
    }
  });

  if (Object.keys(result).length === 0) {
    result[item] = null;
  }

  return result;
}

function generateDataString(obj, indent = "      ") {
  return Object.entries(obj)
    .map(([key, value]) => {
      if (value === null) {
        return `${indent}${key}: null`;
      } else if (Array.isArray(value)) {
        const arrayContent = value.map(item => `${indent + "  "}{\n${generateDataString(item, indent + "    ")}\n${indent + "  "}}`).join(",\n");
        return `${indent}${key}: [\n${arrayContent}\n${indent}]`;
      } else if (typeof value === "object") {
        return `${indent}${key}: {\n${generateDataString(value, indent + "  ")}\n${indent}}`;
      }
    })
    .join(",\n");
}

function insertOrUpdateData(script, hasExistingData, newData) {
  const ast = recast.parse(script, {
    parser: parser,
  });

  let dataUpdated = false;

  recast.visit(ast, {
    visitObjectMethod(path) {
      if (path.node.key.name === "data") {
        const returnStatement = path.node.body.body.find(n => n.type === "ReturnStatement");
        if (returnStatement && returnStatement.argument && returnStatement.argument.properties) {
          const newPropertiesAst = recast.parse(`({${newData}})`, {
            parser: parser,
          });

          const newProperties = newPropertiesAst.program.body[0].expression.properties;

          // 插入新属性时保留原有的标点符号
          newProperties.forEach(prop => {
            returnStatement.argument.properties.push(prop);
          });

          dataUpdated = true;
        }
      }
      this.traverse(path);
    }
  });

  if (!dataUpdated) {
    const newDataMethod = createDataMethod(newData);
    addDataMethodToExport(ast, newDataMethod);
  }

  // Preprocess: Remove extra blank lines
  const preprocessScript = script.replace(/\n\s*\n/g, '\n');

  const output = recast.print(ast, {
    quote: 'single',
    trailingComma: true,
    lineTerminator: '\n',
    tabWidth: 2,
  }).code;

  // Postprocess: Remove extra blank lines
  const postprocessOutput = output.replace(/\n\s*\n/g, '\n');

  return postprocessOutput;
}

function createDataMethod(newData) {
  const newDataAst = recast.parse(`export default {
    data() {
      return {
        ${newData}
      };
    },
  };`, {
    parser: parser,
  });

  return newDataAst.program.body[0].declaration.properties[0];
}

function addDataMethodToExport(ast, newDataMethod) {
  recast.visit(ast, {
    visitExportDefaultDeclaration(path) {
      path.node.declaration.properties.unshift(newDataMethod);
      this.traverse(path);
    }
  });
}

function updateScriptContent(text, newScript) {
  return text.replace(/<script[^>]*>[\s\S]*<\/script>/, `<script>\n${newScript.trim()}\n</script>`);
}

function applyEdits(editor, document, newContent) {
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
  editor.edit(editBuilder => editBuilder.replace(fullRange, newContent))
    .then(success => {
      if (success) {
        vscode.window.showInformationMessage("Data created successfully.");
      } else {
        vscode.window.showErrorMessage("Failed to edit the document.");
      }
    })
    .catch(err => {
      vscode.window.showErrorMessage("Error: " + err);
    });
}

exports.activate = activate;

function deactivate() {}

exports.deactivate = deactivate;