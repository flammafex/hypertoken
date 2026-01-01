/**
 * DSL Parser
 *
 * Parses human-readable DSL text into rule JSON definitions.
 *
 * Syntax:
 *   RULE "name"
 *     WHEN <conditions>
 *     THEN <actions>
 *     [PRIORITY <number>]
 *     [ONCE]
 */

/**
 * DSLParser class
 */
export class DSLParser {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Parse DSL text into array of rule definitions
   * @param {string} text - DSL source code
   * @returns {{ rules: Array, errors: Array, warnings: Array }}
   */
  parse(text) {
    this.errors = [];
    this.warnings = [];
    const rules = [];

    if (!text || !text.trim()) {
      return { rules, errors: this.errors, warnings: this.warnings };
    }

    // Remove comments and normalize whitespace
    const lines = this.preprocessLines(text);

    // Split into rule blocks
    const blocks = this.splitIntoBlocks(lines);

    // Parse each block
    for (const block of blocks) {
      try {
        const rule = this.parseRuleBlock(block);
        if (rule) rules.push(rule);
      } catch (e) {
        this.errors.push({
          line: block.startLine,
          message: e.message
        });
      }
    }

    return { rules, errors: this.errors, warnings: this.warnings };
  }

  /**
   * Preprocess lines: remove comments, track line numbers
   */
  preprocessLines(text) {
    return text.split('\n').map((line, index) => ({
      text: line.replace(/--.*$/, '').trimEnd(), // Remove comments, keep leading whitespace
      lineNumber: index + 1,
      original: line
    }));
  }

