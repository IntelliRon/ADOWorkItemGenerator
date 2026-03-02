import { dirname } from "path";
import { fileURLToPath } from "url";

import { ConsoleHandler } from "./ui/console/ConsoleHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main function to run the ADO Work Item Creator. It allows the user to select a work item template file and then creates a work item in Azure DevOps based on that template.
 */
async function main() {
    // Use args to determine if user wants to run in console mode or GUI mode (for future expansion)
    if (process.argv.includes("--console")) {
        const consoleHandler = new ConsoleHandler(__dirname);

        console.log("Welcome to the Azure DevOps Work Item Creator!");

        await consoleHandler.run();
    } else {
        console.log("GUI mode is not implemented yet. Please run with --console to use the console mode.");
    }
}

await main();
