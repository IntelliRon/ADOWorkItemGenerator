import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import * as azdev from "azure-devops-node-api";
import { ErrorCodeGenerator } from "../utils/ErrorCodeGenerator.js";
import { dirname } from "path";
import { fileURLToPath } from "url";


export class TemplateProcessor {
    private orgUrl: string;
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
        // Load environment variables from .env file
        const envConfig = dotenv.config({
            path: path.join(this.basePath, "../.env")
        });
        if (envConfig.error) {
            console.error("Error: .env file not found or could not be read:", envConfig.error.message);
            process.exit(1);
        }

        this.orgUrl = "https://dev.azure.com/" + process.env.ORG;
    }

    /**
     * Reads a work item template from a file.
     * 
     * @param filePath The path of the work item template file
     * @returns The JSON object in the template file or null if file not found
     */
    getWorkItemTemplateFromFile(filePath: string): any {
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
     * Retrieves the list of work item templates from the work-item-templates folder and its sub-folders.
     * The function returns an array of template file names and sub-folder names sorted alphabetically with folders first.
     * 
     * @param subFolder The sub-folder to look into within the work-item-templates folder. Defaults to the root of the work-item-templates folder.
     * @returns An array of template file names and sub-folder names or undefined if the work-item-templates folder does not exist
     */
    getWorkItemTemplates(subFolder: string = ""): string[] | undefined {
        const templatesDir = path.join(this.basePath, "../work-item-templates", subFolder);
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
     * Future expansion to allow creating multiple work items from a single template.
     */
    async createMultipleWorkItemsFromTemplate(template: any): Promise<void> {
        // TODO: Future expansion to allow creating multiple work items from a single template
        throw new Error("Not implemented yet");
    }

    /** 
     * Create a work item in Azure DevOps based on a template JSON object.
     * The function converts the template into the format required by the Azure DevOps API and creates the work item.
     * 
     * @param template The work item template JSON object
     * @return The ID of the created work item or -1 if there was an error
     */
    async createSingleWorkItem(template: { [key: string]: any }): Promise<number> {
        try {
            if (!process.env.PERSONAL_ACCESS_TOKEN) {
                console.error("Error: PERSONAL_ACCESS_TOKEN environment variable not set");
                return ErrorCodeGenerator.getErrorCode("PERSONAL_ACCESS_TOKEN_NOT_SET");
            }

            if (!template) {
                console.error("Error: No template provided for work item creation");
                return ErrorCodeGenerator.getErrorCode("NO_TEMPLATE_PROVIDED");
            }

            if (!template.creationMode || template.creationMode !== "single") {
                console.error("Error: Template creationMode is not set to 'single'. This function only supports single work item creation.");
                return ErrorCodeGenerator.getErrorCode("CREATION_MODE_NOT_SINGLE");
            }

            if (!template.templateData) {
                console.error("Error: Template data is missing. The template should have a 'templateData' property containing the work item fields.");
                return ErrorCodeGenerator.getErrorCode("TEMPLATE_DATA_MISSING");
            }

            // Create the work item in Azure DevOps
            const authHandler = azdev.getPersonalAccessTokenHandler(process.env.PERSONAL_ACCESS_TOKEN);
            const connection = new azdev.WebApi(this.orgUrl, authHandler);

            const workItemTrackingApi = await connection.getWorkItemTrackingApi();

            // Convert template to JSON Patch operations format
            const operations: any[] = [];

            const fields = template.templateData;

            for (const [key, value] of Object.entries(fields)) {
                // Skip non-field properties
                if (key === "project" || key === "workItemType") continue;

                // Handle parent relationship via relation
                if (key === "parentId") {
                    const parentId = Number(value);
                    if (!isNaN(parentId) && parentId > 0) {
                        operations.push({
                            op: "add",
                            path: "/relations/-",
                            value: {
                                rel: "System.LinkTypes.Hierarchy-Reverse",
                                url: `${this.orgUrl}/_apis/wit/workItems/${parentId}`
                            }
                        });
                    } else {
                        console.warn(`WARNING: Invalid parent ID "${value}" — skipping parent relation.`);
                    }
                    continue;
                }

                operations.push({
                    op: "add",
                    path: `/fields/${key}`,
                    value: value
                });
            }

            console.debug("DEBUG: operations =", JSON.stringify(operations, null, 2));

            // Get project and type - required for creation
            let project = process.env.PROJECT;
            let type = template.templateData.workItemType;

            if (!project) {
                console.error("Error: PROJECT environment variable not set");
                return ErrorCodeGenerator.getErrorCode("MISSING_PROJECT");
            }

            if (!type) {
                console.error("Error: Malformed template: 'workItemType' field is required in the template");
                return ErrorCodeGenerator.getErrorCode("MISSING_TYPE");
            }

            console.debug(`DEBUG: Creating work item of type "${type}" in project "${project}"`);

            const createdWorkItem = await workItemTrackingApi.createWorkItem(
                {},
                operations,
                project,
                type
            );

            console.debug("DEBUG: createdWorkItem =", createdWorkItem);

            if (createdWorkItem && createdWorkItem.id) {
                console.log(`Work item created successfully with ID: ${createdWorkItem.id}`);
                return createdWorkItem.id;
            } else {
                console.error("Failed to create work item: API returned unexpected response");
                console.error("Response:", createdWorkItem);
                console.error("\nCommon causes:");
                console.error(`- Project "${project}" does not exist or is not accessible`);
                console.error(`- Work item type "${type}" does not exist in project "${project}"`);
                console.error("- Your Personal Access Token may not have sufficient permissions");
                return ErrorCodeGenerator.getErrorCode("WORK_ITEM_CREATION_FAILED");
            }
        } catch (err) {
            console.error(`Error creating work item from template: ${err}`);
            return ErrorCodeGenerator.getErrorCode("WORK_ITEM_CREATION_FAILED");
        }
    }
}