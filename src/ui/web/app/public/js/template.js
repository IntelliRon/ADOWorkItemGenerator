$(document).ready(function () {
    $("#singleWorkItemForm").submit(function (event) {
        event.preventDefault();

        // Post to /template/:template with form data as JSON
        // Everything after /template is the template name, which may include subdirectories
        let templatePath = window.location.pathname.trim().split("/template/").splice(1).join("/");
        // Clean any trailing query parameters from the template name
        const queryParamIndex = templatePath.indexOf("?");
        if (queryParamIndex !== -1) {
            templatePath = templatePath.substring(0, queryParamIndex);
        }
        const templateVariables = {};
        $(".templateVariable").each(function () {
            const variableName = $(this).attr("name");
            const variableValue = $(this).val();
            templateVariables[variableName] = variableValue;
        });

        $.ajax({
            url: `/template/${templatePath}`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(templateVariables),
            success: function (response) {
                // Redirect back to index with query parameter indicating success
                window.location.href = `/?workItemId=${response.workItemId}`;
            },
            error: function (response) {
                // Show error pane on page
                $("#errorMessage").text(response.responseJSON?.error || "An error occurred while creating the work item.");
                $("#errorContainer").css("display", "flex");
            },
        });
    });
});