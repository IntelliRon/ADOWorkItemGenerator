export class ErrorCodeGenerator {
    // Static map
    private static errorCodes: { [key: string]: { id: number, message: string } } = {
        "PERSONAL_ACCESS_TOKEN_NOT_SET": { id: -1, message: "PERSONAL_ACCESS_TOKEN environment variable is not set" },
        "MISSING_PROJECT": { id: -2, message: "PROJECT environment variable is missing" },
        "MISSING_TYPE": { id: -3, message: "workItemType is missing in template" },
        "WORK_ITEM_CREATION_FAILED": { id: -4, message: "Work item creation failed (no details available)" },
        "NO_TEMPLATE_PROVIDED": { id: -5, message: "No template provided for work item creation" },
        "CREATION_MODE_NOT_SINGLE": { id: -6, message: "Template creationMode is not set to 'single'. This function only supports single work item creation." },
        "TEMPLATE_DATA_MISSING": { id: -7, message: "Template data is missing. The template should have a 'templateData' property containing the work item fields." }
    };

    // Static method to get error code by name
    public static getErrorCode(name: string): number {
        return this.errorCodes[name] ? this.errorCodes[name].id : -999; // Return -999 for unknown error codes
    }

    public static getErrorMessage(code: number): string {
        for (let key in this.errorCodes) {
            if (this.errorCodes[key].id === code) {
                return this.errorCodes[key].message;
            }
        }
        return "Unknown error code";
    }
}