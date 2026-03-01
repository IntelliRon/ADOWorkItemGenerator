import * as azdev from "azure-devops-node-api";
import fs from "fs";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envConfig = dotenv.config({
    path: path.join(process.cwd(), ".env")
});
if (envConfig.error) {
    console.error("Error: .env file not found or could not be read:", envConfig.error.message);
    process.exit(1);
}

// ADO Work Item Creator - Main Entry Point
let orgUrl = "https://dev.azure.com/" + process.env.ORG;

let token: string | undefined = process.env.AZURE_PERSONAL_ACCESS_TOKEN;

console.log("DEBUG: Loaded from:", path.join(process.cwd(), ".env"));
console.log("DEBUG: process.env.AZURE_PERSONAL_ACCESS_TOKEN =", token ? "[SET]" : "[NOT SET]");

if (!token) {
    console.error("Error: AZURE_PERSONAL_ACCESS_TOKEN environment variable not set");
    process.exit(1);
}

// Initialize Azure DevOps client
let authHandler = azdev.getPersonalAccessTokenHandler(token);
let connection = new azdev.WebApi(orgUrl, authHandler);

console.log("ADO Work Item Creator - Ready");

/**
 * Reads a work item template from a file.
 * 
 * @param filePath The path of the work item template file
 * @returns The JSON object in the template file or null if file not found
 */
