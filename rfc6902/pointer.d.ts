export interface PointerEvaluation {
    parent: any;
    key: string;
    value: any;
}
/**
JSON Pointer representation
*/
export declare class Pointer {
    tokens: string[];
    constructor(tokens?: string[]);
    /**
    `path` *must* be a properly escaped string.
    */
    static fromJSON(path: string): Pointer;
    toString(): string;
    /**
    Returns an object with 'parent', 'key', and 'value' properties.
    In the special case that pointer = "", parent and key will be null, and `value = obj`
    Otherwise, parent will be the such that `parent[key] == value`
    */
    evaluate(object: any, shouldCreate?: boolean): PointerEvaluation;
    push(token: string): void;
    /**
    `token` should be a String. It'll be coerced to one anyway.
  
    immutable (shallowly)
    */
    add(token: string): Pointer;
}
