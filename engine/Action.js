import { generateId } from "../core/crypto.js";
export class Action {
    id;
    type;
    payload;
    seed;
    reversible;
    timestamp;
    result; // To store the return value of the action
    constructor(type, payload = {}, { seed = null, reversible = true } = {}) {
        this.id = generateId();
        this.type = type;
        this.payload = payload;
        this.seed = seed;
        this.reversible = reversible;
        this.timestamp = Date.now();
    }
    static fromJSON(data) {
        const a = new Action(data.type, data.payload, {
            seed: data.seed,
            reversible: data.reversible
        });
        // Restore timestamp/id if present
        if (data.timestamp)
            a.timestamp = data.timestamp;
        if (data.id)
            a.id = data.id;
        return a;
    }
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            payload: this.payload,
            seed: this.seed,
            reversible: this.reversible,
            timestamp: this.timestamp
        };
    }
}
