/**
 * DSL Generator
 *
 * Generates human-readable DSL text from rule JSON definitions.
 *
 * Output syntax:
 *   RULE "name"
 *     WHEN <conditions>
 *     THEN <actions>
 *     [PRIORITY <number>]
 *     [ONCE]
 */

/**
 * DSLGenerator class
 */
export class DSLGenerator {
  /**
   * Generate DSL text from a single rule definition
   * @param {Object} rule - Rule definition object
   * @returns {string} DSL text
   */
  generate(rule) {
    const lines = [];

    // Rule name
    lines.push(`RULE "${rule.name}"`);

    // Conditions
    const conditionLines = this.generateConditions(rule.conditions, rule.conditionLogic);
    if (conditionLines.length > 0) {
      lines.push(`  WHEN ${conditionLines[0]}`);
      for (let i = 1; i < conditionLines.length; i++) {
        lines.push(`   ${conditionLines[i]}`);
      }
    }

    // Actions
    const actionLines = this.generateActions(rule.actions);
    if (actionLines.length === 0) {
      lines.push('  THEN -- no actions');
    } else if (actionLines.length === 1) {
      lines.push(`  THEN ${actionLines[0]}`);
    } else {
      lines.push('  THEN');
      for (const actionLine of actionLines) {
        lines.push(`    ${actionLine}`);
      }
    }

    // Priority (only if not default)
    if (rule.priority !== undefined && rule.priority !== 50 && rule.priority !== 0) {
      lines.push(`  PRIORITY ${rule.priority}`);
    }

    // Once flag
    if (rule.once) {
      lines.push('  ONCE');
    }

    return lines.join('\n');
  }

  /**
   * Generate DSL for multiple rules
   * @param {Array} rules - Array of rule definitions
   * @returns {string} DSL text with all rules
   */
  generateAll(rules) {
    if (!rules || rules.length === 0) {
      return '-- No rules defined\n-- Create a rule using the form editor or type DSL here\n\n-- Example:\n-- RULE "my-rule"\n--   WHEN action.type = "example"\n--   THEN dispatch "response"';
    }

    const header = `-- HyperToken Rules\n-- Generated: ${new Date().toISOString()}\n-- ${rules.length} rule(s)\n`;

    const ruleTexts = rules.map(r => this.generate(r));

    return header + '\n' + ruleTexts.join('\n\n');
  }

  /**
   * Generate condition lines
   */
  generateConditions(conditions, logic = 'AND') {
    if (!conditions || conditions.length === 0) {
      return ['true'];
    }

    const joiner = logic === 'OR' ? 'OR' : 'AND';

    return conditions.map((item, index) => {
      const condText = this.generateConditionItem(item);
      return index === 0 ? condText : `${joiner} ${condText}`;
    });
  }

  /**
   * Generate a single condition
   */
  generateConditionItem(item) {
    // Handle custom conditions
    if (item.type === 'custom') {
      return item.customCode || 'true';
    }

    const field = this.buildFieldPath(item);
    const comparator = this.formatComparator(item.comparator);
    const value = this.formatValue(item.value);

    // Handle unary operators (isEmpty, isNotEmpty)
    if (['exists', 'notExists', 'isEmpty', 'isNotEmpty'].includes(item.comparator)) {
      const unaryOp = item.comparator === 'exists' || item.comparator === 'isEmpty'
        ? 'isEmpty'
        : 'isNotEmpty';
      return `${field} ${unaryOp}`;
    }

    return `${field} ${comparator} ${value}`;
  }

  /**
   * Build field path from condition item
   */
  buildFieldPath(item) {
    if (!item.type || item.type === 'custom') {
      return item.field || 'value';
    }

    // Don't duplicate the type if field already includes it
    if (item.field && item.field.startsWith(item.type + '.')) {
      return item.field;
    }

    if (item.field) {
      return `${item.type}.${item.field}`;
    }

    return item.type;
  }

  /**
   * Format comparator for DSL output
   */
  formatComparator(comparator) {
    const map = {
      'equals': '=',
      'notEquals': '!=',
      'lessThan': '<',
      'greaterThan': '>',
      'lessOrEqual': '<=',
      'greaterOrEqual': '>=',
      'lessThanOrEqual': '<=',
      'greaterThanOrEqual': '>=',
      'contains': 'contains',
      'notContains': 'not contains',
      'startsWith': 'startsWith',
      'endsWith': 'endsWith',
      'matches': 'matches',
      'exists': 'isEmpty',
      'notExists': 'isNotEmpty'
    };
    return map[comparator] || comparator;
  }

  /**
   * Format value for DSL output
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      // Check if it looks like a variable reference
      if (/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value) && !value.includes(' ')) {
        // Could be a variable, but safer to quote
        return `"${value}"`;
      }
      return `"${value}"`;
    }

    if (typeof value === 'boolean') {
      return value.toString();
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    // Objects/arrays
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Generate action lines
   */
  generateActions(actions) {
    if (!actions || actions.length === 0) {
      return [];
    }

    return actions.map(action => this.generateActionItem(action)).filter(Boolean);
  }

  /**
   * Generate a single action
   */
  generateActionItem(action) {
    switch (action.type) {
      case 'dispatch':
        return this.generateDispatchAction(action);

      case 'setProperty':
        return this.generateSetAction(action);

      case 'callMethod':
        return this.generateCallAction(action);

      case 'log':
        return this.generateLogAction(action);

      case 'custom':
        return action.customCode || '-- custom action';

      default:
        return `-- Unknown action type: ${action.type}`;
    }
  }

  /**
   * Generate dispatch action
   */
  generateDispatchAction(action) {
    const actionType = action.actionType || 'unknown';

    if (action.payload && Object.keys(action.payload).length > 0) {
      // Format payload as compact JSON
      const payloadStr = JSON.stringify(action.payload);
      return `dispatch "${actionType}" ${payloadStr}`;
    }

    return `dispatch "${actionType}"`;
  }

  /**
   * Generate set action
   */
  generateSetAction(action) {
    const property = action.property || 'value';
    const value = this.formatValue(action.value);
    return `set ${property} = ${value}`;
  }

  /**
   * Generate call action
   */
  generateCallAction(action) {
    const method = action.method || 'unknown';
    const args = action.args && action.args.length > 0
      ? action.args.map(a => this.formatValue(a)).join(', ')
      : '';
    return `call ${method}(${args})`;
  }

  /**
   * Generate log action
   */
  generateLogAction(action) {
    const message = action.message || 'log message';
    return `log "${message}"`;
  }
}

export default DSLGenerator;
