export function replaceTemplateVariables(template: any, variables: { [key: string]: string }): any {
    // Replace all variables in the template with provided values
    let finalWorkItem = JSON.stringify(template);
    for (let variable in variables) {
        const value = variables[variable];
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g");
        finalWorkItem = finalWorkItem.replace(regex, () => value);
    }
    return JSON.parse(finalWorkItem);
}