function getWorkItemTemplateFromFile(filePath: string): any {
    try {
        if (!fs.existsSync(filePath)) {
            console.log("Could not find work item template file at path: " + filePath);
            return null;
        }
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading work item template from file: ${err}`);
        return null;
    }
}

/**
 * First finds all variables in the template and then asks the user to provide values for each variable.
 * Finally, it replaces all variables in the template with the provided values and returns the final work item JSON object.
 * 
 * @param template The work item template JSON object
 * @returns The final work item JSON object with all variables replaced with user-provided values
 */
async function processWorkItemTemplate(template: any): Promise<any> {
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
        finalWorkItem = finalWorkItem.replace(regex, value);
    }

    return JSON.parse(finalWorkItem);
}

/** 
 * Get user input for a question via readline
 */
function getUserInput(question: string): Promise<string> {
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
 * Create a work item in Azure DevOps based on a template file. 
 * The template file can contain variables in the format {{variableName}} which will be replaced with user-provided values.
 * 
 * @param templateFilePath The path of the work item template file
 */
async function createWorkItemFromTemplate(templateFilePath: string) {
    try {
        // Read the work item template from the specified file
        const template = getWorkItemTemplateFromFile(templateFilePath);
        if (!template) {
            console.error("Failed to read work item template. Exiting.");
            return;
        }

        // Process the template to replace variables with user-provided values
        const finalWorkItem = await processWorkItemTemplate(template);

        console.log("DEBUG: finalWorkItem =", JSON.stringify(finalWorkItem, null, 2));

        // Create the work item in Azure DevOps
        const workItemTrackingApi = await connection.getWorkItemTrackingApi();

        // Convert template to JSON Patch operations format
        const operations: any[] = [];

        // Handle both flat and nested field structures
        const fields = finalWorkItem.fields || finalWorkItem;

        for (const [key, value] of Object.entries(fields)) {
            // Skip non-field properties
            if (key === "project" || key === "type") continue;

            operations.push({
                op: "add",
                path: `/fields/${key}`,
                value: value
            });
        }

        console.log("DEBUG: operations =", JSON.stringify(operations, null, 2));

        // Get project and type - required for creation
        let project = process.env.PROJECT;
        let type = finalWorkItem.type;

        if (!project) {
            console.log("Template does not specify a project. Please enter the Azure DevOps project name.");
            project = await getUserInput("Project name: ");
        }

        if (!type) {
            console.log("Template does not specify a work item type. Please enter the work item type (e.g., Task, Bug, User Story).");
            type = await getUserInput("Work item type: ");
        }

        console.log(`DEBUG: Creating work item of type "${type}" in project "${project}"`);

        const createdWorkItem = await workItemTrackingApi.createWorkItem(
            {},
            operations,
            project,
            type
        );

        console.log("DEBUG: createdWorkItem =", createdWorkItem);

        if (createdWorkItem && createdWorkItem.id) {
            console.log(`Work item created successfully with ID: ${createdWorkItem.id}`);
        } else {
            console.error("Failed to create work item: API returned unexpected response");
            console.error("Response:", createdWorkItem);
            console.error("\nCommon causes:");
            console.error(`- Project "${project}" does not exist or is not accessible`);
            console.error(`- Work item type "${type}" does not exist in project "${project}"`);
            console.error("- Your Personal Access Token may not have sufficient permissions");
        }
    } catch (err) {
        console.error(`Error creating work item from template: ${err}`);
    }
}

/**
 * Retrieves the list of work item templates from the work-item-templates folder and its sub-folders.
 * The function returns an array of template file names and sub-folder names sorted alphabetically with folders first.
 * 
 * @param subFolder The sub-folder to look into within the work-item-templates folder. Defaults to the root of the work-item-templates folder.
 * @returns An array of template file names and sub-folder names or undefined if the work-item-templates folder does not exist
 */
function getWorkItemTemplates(subFolder: string = ""): string[] | undefined {
    const templatesDir = path.join(__dirname, "../work-item-templates", subFolder);
    if (!fs.existsSync(templatesDir)) {
        console.log("No work-item-templates folder found.");
        return;
    }

    let items = fs.readdirSync(templatesDir);

    items = items.map(item => {
        const itemPath = path.join(templatesDir, item);
        if (fs.lstatSync(itemPath).isDirectory()) {
            item += "/"; // Append slash to indicate it's a folder
        }
        return item;
    });

    // Sort items alphabetically with folders first
    items.sort((a, b) => {
        const aIsDir = fs.lstatSync(path.join(templatesDir, a)).isDirectory();
        const bIsDir = fs.lstatSync(path.join(templatesDir, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    return items;
}

/**
 * Interactively allows the user to select a work item template file from the work-item-templates folder or its sub-folders.
 * The user can navigate through sub-folders and select a JSON template file. The function returns the path of the selected template file.
 * 
 * @returns The path of the selected work item template file or undefined if no file was selected
 */
async function selectTemplate() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let currentFolder = "";
    let answerIndex: number = -1;
    let workItemTemplates: string[] | undefined = getWorkItemTemplates(currentFolder);

    if (!workItemTemplates) {
        rl.close();
        return undefined;
    }

    while (answerIndex < 0 || answerIndex >= workItemTemplates.length) {
        workItemTemplates = getWorkItemTemplates(currentFolder);

        if (!workItemTemplates) {
            rl.close();
            return undefined;
        }

        workItemTemplates.unshift("../"); // Add option at start to go back to parent folder
        workItemTemplates.push("Cancel"); // Add option to cancel selection

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
        const selectedPath = path.join(__dirname, "../work-item-templates", currentFolder, workItemTemplates[answerIndex]);
        if (fs.existsSync(selectedPath)) {
            if (fs.lstatSync(selectedPath).isDirectory()) {
                currentFolder = path.join(currentFolder, workItemTemplates[answerIndex]);
                answerIndex = -1; // Reset answer index to show new folder contents
            } else if (answerIndex === 0) { // Go back option
                currentFolder = path.dirname(currentFolder);
                answerIndex = -1; // Reset answer index to show new folder contents
            } else if (answerIndex === workItemTemplates.length - 1) { // Cancel option
                rl.close();
                return undefined;
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
 * Main function to run the ADO Work Item Creator. It allows the user to select a work item template file and then creates a work item in Azure DevOps based on that template.
 */
async function main() {
    let createWorkItems = true;

    while (createWorkItems) {
        const templateFilePath: string | undefined = await selectTemplate();
        if (templateFilePath) {
            await createWorkItemFromTemplate(templateFilePath);
        } else {
            console.log("No template file selected. Exiting.");
            createWorkItems = false;
        }
        // Ask user if they want to create another work item
        const answer = await getUserInput("Do you want to create another work item? (y/N): ");
        if (answer.toLowerCase() !== "y") {
            createWorkItems = false;
        }
    }
    console.log("Done with creating work items. Exiting.");
}

await main();