  /**
   * Split lines into rule blocks
   */
  splitIntoBlocks(lines) {
    const blocks = [];
    let currentBlock = null;

    for (const line of lines) {
      const trimmed = line.text.trim();
      if (!trimmed) continue;

      if (trimmed.toUpperCase().startsWith('RULE ')) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          startLine: line.lineNumber,
          lines: [line]
        };
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      } else {
        // Text before first RULE - ignore or warn
        this.warnings.push({
          line: line.lineNumber,
          message: `Unexpected text before RULE declaration: "${trimmed}"`
        });
      }
    }

    if (currentBlock) blocks.push(currentBlock);
    return blocks;
  }

  /**
   * Parse a single rule block
   */
  parseRuleBlock(block) {
    const rule = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      enabled: true,
      conditions: [],
      conditionLogic: 'AND',
      actions: [],
      priority: 50,
      once: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    let state = 'start'; // start, when, then, options
    let conditionBuffer = [];
    let actionBuffer = [];
    let hasOr = false;

    for (const line of block.lines) {
      const trimmed = line.text.trim();
      const upper = trimmed.toUpperCase();

      if (upper.startsWith('RULE ')) {
        rule.name = this.parseRuleName(trimmed, line.lineNumber);
        state = 'start';
      } else if (upper.startsWith('WHEN ')) {
        state = 'when';
        conditionBuffer.push({
          text: trimmed.substring(5).trim(),
          line: line.lineNumber,
          prefix: null
        });
      } else if (upper.startsWith('AND ')) {
        if (state === 'when') {
          conditionBuffer.push({
            text: trimmed.substring(4).trim(),
            line: line.lineNumber,
            prefix: 'AND'
          });
        } else {
          this.warnings.push({
            line: line.lineNumber,
            message: 'AND outside of WHEN block'
          });
        }
      } else if (upper.startsWith('OR ')) {
        if (state === 'when') {
          hasOr = true;
          conditionBuffer.push({
            text: trimmed.substring(3).trim(),
            line: line.lineNumber,
            prefix: 'OR'
          });
        } else {
          this.warnings.push({
            line: line.lineNumber,
            message: 'OR outside of WHEN block'
          });
        }
      } else if (upper.startsWith('THEN ') || upper === 'THEN') {
        state = 'then';
        const actionPart = trimmed.substring(4).trim();
        if (actionPart) {
          actionBuffer.push({ text: actionPart, line: line.lineNumber });
        }
      } else if (upper.startsWith('PRIORITY ')) {
        const priorityVal = parseInt(trimmed.substring(9).trim());
        if (isNaN(priorityVal)) {
          this.errors.push({
            line: line.lineNumber,
            message: `Invalid priority value: "${trimmed.substring(9).trim()}"`
          });
        } else {
          rule.priority = priorityVal;
        }
        state = 'options';
      } else if (upper === 'ONCE') {
        rule.once = true;
        state = 'options';
      } else if (state === 'then' && trimmed) {
        actionBuffer.push({ text: trimmed, line: line.lineNumber });
      } else if (state === 'when' && trimmed) {
        // Continuation of condition without AND/OR
        conditionBuffer.push({
          text: trimmed,
          line: line.lineNumber,
          prefix: 'AND'
        });
      }
    }

    // Set condition logic based on OR presence
    if (hasOr) {
      rule.conditionLogic = 'OR';
    }

    // Parse conditions
    rule.conditions = this.parseConditions(conditionBuffer);

    // Parse actions
    rule.actions = this.parseActions(actionBuffer);

    // Validate rule
    if (!rule.name) {
      this.errors.push({
        line: block.startLine,
        message: 'Rule must have a name'
      });
    }

    if (rule.actions.length === 0) {
      this.warnings.push({
        line: block.startLine,
        message: `Rule "${rule.name}" has no actions`
      });
    }

    return rule;
  }

  /**
   * Parse rule name from RULE line
   */
  parseRuleName(line, lineNumber) {
    // Match: RULE "name" or RULE 'name'
    const match = line.match(/RULE\s+["']([^"']+)["']/i);
    if (match) {
      return match[1];
    }

    // Try without quotes
    const noQuoteMatch = line.match(/RULE\s+(\S+)/i);
    if (noQuoteMatch) {
      this.warnings.push({
        line: lineNumber,
        message: 'Rule name should be quoted'
      });
      return noQuoteMatch[1];
    }

    return 'unnamed-rule';
  }

  /**
   * Parse condition buffer into condition objects
   */
  parseConditions(buffer) {
    const conditions = [];

    for (const item of buffer) {
      const condition = this.parseConditionExpression(item.text, item.line);
      if (condition) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  /**
   * Parse a single condition expression
   */
  parseConditionExpression(text, lineNumber) {
    // Handle parentheses for grouping (simplified - just strip them)
    text = text.replace(/^\(+|\)+$/g, '').trim();

    if (!text) return null;

    // Patterns to match different condition formats
    const patterns = [
      // field = "string value"
      {
        regex: /^(\w+(?:\.\w+)*)\s*(=|!=|==)\s*["']([^"']+)["']$/,
        handler: (m) => this.buildCondition(m[1], m[2], m[3], 'string')
      },
      // field comparator number
      {
        regex: /^(\w+(?:\.\w+)*)\s*(=|!=|==|<|>|<=|>=)\s*(-?\d+(?:\.\d+)?)$/,
        handler: (m) => this.buildCondition(m[1], m[2], parseFloat(m[3]), 'number')
      },
      // field = true/false
      {
        regex: /^(\w+(?:\.\w+)*)\s*(=|!=|==)\s*(true|false)$/i,
        handler: (m) => this.buildCondition(m[1], m[2], m[3].toLowerCase() === 'true', 'boolean')
      },
      // field isEmpty / isNotEmpty
      {
        regex: /^(\w+(?:\.\w+)*)\s+(isEmpty|isNotEmpty)$/i,
        handler: (m) => this.buildCondition(m[1], m[2].toLowerCase(), null, 'unary')
      },
      // field contains "value"
      {
        regex: /^(\w+(?:\.\w+)*)\s+(contains|startsWith|endsWith)\s*["']([^"']+)["']$/i,
        handler: (m) => this.buildCondition(m[1], m[2].toLowerCase(), m[3], 'string')
      },
      // field contains value (without quotes)
      {
        regex: /^(\w+(?:\.\w+)*)\s+(contains|startsWith|endsWith)\s+(\S+)$/i,
        handler: (m) => this.buildCondition(m[1], m[2].toLowerCase(), m[3], 'string')
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return pattern.handler(match);
      }
    }

    // Fallback: treat as custom expression
    this.warnings.push({
      line: lineNumber,
      message: `Could not parse condition, treating as custom: "${text}"`
    });

    return {
      id: crypto.randomUUID(),
      type: 'custom',
      field: '',
      comparator: 'equals',
      value: '',
      customCode: text
    };
  }

  /**
   * Build a condition object from parsed parts
   */
  buildCondition(fieldPath, comparator, value, valueType) {
    // Split field path into category and field
    const parts = fieldPath.split('.');
    let type = 'gameState';
    let field = fieldPath;

    // Recognize known categories
    const categories = ['action', 'stack', 'agent', 'space', 'gameState', 'game', 'state'];
    if (parts.length >= 2 && categories.includes(parts[0].toLowerCase())) {
      type = this.normalizeCategory(parts[0]);
      field = parts.slice(1).join('.');
    } else if (parts.length === 1) {
      // Single field - assume gameState
      type = 'gameState';
      field = parts[0];
    }

    // Normalize comparator
    const comparatorMap = {
      '=': 'equals',
      '==': 'equals',
      '!=': 'notEquals',
      '<': 'lessThan',
      '>': 'greaterThan',
      '<=': 'lessOrEqual',
      '>=': 'greaterOrEqual',
      'isempty': 'exists',  // Will negate in code gen
      'isnotempty': 'notExists',
      'contains': 'contains',
      'startswith': 'startsWith',
      'endswith': 'endsWith'
    };

    const normalizedComparator = comparatorMap[comparator.toLowerCase()] || comparator;

    return {
      id: crypto.randomUUID(),
      type,
      field,
      comparator: normalizedComparator,
      value: value,
      customCode: ''
    };
  }

  /**
   * Normalize category names
   */
  normalizeCategory(category) {
    const map = {
      'action': 'action',
      'stack': 'stack',
      'agent': 'agent',
      'space': 'space',
      'gamestate': 'gameState',
      'game': 'gameState',
      'state': 'gameState'
    };
    return map[category.toLowerCase()] || category;
  }

  /**
   * Parse action buffer into action objects
   */
  parseActions(buffer) {
    const actions = [];

    for (const item of buffer) {
      const action = this.parseActionLine(item.text, item.line);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Parse a single action line
   */
  parseActionLine(text, lineNumber) {
    const upper = text.toUpperCase();

    // dispatch "actionType" { payload }
    if (upper.startsWith('DISPATCH ')) {
      return this.parseDispatchAction(text, lineNumber);
    }

    // set field = value
    if (upper.startsWith('SET ')) {
      return this.parseSetAction(text, lineNumber);
    }

    // call method(args)
    if (upper.startsWith('CALL ')) {
      return this.parseCallAction(text, lineNumber);
    }

    // log "message"
    if (upper.startsWith('LOG ')) {
      return this.parseLogAction(text, lineNumber);
    }

    // Treat as custom code
    return {
      id: crypto.randomUUID(),
      type: 'custom',
      actionType: '',
      payload: {},
      property: '',
      value: '',
      method: '',
      args: [],
      message: '',
      customCode: text
    };
  }

  /**
   * Parse dispatch action
   */
  parseDispatchAction(text, lineNumber) {
    // dispatch "actionType" { payload }
    // dispatch "actionType"
    const match = text.match(/dispatch\s+["']([^"']+)["'](?:\s*(\{.*\}))?/i);

    if (!match) {
      this.errors.push({
        line: lineNumber,
        message: `Invalid dispatch syntax: "${text}"`
      });
      return null;
    }

    let payload = {};
    if (match[2]) {
      try {
        // Handle JSON-like syntax with unquoted keys
        let jsonText = match[2]
          .replace(/(\w+)\s*:/g, '"$1":')  // Quote unquoted keys
          .replace(/:\s*([a-zA-Z_$][\w$]*)\s*([,}])/g, (_, val, end) => {
            // Quote unquoted string values (but not true/false/null)
            if (['true', 'false', 'null'].includes(val)) {
              return `: ${val}${end}`;
            }
            return `: "${val}"${end}`;
          });
        payload = JSON.parse(jsonText);
      } catch (e) {
        this.warnings.push({
          line: lineNumber,
          message: `Could not parse payload JSON: ${match[2]}`
        });
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'dispatch',
      actionType: match[1],
      payload,
      property: '',
      value: '',
      method: '',
      args: [],
      message: '',
      customCode: ''
    };
  }

  /**
   * Parse set action
   */
  parseSetAction(text, lineNumber) {
    // set field = value
    const match = text.match(/set\s+(\w+(?:\.\w+)*)\s*=\s*(.+)/i);

    if (!match) {
      this.errors.push({
        line: lineNumber,
        message: `Invalid set syntax: "${text}"`
      });
      return null;
    }

    let value = match[2].trim();

    // Parse value type
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^-?\d+$/.test(value)) value = parseInt(value);
    else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);
    else if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);

    return {
      id: crypto.randomUUID(),
      type: 'setProperty',
      actionType: '',
      payload: {},
      property: match[1],
      value: String(value),
      method: '',
      args: [],
      message: '',
      customCode: ''
    };
  }

  /**
   * Parse call action
   */
  parseCallAction(text, lineNumber) {
    // call method(args)
    const match = text.match(/call\s+(\w+)\s*\(([^)]*)\)/i);

    if (!match) {
      this.errors.push({
        line: lineNumber,
        message: `Invalid call syntax: "${text}"`
      });
      return null;
    }

    const args = match[2]
      ? match[2].split(',').map(a => a.trim()).filter(Boolean)
      : [];

    return {
      id: crypto.randomUUID(),
      type: 'callMethod',
      actionType: '',
      payload: {},
      property: '',
      value: '',
      method: match[1],
      args,
      message: '',
      customCode: ''
    };
  }

  /**
   * Parse log action
   */
  parseLogAction(text, lineNumber) {
    // log "message"
    const match = text.match(/log\s+["']([^"']+)["']/i);

    if (!match) {
      this.errors.push({
        line: lineNumber,
        message: `Invalid log syntax: "${text}"`
      });
      return null;
    }

    return {
      id: crypto.randomUUID(),
      type: 'log',
      actionType: '',
      payload: {},
      property: '',
      value: '',
      method: '',
      args: [],
      message: match[1],
      customCode: ''
    };
  }
}

export default DSLParser;
