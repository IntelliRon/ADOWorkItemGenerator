
import * as path from "path";
import * as dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";

import { TemplateProcessor } from "../../../core/TemplateProcessor.js";
import { findTemplateVariables } from "../../../core/findTemplateVariables.js";
import { replaceTemplateVariables } from "../../../core/replaceTemplateVariables.js";
import { ErrorCodeGenerator } from "../../../utils/ErrorCodeGenerator.js";

export class WebApp {

    basePath: string;
    templateProcessor: TemplateProcessor;

    constructor(basePath: string) {
        this.basePath = basePath;
        // Ensure .env file is loaded
        const envConfig = dotenv.config({
            path: path.join(basePath, "../.env")
        });
        if (envConfig.error) {
            console.error("Error: .env file not found or could not be read:", envConfig.error.message);
            process.exit(1);
        }

        if (!process.env.ORG) {
            console.error("Error: ORG environment variable not set in .env file");
            process.exit(1);
        }

        this.templateProcessor = new TemplateProcessor(basePath);
    }

    run() {
        const app = express();

        app.use(bodyParser.urlencoded({
            extended: true
        }));

        app.use(express.json());

        app.use(express.static(path.join(import.meta.dirname, "public")));

        app.set("view engine", "ejs");
        app.set("views", path.join(import.meta.dirname, "views"));

        app.get("/", (req, res) => {
            // If redirected from post request after creating work item, show success message with work item number
            const workItemIdQuery = req.query.workItemId;
            let currentDir = req.query.folder || "root";

            if (typeof currentDir !== "string") {
                res.status(400).send("Invalid folder query parameter");
                return;
            }

            currentDir = currentDir.trim();

            if (currentDir.endsWith("../")) {
                let dirParts = currentDir.split("/").filter(part => part.length > 0);
                dirParts = dirParts.slice(0, dirParts.length - 2);
                currentDir = dirParts.length > 0 ? dirParts.join("/") + "/" : "root";

                // Fix the URL on client side to remove the ../ from the URL query parameter
                res.redirect("/?folder=" + currentDir + (workItemIdQuery ? "&workItemId=" + workItemIdQuery : ""));
                return;
            }

            let workItemDir = currentDir === "root" ? "" : currentDir;

            // Security check: ensure the resolved path stays within the work-item-templates folder
            const baseDirPath = path.resolve(this.basePath, "../work-item-templates");
            const resolvedPath = path.resolve(baseDirPath, workItemDir);
            const relativePath = path.relative(baseDirPath, resolvedPath);
            
            if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
                res.status(400).send("Invalid folder path");
                return;
            }
            
            const templates = this.templateProcessor.getWorkItemTemplates(workItemDir);

            if (currentDir !== "root" && templates) {
                templates.unshift("../");
            }

            if (!templates) {
                res.status(404).send("No templates found");
                return;
            }

            let workItemError: string | undefined = undefined;
            let workItemId: number | undefined = undefined;

            if (typeof workItemIdQuery === "string" && workItemIdQuery.trim().length > 0) {
                const parsedWorkItemId: number = Number(workItemIdQuery.trim());

                if (!Number.isNaN(parsedWorkItemId)) {
                    workItemId = parsedWorkItemId;
                    if (parsedWorkItemId <= 0) {
                        workItemError = ErrorCodeGenerator.getErrorMessage(parsedWorkItemId);
                    }
                } else {
                    workItemError = "Invalid work item ID.";
                }
            }

            res.render("pages/index", { templates, currentDir, workItemId, workItemError });
        });

        app.get("/template/*templatePath", (req, res) => {
            const templatePathArray: string[] | string | undefined = (req.params as any).templatePath;
            const templatePath: string = Array.isArray(templatePathArray) ? templatePathArray.join("/") : templatePathArray as string;
            if (!templatePath) {
                res.status(400).send("Invalid template path parameter");
                return;
            }
            const fullTemplatePath = path.join(this.basePath, "../work-item-templates", templatePath);
            const templateData = this.templateProcessor.getWorkItemTemplateFromFile(fullTemplatePath);
            if (!templateData) {
                res.status(404).send("Template not found or invalid.");
                return;
            }
            const templateVariables = findTemplateVariables(templateData);
            res.render("pages/template", { templatePath, templateData, templateVariables });
        });

        app.post("/template/*templatePath", async (req, res) => {
            const templatePathArray: string[] | string | undefined = (req.params as any).templatePath;
            const templatePath: string = Array.isArray(templatePathArray) ? templatePathArray.join("/") : templatePathArray as string;
            if (!templatePath) {
                res.status(400).send("Invalid template path parameter");
                return;
            }
            const rawTemplateVariables: unknown = req.body;

            // Ensure the request body is a non-null object and not an array
            if (
                rawTemplateVariables === null ||
                typeof rawTemplateVariables !== "object" ||
                Array.isArray(rawTemplateVariables)
            ) {
                res.status(400).json({ error: "Invalid request body. Expected an object with template variables." });
                return;
            }

            // Coerce allowed values to strings and reject unsupported value types
            const templateVariables: Record<string, string> = {};
            for (const [key, value] of Object.entries(rawTemplateVariables as Record<string, unknown>)) {
                if (typeof value === "string") {
                    templateVariables[key] = value;
                } else if (value === null || value === undefined) {
                    // Treat null/undefined as empty string so they are considered "missing"
                    templateVariables[key] = "";
                } else if (typeof value === "number" || typeof value === "boolean") {
                    templateVariables[key] = String(value);
                } else {
                    res.status(400).json({ error: `Invalid type for template variable "${key}". Expected a string or primitive value.` });
                    return;
                }
            }

            const fullTemplatePath = path.join(this.basePath, "../work-item-templates", templatePath);
            const templateData = this.templateProcessor.getWorkItemTemplateFromFile(fullTemplatePath);
            if (!templateData) {
                res.status(400).json({ error: "Template not found or invalid." });
                return;
            }

            const missingVariables = Array.from(findTemplateVariables(templateData)).filter(variable => {
                const value = templateVariables[variable];
                return !(variable in templateVariables) || value.trim() === "";
            });
            if (missingVariables.length > 0) {
                res.status(400).json({ error: "Missing template variables: " + missingVariables.join(", ") });
                return;
            }

            // Call function to create work item in Azure DevOps using the templateData
            if (templateData.creationMode === "single") {
                try {
                    const filledTemplateData = replaceTemplateVariables(templateData, templateVariables);
                    const createdWorkItemId = await this.templateProcessor.createSingleWorkItem(filledTemplateData);
                    if (createdWorkItemId <= 0) {
                        res.status(500).json({ error: "Failed to create work item. Please check the server logs for more details." });
                        return;
                    }
                    res.json({ workItemId: createdWorkItemId });
                } catch (err: any) {
                    console.error("Error creating work item:", err);
                    res.status(500).json({ error: "Error creating work item: " + err.message });
                }
            } else {
                res.status(400).json({ error: "Invalid template creation mode. Only 'single' is supported." });
            }
        });

        app.listen(3000, () => {
            console.log("Web app is running on http://localhost:3000");
        });
    }
}