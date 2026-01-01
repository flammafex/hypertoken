/**
 * RuleManager
 *
 * Manages rule definitions for the playground's Rule Composer.
 * Handles rule storage, code generation, and event emission.
 */

/**
 * Condition types available in the rule composer
 */
export const CONDITION_TYPES = {
  ACTION: 'action',
  STACK: 'stack',
  AGENT: 'agent',
  SPACE: 'space',
  GAME_STATE: 'gameState',
  CUSTOM: 'custom'
};

/**
 * Comparators for conditions
 */
export const COMPARATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  GREATER_THAN: 'greaterThan',
  LESS_THAN: 'lessThan',
  GREATER_OR_EQUAL: 'greaterOrEqual',
  LESS_OR_EQUAL: 'lessOrEqual',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'notContains',
  MATCHES: 'matches',
  EXISTS: 'exists',
  NOT_EXISTS: 'notExists'
};

/**
 * Action types for rules
 */
export const ACTION_TYPES = {
  DISPATCH: 'dispatch',
  SET_PROPERTY: 'setProperty',
  CALL_METHOD: 'callMethod',
  LOG: 'log',
  CUSTOM: 'custom'
};

/**
 * Comparator labels for UI
 */
export const COMPARATOR_LABELS = {
  [COMPARATORS.EQUALS]: '==',
  [COMPARATORS.NOT_EQUALS]: '!=',
  [COMPARATORS.GREATER_THAN]: '>',
  [COMPARATORS.LESS_THAN]: '<',
  [COMPARATORS.GREATER_OR_EQUAL]: '>=',
  [COMPARATORS.LESS_OR_EQUAL]: '<=',
  [COMPARATORS.CONTAINS]: 'contains',
  [COMPARATORS.NOT_CONTAINS]: 'not contains',
  [COMPARATORS.MATCHES]: 'matches',
  [COMPARATORS.EXISTS]: 'exists',
  [COMPARATORS.NOT_EXISTS]: 'not exists'
};

/**
 * Create a new empty condition
 */
export function createCondition(type = CONDITION_TYPES.ACTION) {
  return {
    id: crypto.randomUUID(),
    type,
    field: '',
    comparator: COMPARATORS.EQUALS,
    value: '',
    customCode: ''
  };
}

/**
 * Create a new empty action
 */
export function createAction(type = ACTION_TYPES.DISPATCH) {
  return {
    id: crypto.randomUUID(),
    type,
    actionType: '',
    payload: {},
    property: '',
    value: '',
    method: '',
    args: [],
    message: '',
    customCode: ''
  };
}

/**
 * Create a new empty rule
 */
