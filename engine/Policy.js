export class Policy {
    name;
    condition;
    effect;
    priority;
    once;
    enabled;
    _fired;
    _hits;
    constructor(name, condition, effect, { priority = 0, once = false, enabled = true } = {}) {
        this.name = name;
        this.condition = condition;
        this.effect = effect;
        this.priority = priority;
        this.once = once;
        this.enabled = enabled;
        this._fired = false;
        this._hits = 0;
    }
    evaluate(engine) {
        if (!this.enabled)
            return false;
        if (this.once && this._fired)
            return false;
        let shouldFire = false;
        try {
            shouldFire = !!this.condition(engine);
        }
        catch (err) {
            engine.emit("policy:error", { payload: { name: this.name, error: err } });
            return false;
        }
        if (shouldFire) {
            try {
                this.effect(engine);
                this._hits++;
                if (this.once)
                    this._fired = true;
                engine.emit("policy:triggered", { payload: { name: this.name, hits: this._hits } });
            }
            catch (err) {
                engine.emit("policy:error", { payload: { name: this.name, error: err } });
            }
            return true;
        }
        return false;
    }
    reset() {
        this._fired = false;
        this._hits = 0;
        return this;
    }
    disable() { this.enabled = false; return this; }
    enable() { this.enabled = true; return this; }
    toJSON() {
        return {
            name: this.name,
            priority: this.priority,
            once: this.once,
            enabled: this.enabled,
            hits: this._hits,
            fired: this._fired
        };
    }
}
