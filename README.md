# ADO Work Item Creator

A TypeScript Node.js application for programmatically creating Azure DevOps (ADO) work items using templates.

## Features

- Create ADO work items via the Azure DevOps API
- Template-based work item creation with variable substitution
- Interactive console UI for browsing and selecting work item templates
- Web UI for browsing templates and creating work items in single template mode
- Folder navigation within the `work-item-templates` directory
- TypeScript with strict type checking
- Environment-based configuration

## Prerequisites

- Node.js v25.6.1 or higher
- npm
- Azure DevOps account with API access
- Personal Access Token (PAT) for Azure DevOps authentication

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```
PERSONAL_ACCESS_TOKEN=your-personal-access-token-here
ORG=your-ado-organization-name
PROJECT=your-ado-project-name
```

- **PERSONAL_ACCESS_TOKEN** - Your Azure DevOps Personal Access Token (required for API authentication)
- **ORG** - Your Azure DevOps organization name (required)
- **PROJECT** - Your Azure DevOps project name (required)

## Usage

Run the application in web UI mode (default):

```bash
npm start
```

This will launch the web UI on [http://localhost:3000](http://localhost:3000), allowing you to browse the `work-item-templates` folder, select a template, fill in any template variables, and create a work item in Azure DevOps.

> **Note:** Currently, only templates with `"creationMode": "single"` are supported in the web UI.

Run the application in console mode:

```bash
npm start -- --console
```

This will launch the interactive console UI instead.

## Project Structure

```
├── src/
│   ├── index.ts                        # Main entry point
│   ├── core/
│   │   └── TemplateProcessor.ts        # Reads templates and calls the ADO API
│   ├── ui/
│   │   ├── console/
│   │   │   └── ConsoleHandler.ts       # Interactive console UI
│   │   └── web/
│   │       ├── WebHandler.ts           # Web UI handler
│   │       └── app/
│   │           ├── app.ts              # Express web app
│   │           ├── public/             # Static assets (CSS, JS)
│   │           └── views/              # EJS templates
│   └── utils/
│       └── ErrorCodeGenerator.ts       # Standardised error codes
├── work-item-templates/
│   └── workItemTemplate.json           # Example work item template
├── package.json                        # Project dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
└── README.md                           # This file
```

## Work Item Templates

Work item templates are defined in JSON format. Example template:

```json
{
    "creationMode": "single",
    "templateData": {
        "project": "Test",
        "workItemType": "Task",
        "System.Title": "Test Work Item from Template",
        "System.Description": "This work item was created from a JSON template with variables. Here is a variable {{Variable1}}.",
        "System.IterationPath": "Test",
        "System.State": "To Do"
    }
}
```

Templates support variable substitution using the `{{VariableName}}` syntax.

## Development

- All source code should be placed in the `src/` directory
- TypeScript strict mode is enabled
- Type annotations are required for all variables and functions

## Technologies

- **TypeScript** - Static type checking for JavaScript
- **ts-node** - Execute TypeScript directly without compilation
- **azure-devops-node-api** - Official Azure DevOps Node.js API client
- **dotenv** - Environment variable management

## License

ISC

