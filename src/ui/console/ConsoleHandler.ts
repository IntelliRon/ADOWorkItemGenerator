import * as fs from "fs";
import * as path from "path";
import * as readline from 'readline';
import { TemplateProcessor } from "../../core/TemplateProcessor.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

export class ConsoleHandler {
    basePath: string;
    templateProcessor: TemplateProcessor;

    constructor(basePath: string) {
        this.basePath = basePath;
        this.templateProcessor = new TemplateProcessor(basePath);
    }

    /** 
     * Get user input for a question via readline
     * 
     * @param question The question to ask the user
     * @returns A promise that resolves with the user's input
     */
    getUserInput(question: string): Promise<string> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(question, (answer: string) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    /**
     * Interactively allows the user to select a work item template file from the work-item-templates folder or its sub-folders.
     * The user can navigate through sub-folders and select a JSON template file. The function returns the path of the selected template file.
     * 
     * @returns The path of the selected work item template file or undefined if no file was selected
     */
    async getTemplatePath() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let currentFolder = "";
        let answerIndex: number = -1;
        let workItemTemplates: string[] | undefined = this.templateProcessor.getWorkItemTemplates(currentFolder);

        if (!workItemTemplates) {
            rl.close();
            return undefined;
        }

        while (answerIndex < 0 || answerIndex >= workItemTemplates.length) {
            workItemTemplates = this.templateProcessor.getWorkItemTemplates(currentFolder);

            if (!workItemTemplates) {
                rl.close();
                return undefined;
            }

            if (currentFolder !== "") {
                workItemTemplates.unshift("../"); // Add option at start to go back to parent folder
            }
            workItemTemplates.push("Exit"); // Add option to exit program at end of list

            for (let i = 0; i < workItemTemplates.length; i++) {
                console.log(`${i + 1}: ${workItemTemplates[i]}`);
            }

            answerIndex = await new Promise((resolve) => {
                rl.question(`> ${currentFolder || "root"} Select folder or template file by index: `, (answer: string) => {
                    try {
                        const index = parseInt(answer, 10) - 1;
                        if (isNaN(index) || index < 0 || index >= workItemTemplates!.length) {
                            console.log("Invalid input. Please enter a valid index.");
                            resolve(-1);
                            return;
                        }
                        resolve(index);
                    } catch (err) {
                        console.log("Invalid input. Please enter a valid index.");
                        resolve(-1);
                    }
                });
            });

            if (answerIndex < 0 || answerIndex >= workItemTemplates.length) {
                continue;
            }

            if (answerIndex === 0 && currentFolder !== "") {
                currentFolder = path.dirname(currentFolder);
                answerIndex = -1;
                continue;
            } else if (answerIndex === workItemTemplates.length - 1) {
                rl.close();
                return undefined;
            }

            const selectedPath = path.join(this.basePath, "../work-item-templates", currentFolder, workItemTemplates[answerIndex]);
            if (fs.existsSync(selectedPath)) {
                if (fs.lstatSync(selectedPath).isDirectory()) {
                    currentFolder = path.join(currentFolder, workItemTemplates[answerIndex]);
                    answerIndex = -1; // Reset answer index to show new folder contents
                } else {
                    rl.close();
                    return selectedPath;
                }
            } else {
                console.log("Selected file or folder does not exist. Please try again.");
            }
        }

        rl.close();
        return undefined;
    }

    /**
     * First finds all variables in the template and then asks the user to provide values for each variable.
     * Finally, it replaces all variables in the template with the provided values and returns the final work item JSON object.
     * Variables should be in the format {{variableName}} in the template JSON.
     * 
     * @param template The work item template JSON object
     * @returns The final work item JSON object with all variables replaced with user-provided values
     */
    async replaceTemplateVariables(template: any): Promise<any> {
        // Find all variables in the template
        const variableRegex = /\{\{(\w+)\}\}/g;
        let variables: Set<string> = new Set();
        let match;

        while ((match = variableRegex.exec(JSON.stringify(template))) !== null) {
            variables.add(match[1]);
        }

        // Ask user to provide values for each variable
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let variableValues: { [key: string]: string } = {};

        for (let variable of variables) {
            variableValues[variable] = await new Promise((resolve) => {
                rl.question(`Please enter a value for variable "${variable}": `, (answer: string) => {
                    resolve(answer);
                });
            });
        }

        rl.close();

        // Replace all variables in the template with user-provided values
        let finalWorkItem = JSON.stringify(template);
        for (let variable in variableValues) {
            const value = variableValues[variable];
            const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g");
            finalWorkItem = finalWorkItem.replace(regex, () => value);
        }

        return JSON.parse(finalWorkItem);
    }

    /**
     * Main function to run the console handler. 
     * It allows the user to select a work item template file and then creates a work item in Azure DevOps based on that template. 
     * The user can create multiple work items in one session by selecting different templates or providing different variable values.
     * 
     */
    async run(): Promise<void> {
        let createWorkItems = true;

        while (createWorkItems) {
            const templateFilePath: string | undefined = await this.getTemplatePath();
            if (templateFilePath) {
                // Read the work item template from the specified file
                const template = this.templateProcessor.getWorkItemTemplateFromFile(templateFilePath);
                if (!template) {
                    console.error("Failed to read work item template. Exiting.");
                    return;
                }

                // Process the template to replace variables with user-provided values
                const finalWorkItemJSON = await this.replaceTemplateVariables(template);
                await this.templateProcessor.createSingleWorkItem(finalWorkItemJSON);
            } else {
                console.log("No template file selected. Exiting.");
                createWorkItems = false;
                return;
            }
            // Ask user if they want to create another work item
            const answer = await this.getUserInput("Do you want to create another work item? (y/N): ");
            if (answer.toLowerCase() !== "y") {
                createWorkItems = false;
            }
        }
        console.log("Done with creating work items. Exiting.");
    }
}