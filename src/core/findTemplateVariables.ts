export function findTemplateVariables(template: any): Set<string> {
    // Find all variables in the template
    const variableRegex = /\{\{(\w+)\}\}/g;
    const templateString = JSON.stringify(template);
    let variables: Set<string> = new Set();
    let match;

    while ((match = variableRegex.exec(templateString)) !== null) {
        variables.add(match[1]);
    }
    return variables;
}