export function findTemplateVariables(template: any): Set<string> {
    // Find all variables in the template
    const variableRegex = /\{\{(\w+)\}\}/g;
    let variables: Set<string> = new Set();
    let match;

    while ((match = variableRegex.exec(JSON.stringify(template))) !== null) {
        variables.add(match[1]);
    }
    return variables;
}