export function createRule(name = 'New Rule') {
  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    enabled: true,
    priority: 0,
    once: false,
    conditions: [createCondition()],
    conditionLogic: 'AND', // AND | OR
    actions: [createAction()],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// === Validation ===

/**
 * Dangerous patterns to block in custom code
 * Prevents XSS, eval-like execution, and unsafe DOM manipulation
 */
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bsetTimeout\s*\(\s*["'`]/i,
  /\bsetInterval\s*\(\s*["'`]/i,
  /\bdocument\s*\.\s*write/i,
  /\binnerHTML\s*=/i,
  /\bouterHTML\s*=/i,
  /\binsertAdjacentHTML/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /<\s*script/i,
  /import\s*\(/i,
  /require\s*\(/i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest/i,
  /\blocalStorage/i,
  /\bsessionStorage/i,
  /\bcookie/i,
];

/**
 * Validate and sanitize custom code
 * @param {string} code - The custom code to validate
 * @returns {{ valid: boolean, sanitized: string, errors: string[] }}
 */
export function validateCustomCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: true, sanitized: '', errors: [] };
  }

  const errors = [];
  let sanitized = code.trim();

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      errors.push(`Potentially unsafe pattern detected: ${pattern.source}`);
    }
  }

  // Limit code length
  const MAX_CODE_LENGTH = 5000;
  if (sanitized.length > MAX_CODE_LENGTH) {
    errors.push(`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`);
    sanitized = sanitized.slice(0, MAX_CODE_LENGTH);
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validate a rule object
 * @param {object} rule - The rule to validate
 * @returns {{ valid: boolean, errors: string[], sanitizedRule: object }}
 */
export function validateRule(rule) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule must be an object'], sanitizedRule: null };
  }

  const sanitizedRule = { ...rule };

  // Validate required fields
  if (typeof sanitizedRule.name !== 'string' || sanitizedRule.name.trim() === '') {
    sanitizedRule.name = 'Unnamed Rule';
  }
  sanitizedRule.name = sanitizedRule.name.slice(0, 100); // Limit name length

  if (typeof sanitizedRule.description !== 'string') {
    sanitizedRule.description = '';
  }
  sanitizedRule.description = sanitizedRule.description.slice(0, 500); // Limit description

  // Validate types
  if (typeof sanitizedRule.enabled !== 'boolean') {
    sanitizedRule.enabled = true;
  }

  if (typeof sanitizedRule.priority !== 'number' || !Number.isFinite(sanitizedRule.priority)) {
    sanitizedRule.priority = 0;
  }
  sanitizedRule.priority = Math.max(-1000, Math.min(1000, sanitizedRule.priority)); // Clamp priority

  if (typeof sanitizedRule.once !== 'boolean') {
    sanitizedRule.once = false;
  }

  if (!['AND', 'OR'].includes(sanitizedRule.conditionLogic)) {
    sanitizedRule.conditionLogic = 'AND';
  }

  // Validate conditions
  if (!Array.isArray(sanitizedRule.conditions)) {
    sanitizedRule.conditions = [];
  }
  sanitizedRule.conditions = sanitizedRule.conditions.slice(0, 20).map(cond => {
    const validCond = { ...cond };

    // Validate condition type
    if (!Object.values(CONDITION_TYPES).includes(validCond.type)) {
      validCond.type = CONDITION_TYPES.ACTION;
    }

    // Validate comparator
    if (!Object.values(COMPARATORS).includes(validCond.comparator)) {
      validCond.comparator = COMPARATORS.EQUALS;
    }

    // Sanitize custom code in conditions
    if (validCond.customCode) {
      const codeValidation = validateCustomCode(validCond.customCode);
      if (!codeValidation.valid) {
        errors.push(...codeValidation.errors.map(e => `Condition: ${e}`));
      }
      validCond.customCode = codeValidation.sanitized;
    }

    return validCond;
  });

  // Validate actions
  if (!Array.isArray(sanitizedRule.actions)) {
    sanitizedRule.actions = [];
  }
  sanitizedRule.actions = sanitizedRule.actions.slice(0, 20).map(action => {
    const validAction = { ...action };

    // Validate action type
    if (!Object.values(ACTION_TYPES).includes(validAction.type)) {
      validAction.type = ACTION_TYPES.LOG;
    }

    // Sanitize custom code in actions
    if (validAction.customCode) {
      const codeValidation = validateCustomCode(validAction.customCode);
      if (!codeValidation.valid) {
        errors.push(...codeValidation.errors.map(e => `Action: ${e}`));
      }
      validAction.customCode = codeValidation.sanitized;
    }

    return validAction;
  });

  // Ensure ID exists
  if (typeof sanitizedRule.id !== 'string' || sanitizedRule.id.trim() === '') {
    sanitizedRule.id = crypto.randomUUID();
  }

  // Ensure timestamps
  if (typeof sanitizedRule.createdAt !== 'number') {
    sanitizedRule.createdAt = Date.now();
  }
  sanitizedRule.updatedAt = Date.now();

  return {
    valid: errors.length === 0,
    errors,
    sanitizedRule
  };
}

/**
 * RuleManager class
 */
export class RuleManager extends EventTarget {
  constructor() {
    super();
    this.rules = new Map();
    this._loadFromStorage();
  }

  /**
   * Get all rules as an array
   */
  getRules() {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a rule by ID
   */
  getRule(id) {
    return this.rules.get(id);
  }

  /**
   * Add a new rule
   * @param {object} rule - Rule to add (will be validated)
   * @returns {{ rule: object, errors: string[] } | null}
   */
  addRule(rule = null) {
    const newRule = rule || createRule();

    // Validate the rule
    const validation = validateRule(newRule);
    if (validation.sanitizedRule === null) {
      console.warn('Invalid rule rejected:', validation.errors);
      return null;
    }

    // Log any validation warnings
    if (validation.errors.length > 0) {
      console.warn('Rule validation warnings:', validation.errors);
    }

    this.rules.set(validation.sanitizedRule.id, validation.sanitizedRule);
    this._saveToStorage();
    this._emit('rule:added', { rule: validation.sanitizedRule, warnings: validation.errors });
    return { rule: validation.sanitizedRule, errors: validation.errors };
  }

  /**
   * Update an existing rule
   * @param {string} id - Rule ID to update
   * @param {object} updates - Updates to apply (will be validated)
   * @returns {{ rule: object, errors: string[] } | null}
   */
  updateRule(id, updates) {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const mergedRule = {
      ...rule,
      ...updates,
      id // Preserve original ID
    };

    // Validate the merged rule
    const validation = validateRule(mergedRule);
    if (validation.sanitizedRule === null) {
      console.warn('Invalid rule update rejected:', validation.errors);
      return null;
    }

    // Log any validation warnings
    if (validation.errors.length > 0) {
      console.warn('Rule update validation warnings:', validation.errors);
    }

    this.rules.set(id, validation.sanitizedRule);
    this._saveToStorage();
    this._emit('rule:updated', { rule: validation.sanitizedRule, warnings: validation.errors });
    return { rule: validation.sanitizedRule, errors: validation.errors };
  }

  /**
   * Delete a rule
   */
  deleteRule(id) {
    const rule = this.rules.get(id);
    if (!rule) return false;

    this.rules.delete(id);
    this._saveToStorage();
    this._emit('rule:deleted', { ruleId: id });
    return true;
  }

  /**
   * Toggle rule enabled state
   */
  toggleRule(id) {
    const rule = this.rules.get(id);
    if (!rule) return null;

    return this.updateRule(id, { enabled: !rule.enabled });
  }

  /**
   * Duplicate a rule
   */
  duplicateRule(id) {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const newRule = {
      ...JSON.parse(JSON.stringify(rule)),
      id: crypto.randomUUID(),
      name: `${rule.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Regenerate IDs for conditions and actions
    newRule.conditions = newRule.conditions.map(c => ({ ...c, id: crypto.randomUUID() }));
    newRule.actions = newRule.actions.map(a => ({ ...a, id: crypto.randomUUID() }));

    return this.addRule(newRule);
  }

  /**
   * Generate JavaScript code for a rule
   */
  generateCode(rule) {
    const lines = [];
    const indent = '  ';

    lines.push(`// Rule: ${rule.name}`);
    if (rule.description) {
      lines.push(`// ${rule.description}`);
    }
    lines.push(`engine.addRule({`);

    // Condition function
    lines.push(`${indent}condition: (ctx) => {`);
    lines.push(`${indent}${indent}const { action, stack, agent, space, state } = ctx;`);

    if (rule.conditions.length === 0) {
      lines.push(`${indent}${indent}return true;`);
    } else if (rule.conditions.length === 1) {
      const condCode = this._generateConditionCode(rule.conditions[0], `${indent}${indent}`);
      lines.push(`${indent}${indent}return ${condCode};`);
    } else {
      const op = rule.conditionLogic === 'OR' ? ' ||' : ' &&';
      lines.push(`${indent}${indent}return (`);
      rule.conditions.forEach((cond, i) => {
        const condCode = this._generateConditionCode(cond, `${indent}${indent}${indent}`);
        const suffix = i < rule.conditions.length - 1 ? op : '';
        lines.push(`${indent}${indent}${indent}${condCode}${suffix}`);
      });
      lines.push(`${indent}${indent});`);
    }
    lines.push(`${indent}},`);

    // Action function
    lines.push(`${indent}action: (ctx) => {`);
    lines.push(`${indent}${indent}const { dispatch, agent, stack, state } = ctx;`);

    rule.actions.forEach(action => {
      const actionLines = this._generateActionCode(action, `${indent}${indent}`);
      lines.push(...actionLines);
    });

    lines.push(`${indent}},`);

    // Options
    if (rule.priority !== 0 || rule.once) {
      const opts = [];
      if (rule.priority !== 0) opts.push(`priority: ${rule.priority}`);
      if (rule.once) opts.push(`once: true`);
      lines.push(`${indent}options: { ${opts.join(', ')} }`);
    }

    lines.push(`});`);

    return lines.join('\n');
  }

  /**
   * Generate code for a single condition
   */
  _generateConditionCode(cond, indent) {
    if (cond.type === CONDITION_TYPES.CUSTOM) {
      return cond.customCode || 'true';
    }

    const field = this._getConditionField(cond);
    const value = this._formatValue(cond.value);

    switch (cond.comparator) {
      case COMPARATORS.EQUALS:
        return `${field} === ${value}`;
      case COMPARATORS.NOT_EQUALS:
        return `${field} !== ${value}`;
      case COMPARATORS.GREATER_THAN:
        return `${field} > ${value}`;
      case COMPARATORS.LESS_THAN:
        return `${field} < ${value}`;
      case COMPARATORS.GREATER_OR_EQUAL:
        return `${field} >= ${value}`;
      case COMPARATORS.LESS_OR_EQUAL:
        return `${field} <= ${value}`;
      case COMPARATORS.CONTAINS:
        return `${field}?.includes?.(${value})`;
      case COMPARATORS.NOT_CONTAINS:
        return `!${field}?.includes?.(${value})`;
      case COMPARATORS.MATCHES:
        return `${value}.test(${field})`;
      case COMPARATORS.EXISTS:
        return `${field} != null`;
      case COMPARATORS.NOT_EXISTS:
        return `${field} == null`;
      default:
        return 'true';
    }
  }

  /**
   * Get the field accessor for a condition
   */
  _getConditionField(cond) {
    const field = cond.field || 'type';

    switch (cond.type) {
      case CONDITION_TYPES.ACTION:
        return `action.${field}`;
      case CONDITION_TYPES.STACK:
        return `stack.${field}`;
      case CONDITION_TYPES.AGENT:
        return `agent.${field}`;
      case CONDITION_TYPES.SPACE:
        return `space.${field}`;
      case CONDITION_TYPES.GAME_STATE:
        return `state.${field}`;
      default:
        return field;
    }
  }

  /**
   * Format a value for code generation
   */
  _formatValue(value) {
    if (value === '' || value === undefined || value === null) {
      return 'null';
    }

    // Check if it's a number
    if (!isNaN(Number(value)) && value !== '') {
      return String(Number(value));
    }

    // Check if it's a boolean
    if (value === 'true' || value === 'false') {
      return value;
    }

    // Check if it's a regex pattern
    if (value.startsWith('/') && value.lastIndexOf('/') > 0) {
      return value;
    }

    // Check if it looks like code (contains dots, brackets, etc.)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$.[\]()]*$/.test(value)) {
      return value;
    }

    // Default to string
    return JSON.stringify(value);
  }

  /**
   * Generate code for a single action
   */
  _generateActionCode(action, indent) {
    const lines = [];

    switch (action.type) {
      case ACTION_TYPES.DISPATCH:
        const payload = action.payload && Object.keys(action.payload).length > 0
          ? JSON.stringify(action.payload, null, 2).split('\n').map((l, i) => i === 0 ? l : indent + l).join('\n')
          : '{}';
        lines.push(`${indent}dispatch({ type: '${action.actionType}', payload: ${payload} });`);
        break;

      case ACTION_TYPES.SET_PROPERTY:
        lines.push(`${indent}state.${action.property} = ${this._formatValue(action.value)};`);
        break;

      case ACTION_TYPES.CALL_METHOD:
        const args = (action.args || []).map(a => this._formatValue(a)).join(', ');
        lines.push(`${indent}${action.method}(${args});`);
        break;

      case ACTION_TYPES.LOG:
        lines.push(`${indent}console.log(${this._formatValue(action.message)}, ctx);`);
        break;

      case ACTION_TYPES.CUSTOM:
        if (action.customCode) {
          action.customCode.split('\n').forEach(line => {
            lines.push(`${indent}${line}`);
          });
        }
        break;
    }

    return lines;
  }

  /**
   * Generate code for all enabled rules
   */
  generateAllCode() {
    const enabledRules = this.getRules().filter(r => r.enabled);
    return enabledRules.map(r => this.generateCode(r)).join('\n\n');
  }

  /**
   * Import rules from JSON
   * @param {string|object|Array} json - JSON string or rule object(s)
   * @returns {{ imported: number, failed: number, errors: string[] }}
   */
  importRules(json) {
    const result = { imported: 0, failed: 0, errors: [] };

    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const rules = Array.isArray(data) ? data : [data];

      rules.forEach((rule, index) => {
        // Ensure new IDs to avoid conflicts
        const ruleToImport = {
          ...rule,
          id: crypto.randomUUID(),
          conditions: rule.conditions?.map(c => ({ ...c, id: crypto.randomUUID() })) || [],
          actions: rule.actions?.map(a => ({ ...a, id: crypto.randomUUID() })) || [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const addResult = this.addRule(ruleToImport);
        if (addResult) {
          result.imported++;
          if (addResult.errors.length > 0) {
            result.errors.push(`Rule ${index + 1} "${rule.name || 'unnamed'}": ${addResult.errors.join(', ')}`);
          }
        } else {
          result.failed++;
          result.errors.push(`Rule ${index + 1} "${rule.name || 'unnamed'}": Failed to import`);
        }
      });

      return result;
    } catch (e) {
      console.error('Failed to import rules:', e);
      result.errors.push(`Parse error: ${e.message}`);
      return result;
    }
  }

  /**
   * Export rules to JSON
   */
  exportRules() {
    return JSON.stringify(this.getRules(), null, 2);
  }

  /**
   * Save rules to localStorage
   */
  _saveToStorage() {
    try {
      localStorage.setItem('hypertoken_rules', JSON.stringify(this.getRules()));
    } catch (e) {
      console.warn('Failed to save rules to localStorage:', e);
    }
  }

  /**
   * Load rules from localStorage
   */
  _loadFromStorage() {
    try {
      const stored = localStorage.getItem('hypertoken_rules');
      if (stored) {
        const rules = JSON.parse(stored);
        rules.forEach(rule => {
          this.rules.set(rule.id, rule);
        });
      }
    } catch (e) {
      console.warn('Failed to load rules from localStorage:', e);
    }
  }

  /**
   * Clear all rules
   */
  clearAll() {
    this.rules.clear();
    this._saveToStorage();
    this._emit('rules:cleared', {});
  }

  /**
   * Emit a custom event
   */
  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export default RuleManager;
