/**
 * Token: Universal entity representation
 *
 * Tokens are immutable data structures representing game entities (cards, items, agents, etc.)
 * They can be placed in Stacks, Spaces, and Sources, and support:
 * - Metadata and grouping
 * - Reversals (tarot-style)
 * - Tags and attachments
 * - Merge/split tracking for composite entities
 */
export class Token {
    id;
    group;
    label;
    text;
    meta;
    char;
    kind;
    index;
    // Runtime properties
    _rev;
    _tags;
    _attachments;
    _attachedTo;
    _attachmentType;
    // Merge/split bookkeeping
    _merged;
    _mergedInto;
    _mergedFrom;
    _mergedAt;
    _split;
    _splitInto;
    _splitFrom;
    _splitIndex;
    _splitAt;
    /**
     * Create a new Token
     * @param props - Token properties (all optional, will use defaults)
     */
    constructor({ id, group = null, label = null, text = "", meta = {}, char = "□", kind = "default", index = 0 } = {}) {
        this.id = id ?? `token-${index}`;
        this.group = group;
        this.label = label;
        this.text = text;
        this.meta = meta;
        this.char = char;
        this.kind = kind;
        this.index = index;
    }
}
