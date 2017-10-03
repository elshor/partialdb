/**
Unescape token part of a JSON Pointer string

`token` should *not* contain any '/' characters.

> Evaluation of each reference token begins by decoding any escaped
> character sequence.  This is performed by first transforming any
> occurrence of the sequence '~1' to '/', and then transforming any
> occurrence of the sequence '~0' to '~'.  By performing the
> substitutions in this order, an implementation avoids the error of
> turning '~01' first into '~1' and then into '/', which would be
> incorrect (the string '~01' correctly becomes '~1' after
> transformation).

Here's my take:

~1 is unescaped with higher priority than ~0 because it is a lower-order escape character.
I say "lower order" because '/' needs escaping due to the JSON Pointer serialization technique.
Whereas, '~' is escaped because escaping '/' uses the '~' character.
*/
function unescape(token) {
    return token.replace(/~1/g, '/').replace(/~0/g, '~');
}
/** Escape token part of a JSON Pointer string

> '~' needs to be encoded as '~0' and '/'
> needs to be encoded as '~1' when these characters appear in a
> reference token.

This is the exact inverse of `unescape()`, so the reverse replacements must take place in reverse order.
*/
function escape(token) {
    return token.replace(/~/g, '~0').replace(/\//g, '~1');
}
/**
JSON Pointer representation
*/
export class Pointer {
    constructor(tokens = ['']) {
        this.tokens = tokens;
    }
    /**
    `path` *must* be a properly escaped string.
    */
    static fromJSON(path) {
        var tokens = path.split('/').map(unescape);
        if (tokens[0] !== '')
            throw new Error(`Invalid JSON Pointer: ${path}`);
        return new Pointer(tokens);
    }
    toString() {
        return this.tokens.map(escape).join('/');
    }
    /**
    Returns an object with 'parent', 'key', and 'value' properties.
    In the special case that pointer = "", parent and key will be null, and `value = obj`
    Otherwise, parent will be the such that `parent[key] == value`
    */
    evaluate(object, shouldCreate = false) {
        var parent = null;
        var token = null;
        for (var i = 1, l = this.tokens.length; i < l; i++) {
            parent = object;
            token = this.tokens[i];
            //if the token is '-' and it is not the last token then generate an object
            if (token === '-' && i < (l - 1) && shouldCreate) {
                parent.push({});
                token = (parent.length - 1).toString();
            }
            //if shouldCreate and the next object is missing then create it as an object
            if (parent[token] === undefined && i < (l - 1) && shouldCreate) {
                if (this.tokens[i + 1] === '-') {
                    parent[token] = [];
                }
                else {
                    parent[token] = {};
                }
            }
            object = (parent || {})[token];
        }
        return {
            parent: parent,
            key: token,
            value: object,
        };
    }
    push(token) {
        // mutable
        this.tokens.push(token);
    }
    /**
    `token` should be a String. It'll be coerced to one anyway.
  
    immutable (shallowly)
    */
    add(token) {
        var tokens = this.tokens.concat(String(token));
        return new Pointer(tokens);
    }
}
