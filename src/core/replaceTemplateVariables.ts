function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceInValue(value: any, variables: { [key: string]: string }): any {
    if (typeof value === "string") {
        let replacedValue = value;
        for (const variable in variables) {
            const replacementValue = variables[variable];
            const regex = new RegExp(`\\{\\{${escapeRegExp(variable)}\\}\\}`, "g");
            replacedValue = replacedValue.replace(regex, replacementValue);
        }
        return replacedValue;
    }

    if (Array.isArray(value)) {
        return value.map((item: any) => replaceInValue(item, variables));
    }

    if (value !== null && typeof value === "object") {
        const replacedObject: { [key: string]: any } = {};
        for (const key in value) {
            replacedObject[key] = replaceInValue(value[key], variables);
        }
        return replacedObject;
    }

    return value;
}

export function replaceTemplateVariables(template: any, variables: { [key: string]: string }): any {
    return replaceInValue(template, variables);
}